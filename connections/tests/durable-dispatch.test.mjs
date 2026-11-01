import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Separate Node processes use the real permission store, operation ledger and
// dispatch boundary. Only the external protocol is a local append-only fixture.
const child=`
import {appendFileSync} from 'node:fs';
import {openSqliteStore} from './dist/shared/src/index.js';
import {createPermissions} from './dist/permissions/src/index.js';
import {createDispatchBoundary,createOperationLedger} from './dist/connections/src/index.js';
const [database,output,mode]=process.argv.slice(1);
const scope={subject:'user',entry:'conversation',conversation:'c',context:null,resource:'fixture',target:output,action:'write',relationship:'direct',relationshipGeneration:1};
const request={};
const policyStore=openSqliteStore(database,'permissions'),operationStore=openSqliteStore(database,'operations');
try{
 const permission=createPermissions(policyStore,{current:r=>r===request?{...scope,kind:'conversation',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true}:undefined,canManage:()=>true,canReadHistory:()=>true});
 if(mode==='initial'||mode==='initial-unknown')permission.grant({scope,intent:'grant',expectedRevision:0});
 if(mode==='revoke')permission.revoke({scope,intent:'revoke',expectedRevision:1});
 const ledger=createOperationLedger(operationStore);
 const adapter={id:'fixture',async execute(target,payload){appendFileSync(target,payload.text);if(mode==='initial-unknown')throw Error('lost remote acknowledgment');return {written:true};}};
 const result=await createDispatchBoundary(permission,ledger,adapter).dispatch(request,mode==='revoke'?'new-op':'op',output,'intent',{text:'once\\n'});
 console.log(JSON.stringify({result,operation:ledger.get('op')}));
}finally{policyStore.close();operationStore.close();}
`;
test('process restart preserves authorization, observed receipt and no-replay guarantee',t=>{
 const dir=mkdtempSync(join(tmpdir(),'wex-dispatch-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const database=join(dir,'state.sqlite'),output=join(dir,'external-effect.txt');
 function run(mode){
  const p=spawnSync(process.execPath,['--input-type=module','-e',child,database,output,mode],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);
 }
 assert.equal(run('initial').result.status,'observed');
 const restored=run('restart');
 assert.equal(restored.result.reason,'already_recorded_no_automatic_retry');
 assert.equal(restored.operation.phase,'observed');
 assert.equal(restored.operation.attempts,1);
 assert.deepEqual(restored.operation.observations,[{id:'result',phase:'observed',value:{written:true}}]);
 assert.equal(run('revoke').result.reason,'authorization_deny');
 assert.equal(readFileSync(output,'utf8'),'once\n');
});

test('unknown external outcome survives restart without repeating its side effect',t=>{
 const dir=mkdtempSync(join(tmpdir(),'wex-unknown-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const database=join(dir,'state.sqlite'),output=join(dir,'external-effect.txt');
 function run(mode){
  const p=spawnSync(process.execPath,['--input-type=module','-e',child,database,output,mode],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);
 }
 assert.equal(run('initial-unknown').result.status,'unknown');
 const restored=run('restart');
 assert.equal(restored.result.reason,'already_recorded_no_automatic_retry');
 assert.equal(restored.operation.phase,'unknown');
 assert.equal(restored.operation.attempts,1);
 assert.equal(readFileSync(output,'utf8'),'once\n');
});
