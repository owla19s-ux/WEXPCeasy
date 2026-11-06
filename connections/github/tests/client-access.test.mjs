import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {createReadBoundary,createConnectionService} from '../../../dist/connections/src/index.js';
import {createGitHubFileAdapter,createGitHubFileReader,githubFileTarget} from '../../../dist/connections/github/src/index.js';
const spec={owner:'owner',repo:'repo',ref:'main',path:'file.txt'},target=githubFileTarget(spec);
const config={id:'github',adapter:'github',endpoint:'https://api.github.com',credentialRef:'credential-ref',enabled:true};
function fixture(action){
 const request={};let allowed=true;
 const scope={subject:'user',entry:'conversation',conversation:'chat',context:null,resource:'github',action,target,relationship:'direct',relationshipGeneration:1};
 const permission={evaluate(r){return r===request&&allowed?{status:'allow',revision:1,generation:1,scope}:{status:'deny',reason:'revoked'};},recheck(r){return this.evaluate(r);}};
 return {request,permission,revoke(){allowed=false;}};
}
test('GitHub async client preparation cannot dispatch a write after request revocation',async()=>{
 const h=fixture('write'),cs=openSqliteStore(':memory:','configs'),os=openSqliteStore(':memory:','operations');let calls=0,contextSeen=false;
 try{
  const adapter=createGitHubFileAdapter(async(connection,access)=>{
   assert.equal(access?.request,h.request);contextSeen=true;await Promise.resolve();h.revoke();
   return {rest:{repos:{async createOrUpdateFileContents(){calls++;return {data:{content:{sha:'b'.repeat(40),path:spec.path},commit:{sha:'c'.repeat(40)}}};}}}};
  });
  const s=createConnectionService(h.permission,cs,os,[adapter]);s.configs.put(config,0,'create');
  const result=await s.dispatch('github',h.request,'op','github',1,target,'write',{kind:'put',message:'update',content:'text',expectedSha:'a'.repeat(40)});
  assert.equal(contextSeen,true);assert.equal(calls,0);assert.equal(result.status,'observed');
  assert.equal(JSON.stringify(s.operations.get('op')).includes('adapter_access_unavailable'),true);await s.stop();
 }finally{cs.close();os.close();}
});
test('GitHub client preparation rechecks captured configuration before calling the official SDK',async()=>{
 const h=fixture('write'),cs=openSqliteStore(':memory:','configs'),os=openSqliteStore(':memory:','operations');let s,calls=0;
 try{
  const adapter=createGitHubFileAdapter(async()=>{
   await Promise.resolve();s.configs.put({...config,enabled:false},1,'disable');
   return {rest:{repos:{async createOrUpdateFileContents(){calls++;throw Error('must not call');}}}};
  });
  s=createConnectionService(h.permission,cs,os,[adapter]);s.configs.put(config,0,'create');
  const result=await s.dispatch('github',h.request,'op','github',1,target,'write',{kind:'put',message:'update',content:'text',expectedSha:'a'.repeat(40)});
  assert.equal(result.status,'observed');assert.equal(calls,0);await s.stop();
 }finally{cs.close();os.close();}
});
test('GitHub read client preparation receives the actual request and cannot fetch after revocation',async()=>{
 const h=fixture('read');let calls=0,contextSeen=false;
 const reader=createReadBoundary(h.permission,createGitHubFileReader(config,async(connection,access)=>{
  assert.equal(access?.request,h.request);contextSeen=true;await Promise.resolve();h.revoke();
  return {rest:{repos:{async getContent(){calls++;return {data:{type:'file',path:spec.path,sha:'a'.repeat(40),size:4,encoding:'base64',content:'dGV4dA=='}};}}}};
 }));
 const result=await reader.read(h.request,target);
 assert.equal(contextSeen,true);assert.notEqual(result.status,'ok');assert.equal(calls,0);
});
