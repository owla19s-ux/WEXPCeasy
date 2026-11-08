import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './fixture.mjs';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {createOperationLedger} from '../../../dist/connections/src/index.js';
import {createApiTransport} from '../../../dist/connections/api/src/index.js';

test('native Anthropic real probe can be adopted for an unverified manual model, then used without an observer',async t=>{
 let probes=0,generations=0;
 const server=createServer((req,res)=>{
  assert.equal(req.url,'/v1/messages');
  let raw='';req.on('data',part=>raw+=part);req.on('end',()=>{
   const input=JSON.parse(raw);
   assert.equal(input.model,'claude-test');
   assert.equal(input.stream,false);
   const isProbe=input.max_tokens===8;
   if(isProbe)probes++;else {assert.equal(input.max_tokens,64);generations++;}
   res.writeHead(200,{'content-type':'application/json'});
   res.end(JSON.stringify({id:isProbe?'msg_probe':'msg_generation',
    type:'message',role:'assistant',model:'claude-test',
    content:[{type:'text',text:isProbe?'OK':'Native answer'}],stop_reason:'end_turn',
    usage:{input_tokens:2,output_tokens:2}}));
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();server.close();});
 let ledger;
 const f=fixture(t,{readProbeOperation:id=>ledger?.get(id)});
 const connection=f.connection({name:'Anthropic native',provider:'anthropic',protocol:'anthropic-messages',
  endpoint:`http://127.0.0.1:${server.address().port}/v1`,credentialRef:null});
 const model=f.model(connection.id,{name:'Claude',modelId:'claude-test'});
 assert.equal(f.query('model',model.id).value.observation,null);
 const dir=mkdtempSync(join(tmpdir(),'wex-anthropic-probe-'));
 const db=openSqliteStore(join(dir,'operations.sqlite'),'operations');
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 ledger=createOperationLedger(db);
 const transport=createApiTransport(f.service,f.permission,ledger,{
  derivePrepareRequest:request=>{
   const decision=f.permission.evaluate(request);
   return decision.status==='allow'?f.request('request.prepare',decision.scope.target,decision.scope.context):undefined;
  }
 });
 const probe=await transport.probeGeneration(f.request('model.probe',`model:${model.id}`),
  'native-probe',model.id,1,1,3000);
 assert.equal(probe.status,'ok');
 assert.equal(probe.observation.source,'probe');
 const accepted=f.execute({kind:'model.observe',intent:'accept-native-probe',id:model.id,
  expectedRevision:1,probeOperationId:probe.operationId});
 assert.equal(accepted.status,'committed');
 const observed=f.query('model',model.id).value.observation;
 assert.equal(observed.capabilities.text,'supported');
 assert.deepEqual(observed.parameters.max_tokens,{type:'integer',minimum:1});
 const result=await transport.send(f.request('request.send',`model:${model.id}`),'native-generation',{
  requestId:'native-round',connectionId:connection.id,connectionRevision:1,modelId:model.id,
  modelRevision:2,context:null,parameters:{max_tokens:{mode:'value',value:64}},
  messages:[{role:'user',content:'Answer'}],timeoutMs:3000,stream:false
 });
 assert.equal(result.status,'ok');
 assert.equal(result.result.text,'Native answer');
 assert.equal(ledger.get('native-generation').phase,'observed');
 assert.equal(probes,1);assert.equal(generations,1);
});
