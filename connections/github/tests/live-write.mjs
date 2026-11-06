import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {createPermissions} from '../../../dist/permissions/src/index.js';
import {createConnectionService} from '../../../dist/connections/src/index.js';
import {createGitHubFileAdapter,createGitHubConfiguredFileReader,githubFileTarget} from '../../../dist/connections/github/src/index.js';
/** Real-service acceptance only. The caller supplies official Octokit with retries disabled.
 * All remote file mutations target an explicit per-run audit branch and one fixture file.
 * Successful audit data is retained; this entry never deletes a branch or file.
 */
export async function verifyGitHubWrite({github,owner,repo,ref,runId,runAttempt}){
 assert.match(ref,/^[0-9a-f]{40}$/);assert.match(String(runId),/^\d+$/);assert.match(String(runAttempt),/^\d+$/);
 const branch='b1-acceptance/sdk-'+runId+'-'+runAttempt,path='acceptance/github-sdk.txt';
 // Fixture setup is deliberately separate from the product file-write capabilities under test.
 await github.rest.git.createRef({owner,repo,ref:'refs/heads/'+branch,sha:ref});
 const target=githubFileTarget({owner,repo,ref:branch,path}),writeRequest={},readRequest={};
 const scopes=new WeakMap(),approved=new WeakSet();
 const actor={subject:'github-actions',entry:'github-write-acceptance',conversation:null,context:null,resource:'github',target,relationship:'ci-run',relationshipGeneration:1};
 scopes.set(writeRequest,{...actor,action:'write'});scopes.set(readRequest,{...actor,action:'read'});
 const dir=await mkdtemp(join(tmpdir(),'wex-github-write-'));
 let pm,configs,operations,permission,service,sequence=0,clientAcquisitions=0;
 const open=()=>{
  pm=openSqliteStore(join(dir,'permissions.sqlite'),'permissions');
  configs=openSqliteStore(join(dir,'configs.sqlite'),'connection-configs');
  operations=openSqliteStore(join(dir,'operations.sqlite'),'connection-operations');
  permission=createPermissions(pm,{current:r=>{const scope=scopes.get(r);return scope?{...scope,kind:'local',entryEnabled:true,moduleEnabled:true,globalEnabled:true,conversationEnabled:false,sourceAllowed:true}:undefined;},
   canManage:c=>approved.has(c),canReadHistory:()=>false});
  const client=async(connection,access)=>{assert.equal(connection.endpoint,'https://api.github.com');assert.equal(access.check(),true);clientAcquisitions++;return github;};
  service=createConnectionService(permission,configs,operations,[createGitHubFileAdapter(client)],{readAdapters:[createGitHubConfiguredFileReader(client)]});
 };
 const close=async()=>{if(service){assert.equal((await service.stop()).status,'stopped');service=undefined;}operations?.close();configs?.close();pm?.close();operations=configs=pm=undefined;};
 const manage=(kind,request)=>{const command={intent:'acceptance-'+(++sequence),expectedRevision:pm.read().revision,scope:scopes.get(request)};approved.add(command);assert.equal(permission[kind](command).status,'committed');};
 const dispatch=(operationId,payload)=>service.dispatch('github',writeRequest,operationId,'github',1,target,'file-write',payload);
 const receipt=id=>{const operation=service.operations.get(id);assert.equal(operation.phase,'observed');assert.equal(operation.attempts,1);return operation.observations[0].value;};
 try{
  open();
  const config={id:'github',adapter:'github',endpoint:'https://api.github.com',credentialRef:'github-actions-bounded-write',enabled:true};
  assert.equal(service.configs.put(config,0,'config-create').status,'ok');
  const initial={kind:'put',message:'B1 SDK acceptance: create fixture',content:'created for '+ref+'\n',expectedSha:null};
  assert.notEqual((await dispatch('denied-create',initial)).status,'observed');assert.equal(service.operations.get('denied-create'),undefined);assert.equal(clientAcquisitions,0);
  manage('grant',writeRequest);
  assert.equal((await dispatch('create',initial)).status,'observed');
  const created=receipt('create');assert.equal(created.status,'written');
  manage('grant',readRequest);
  let observed=await service.read('github',readRequest,'github',1,target);assert.equal(observed.status,'ok');assert.equal(observed.value.content,initial.content);assert.equal(observed.value.sha,created.sha);
  await close();open();
  const beforeReplay=clientAcquisitions;
  assert.equal((await dispatch('create',initial)).status,'blocked');assert.equal(clientAcquisitions,beforeReplay);assert.deepEqual(receipt('create'),created);
  const update={kind:'put',message:'B1 SDK acceptance: expected SHA update',content:'updated for '+ref+'\n',expectedSha:created.sha};
  assert.equal((await dispatch('update',update)).status,'observed');const updated=receipt('update');assert.equal(updated.status,'written');assert.notEqual(updated.sha,created.sha);
  observed=await service.read('github',readRequest,'github',1,target);assert.equal(observed.status,'ok');assert.equal(observed.value.content,update.content);assert.equal(observed.value.sha,updated.sha);
  const stale={...update,message:'B1 SDK acceptance: stale SHA must conflict',content:'must not be written\n',expectedSha:created.sha};
  assert.equal((await dispatch('stale',stale)).status,'observed');assert.equal(receipt('stale').status,'conflict');
  const remote=await github.rest.git.getRef({owner,repo,ref:'heads/'+branch});assert.equal(remote.data.object.sha,updated.commitSha);
  manage('revoke',writeRequest);const beforeDenied=clientAcquisitions;
  assert.notEqual((await dispatch('revoked',{...update,expectedSha:updated.sha})).status,'observed');assert.equal(service.operations.get('revoked'),undefined);assert.equal(clientAcquisitions,beforeDenied);
  return {sha:ref,runtime:process.version,authMode:'GitHub Actions GITHUB_TOKEN; contents:write restricted by this fixture to the audit branch',
   owner,repo,branch,path,fixtureBranchCreated:true,remoteFileMutations:2,
   create:{blobSha:created.sha,commitSha:created.commitSha},update:{blobSha:updated.sha,commitSha:updated.commitSha},
   checks:{defaultDeny:true,realOfficialSdkCreate:true,expectedShaUpdate:true,remoteContentReadback:true,
    durableOperationReplayBlocked:true,staleShaConflict:true,revocation:true},
   operations:service.operations.read().operations.map(o=>({id:o.id,phase:o.phase,attempts:o.attempts})),
   limitations:['Audit branch and fixture file are retained for review','Host CI identity is not Windows IPC authentication']};
 }finally{await close();await rm(dir,{recursive:true,force:true});}
}
