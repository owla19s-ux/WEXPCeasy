import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {createPermissions} from '../../../dist/permissions/src/index.js';
import {createConnectionService} from '../../../dist/connections/src/index.js';
import {createGitHubConfiguredFileReader,githubFileTarget} from '../../../dist/connections/github/src/index.js';
/** Acceptance entry only: GitHub Actions supplies its real official Octokit and read-only token.
 * No credential or SDK instance comes from product input; no remote mutation is invoked.
 */
export async function verifyGitHubRead({github,readAdapter,provider='octokit',owner,repo,ref,workspacePath}){
 assert.match(ref,/^[0-9a-f]{40}$/);
 const file={owner,repo,ref,path:'package.json'},target=githubFileTarget(file),request={};
 const scope={subject:'github-actions',entry:'github-read-acceptance',conversation:null,context:null,
  resource:'github',action:'read',target,relationship:'ci-run',relationshipGeneration:1};
 const pm=openSqliteStore(':memory:','permissions'),configs=openSqliteStore(':memory:','connection-configs'),operations=openSqliteStore(':memory:','connection-operations');
 const approved=new WeakSet();
 const permission=createPermissions(pm,{current:r=>r===request?{...scope,kind:'local',entryEnabled:true,moduleEnabled:true,globalEnabled:true,conversationEnabled:false,sourceAllowed:true}:undefined,
  canManage:c=>approved.has(c),canReadHistory:()=>false});
 let clientAcquisitions=0,sequence=0,service;
 const manage=kind=>{const c={intent:'acceptance-'+(++sequence),expectedRevision:pm.read().revision,scope};approved.add(c);assert.equal(permission[kind](c).status,'committed');};
 try{
  service=createConnectionService(permission,configs,operations,[],{readAdapters:[readAdapter?{...readAdapter,async read(connection,target,signal,access){
   assert.equal(access.request,request);assert.equal(access.check(),true);clientAcquisitions++;
   return readAdapter.read(connection,target,signal,access);
  }}:createGitHubConfiguredFileReader(async(connection,access)=>{
   assert.equal(access.request,request);assert.equal(access.check(),true);
   assert.equal(connection.endpoint,'https://api.github.com');clientAcquisitions++;return typeof github==='function'?github(connection,access):github;
  })]});
  const config={id:'github',adapter:'github',endpoint:'https://api.github.com',credentialRef:'github-actions-readonly',enabled:true};
  assert.equal(service.configs.put(config,0,'config-create').status,'ok');
  assert.equal((await service.read('github',request,'github',1,target)).status,'denied');
  assert.equal(clientAcquisitions,0);
  manage('grant');
  const result=await service.read('github',request,'github',1,target);
  assert.equal(result.status,'ok');assert.equal(clientAcquisitions,1);
  // Compare the exact committed blob; Windows checkout may convert LF to CRLF.
  const bytes=execFileSync('git',['show',ref+':'+file.path],{cwd:workspacePath,maxBuffer:2*1024*1024});
  const expectedSha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  assert.equal(result.value.content,bytes.toString('utf8'));assert.equal(result.value.sha,expectedSha);
  assert.equal(result.value.ref,ref);assert.equal(result.value.owner,owner);assert.equal(result.value.repo,repo);
  manage('revoke');
  assert.equal((await service.read('github',request,'github',1,target)).status,'denied');
  assert.equal(clientAcquisitions,1);
  manage('grant');assert.equal(service.configs.put({...config,enabled:false},1,'config-disable').status,'ok');
  assert.notEqual((await service.read('github',request,'github',2,target)).status,'ok');assert.equal(clientAcquisitions,1);
  assert.equal(service.operations.read().operations.length,0);
  return {sha:ref,runtime:process.version,provider,authMode:'GitHub Actions GITHUB_TOKEN; contents:read',
   owner,repo,path:file.path,blobSha:expectedSha,size:bytes.length,clientAcquisitions,
   checks:{defaultDeny:true,realOfficialSdkRead:provider==='octokit',pinnedCommitAndBlob:true,revocation:true,disabledConnection:true},
   remoteMutations:0,limitations:['Read-only service acceptance; no authenticated write verification','Host CI identity is not Windows IPC authentication']};
 }finally{
  if(service)assert.equal((await service.stop()).status,'stopped');
  pm.close();configs.close();operations.close();
 }
}
