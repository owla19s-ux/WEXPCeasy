import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createConnectionService,createReadBoundary} from '../../dist/connections/src/index.js';
const github=await import('../../dist/connections/github/src/index.js').catch(()=>({}));
const config={id:'gh',adapter:'github',endpoint:'https://api.github.com',credentialRef:'secret-ref',enabled:true};
const spec={owner:'owner',repo:'repo',ref:'main',path:'src/a.txt'};
const sha='a'.repeat(40),newSha='b'.repeat(40),commitSha='c'.repeat(40);
function permission(target,action='write'){return {evaluate(){return {status:'allow',revision:1,generation:1,scope:{subject:'user',entry:'conversation',conversation:'chat',context:null,resource:'github',action,target,relationship:'direct',relationshipGeneration:1}};},recheck(request){return this.evaluate(request);}};}

test('GitHub SDK adapter records one expected-SHA file update and never replays an existing Operation',async()=>{
 assert.equal(typeof github.createGitHubFileAdapter,'function');
 const target=github.githubFileTarget(spec),configs=openSqliteStore(':memory:','configs'),operations=openSqliteStore(':memory:','operations');
 let calls=0,received;
 try{
  const adapter=github.createGitHubFileAdapter(connection=>{
   assert.deepEqual(connection,config);
   return {rest:{repos:{async createOrUpdateFileContents(input){calls++;received=input;return {data:{content:{sha:newSha,path:spec.path},commit:{sha:commitSha}}};}}}};
  });
  const service=createConnectionService(permission(target),configs,operations,[adapter]);
  service.configs.put(config,0,'create');
  const payload={kind:'put',message:'Update file',content:'hello',expectedSha:sha};
  assert.equal((await service.dispatch('github',{},'op','gh',1,target,'write',payload)).status,'observed');
  assert.equal((await service.dispatch('github',{},'op','gh',1,target,'write',payload)).status,'blocked');
  assert.equal(calls,1);assert.equal(received.sha,sha);assert.equal(received.branch,'main');
  assert.equal(Buffer.from(received.content,'base64').toString(),'hello');
  const operation=service.operations.get('op');
  assert.equal(JSON.stringify(operation).includes('secret-ref'),false);
  assert.equal(JSON.stringify(operation).includes(commitSha),true);
  assert.equal((await service.stop()).status,'stopped');
 }finally{configs.close();operations.close();}
});
test('GitHub target encoding rejects ambiguous traversal and binds repository, ref and file independently',()=>{
 assert.equal(typeof github.githubFileTarget,'function');
 for(const path of ['../secret','a/../secret','/absolute','a\\secret','a//b']){
  assert.throws(()=>github.githubFileTarget({...spec,path}));
 }
 assert.notEqual(github.githubFileTarget({...spec,repo:'other'}),github.githubFileTarget(spec));
 assert.notEqual(github.githubFileTarget({...spec,ref:'feature/x'}),github.githubFileTarget(spec));
});
test('GitHub file reader bounds response data and uses the read permission boundary',async()=>{
 assert.equal(typeof github.createGitHubFileReader,'function');
 const target=github.githubFileTarget(spec);let calls=0;
 const adapter=github.createGitHubFileReader(config,()=>({rest:{repos:{async getContent(input){
  calls++;assert.equal(input.ref,'main');assert.equal(input.path,'src/a.txt');
  return {data:{type:'file',path:spec.path,sha,size:5,encoding:'base64',content:'aGVsbG8='}};
 }}}}));
 const reader=createReadBoundary(permission(target,'read'),adapter);
 assert.deepEqual(await reader.read({},target),{status:'ok',value:{...spec,sha,content:'hello',size:5}});
 assert.equal((await reader.read({},github.githubFileTarget({...spec,repo:'private'}))).status,'denied');
 assert.equal(calls,1);
});
test('unknown SDK write outcome is recorded and never automatically retried',async()=>{
 assert.equal(typeof github.createGitHubFileAdapter,'function');
 const target=github.githubFileTarget(spec),configs=openSqliteStore(':memory:','configs'),operations=openSqliteStore(':memory:','operations');let calls=0;
 try{
  const adapter=github.createGitHubFileAdapter(()=>({rest:{repos:{async createOrUpdateFileContents(){calls++;throw Error('lost acknowledgement');}}}}));
  const service=createConnectionService(permission(target),configs,operations,[adapter]);service.configs.put(config,0,'create');
  const payload={kind:'put',message:'Update',content:'x',expectedSha:sha};
  assert.equal((await service.dispatch('github',{},'lost','gh',1,target,'write',payload)).status,'unknown');
  assert.equal((await service.dispatch('github',{},'lost','gh',1,target,'write',payload)).status,'blocked');
  assert.equal(calls,1);await service.stop();
 }finally{configs.close();operations.close();}
});
