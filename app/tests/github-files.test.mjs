import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
import {githubFileTarget} from '../../dist/connections/github/src/index.js';
import {openSqliteStore,inspectRoot} from '../../dist/shared/src/index.js';
const spec={owner:'owner',repo:'repo',ref:'main',path:'file.txt'},target=githubFileTarget(spec);
async function fixture(t,prepare){
 const root=await mkdtemp(join(tmpdir(),'wex-app-github-'));await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const source={},identity={subject:'user',entry:'window',relationship:'window-session',relationshipGeneration:1,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,entryEnabled:true};
 let calls=0,remote='text',sha='a'.repeat(40),grants=0;const hosts=[],storageEvents=[];
 const failure=(namespace,operation,error)=>storageEvents.push({namespace,operation,name:error?.name,code:error?.code,errcode:error?.errcode,message:error?.message});
 // Official SDK methods are substitutes; App, Permissions, configuration and SQLite receipts are real.
 const client={rest:{repos:{
  async getContent(input){calls++;assert.equal(input.owner,'owner');assert.equal(input.repo,'repo');return {data:{type:'file',path:spec.path,sha,size:Buffer.byteLength(remote),encoding:'base64',content:Buffer.from(remote).toString('base64')}};},
  async createOrUpdateFileContents(input){calls++;assert.equal(input.sha,sha);remote=Buffer.from(input.content,'base64').toString('utf8');sha='b'.repeat(40);return {data:{content:{path:spec.path,sha},commit:{sha:'c'.repeat(40)}}};}
 }}};
 const options={dataRoot:root,trust:{current:()=>undefined,canManage:()=>true,canReadHistory:()=>true},
  local:{current:sender=>sender===source?identity:undefined},connections:{adapters:[],shutdownTimeoutMs:5},
  githubFiles:{async client(connection,access){assert.equal(connection.credentialRef,'credential-ref');assert.ok(access?.request);if(prepare)await prepare();return client;}}};
 options.openStore=(path,namespace)=>{
  let store;try{store=openSqliteStore(path,namespace);storageEvents.push({namespace,operation:'open',status:'ok'});}catch(error){failure(namespace,'open',error);throw error;}
  return {...store,read(){try{return store.read();}catch(error){failure(namespace,'read',error);throw error;}},commit(input){try{const result=store.commit(input);if(result.status!=='committed')storageEvents.push({namespace,operation:'commit',status:result.status,reason:result.reason});return result;}catch(error){failure(namespace,'commit',error);throw error;}}};
 };
 const start=async()=>{const host=await startFoundations(options);hosts.push(host);if(host.status!=='ready')console.error('GITHUB_FIXTURE_START',JSON.stringify({diagnostics:host.diagnostics,rootStatus:(await inspectRoot(root,'root')).status,storageEvents}));return host;};
 t.after(async()=>{for(const h of hosts)await h.stop();await rm(root,{recursive:true,force:true});});
 const operation=action=>({resource:'github',action,target,context:null});
 const request=(h,action)=>h.local.bind(source,operation(action));
 const grant=(h,action)=>{
  const history=h.permissions.history({});
  assert.equal(h.permissions.grant({intent:'grant-'+(++grants),expectedRevision:history.revision,scope:{subject:identity.subject,entry:identity.entry,relationship:identity.relationship,relationshipGeneration:1,conversation:null,...operation(action)}}).status,'committed');
 };
 const setup=h=>{assert.equal(h.status,'ready',JSON.stringify({diagnostics:h.diagnostics,storageEvents}));assert.ok(h.connections);assert.equal(h.connections.configs.put({id:'github',adapter:'github',endpoint:'https://api.github.com',credentialRef:'credential-ref',enabled:true},0,'config').status,'ok');};
 const read=h=>h.connections.read('github',request(h,'read'),'github',1,target);
 const put=h=>h.connections.dispatch('github',request(h,'write'),'operation','github',1,target,'write',{kind:'put',message:'update',content:'changed',expectedSha:'a'.repeat(40)});
 return {root,identity,start,setup,grant,request,read,put,calls:()=>calls,remote:()=>remote};
}
test('app optionally assembles GitHub configured reads and writes with real permission grants and durable receipts',async t=>{
 const f=await fixture(t),h=await f.start();f.setup(h);
 assert.equal((await f.read(h)).status,'denied');assert.equal(f.calls(),0);
 f.grant(h,'read');f.grant(h,'write');
 const before=await f.read(h);assert.equal(before.status,'ok','GitHub configured reader must be assembled');assert.equal(before.value.content,'text');
 assert.equal((await f.put(h)).status,'observed');assert.equal(f.remote(),'changed');assert.equal(f.calls(),2);
 assert.equal((await h.stop()).status,'stopped');const reopened=await f.start();assert.equal(reopened.status,'ready');
 assert.equal((await f.put(reopened)).reason,'already_recorded_no_automatic_retry');assert.equal(f.calls(),2);
 assert.equal((await f.read(reopened)).value.content,'changed');
});
test('GitHub app read refuses a disabled connection before requesting an SDK client',async t=>{
 const f=await fixture(t),h=await f.start();f.setup(h);f.grant(h,'read');
 const config=h.connections.configs.get('github');h.connections.configs.put({...config,enabled:false},1,'disable');
 const result=await h.connections.read('github',f.request(h,'read'),'github',2,target);
 assert.equal(result.status,'unavailable');assert.equal(f.calls(),0);
});
test('stopping App while GitHub client is being prepared keeps root locked and prevents late SDK mutation',async t=>{
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 const f=await fixture(t,async()=>{enter();await gate;}),h=await f.start();f.setup(h);f.grant(h,'write');
 const pending=f.put(h);
 assert.equal(await Promise.race([entered.then(()=> 'entered'),pending.then(()=> 'completed')]),'entered');
 assert.equal((await h.stop()).status,'incomplete');assert.equal((await f.start()).status,'failed');
 release();assert.equal((await pending).status,'observed');assert.equal(f.calls(),0);assert.equal(f.remote(),'text');
 assert.equal((await h.stop()).status,'stopped');assert.equal((await f.start()).status,'ready');
});
