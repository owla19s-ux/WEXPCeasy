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

const event=(name,value)=>'event: '+name+'\ndata: '+JSON.stringify({type:name,...value})+'\n\n';
async function setup(t,respond){
 const server=createServer(respond);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>{server.closeAllConnections();server.close();});
 const f=fixture(t,{observer:{resolve(_request,c,m){
  return {connectionId:c.id,connectionRevision:c.revision,modelId:m.modelId,source:'probe',sourceRevision:'native-test',
   observedAt:'2026-11-08T00:00:00Z',
   capabilities:{text:'supported',stream:'supported',tools:'supported',image:'unknown',reasoning:'unknown'},
   parameters:{max_tokens:{type:'integer',minimum:1,maximum:1024}}};
 }}});
 const connection=f.connection({name:'Anthropic',provider:'anthropic',protocol:'anthropic-messages',
  endpoint:`http://127.0.0.1:${server.address().port}/v1`,credentialRef:null});
 const model=f.model(connection.id,{modelId:'claude-test'});
 assert.equal(f.execute({kind:'model.observe',intent:'native-observe',id:model.id,expectedRevision:1}).status,'committed');
 const dir=mkdtempSync(join(tmpdir(),'wex-native-operation-'));
 const db=openSqliteStore(join(dir,'ops.sqlite'),'operations');
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 const ledger=createOperationLedger(db);
 const transport=createApiTransport(f.service,f.permission,ledger,{
  derivePrepareRequest:request=>{
   const d=f.permission.evaluate(request);return d.status==='allow'
    ?f.request('request.prepare',d.scope.target,d.scope.context,{conversation:d.scope.conversation}):undefined;
  }
 });
 const input={requestId:'anthropic-request',connectionId:connection.id,connectionRevision:1,modelId:model.id,
  modelRevision:2,context:null,parameters:{max_tokens:{mode:'value',value:64}},
  messages:[{role:'system',content:'Be concise'},{role:'user',content:'Hello'}],timeoutMs:4000,stream:false};
 return {f,ledger,transport,input,sendRequest:()=>f.request('request.send',`model:${model.id}`),connection,model};
}
const response={id:'msg_native',type:'message',role:'assistant',model:'claude-test',
 content:[{type:'text',text:'Hello native'}],stop_reason:'end_turn',
 usage:{input_tokens:5,output_tokens:2}};

test('native Anthropic message uses its own endpoint and wire body, preserving Operation receipt',async t=>{
 let seen=0;
 const h=await setup(t,(req,res)=>{
  seen++;assert.equal(req.url,'/v1/messages');assert.equal(req.method,'POST');
  assert.equal(req.headers['anthropic-version'],'2023-06-01');
  assert.equal(req.headers.authorization,undefined);
  let payload='';req.on('data',chunk=>payload+=chunk);req.on('end',()=>{
   assert.deepEqual(JSON.parse(payload),{model:'claude-test',stream:false,max_tokens:64,
    messages:[{role:'user',content:'Hello'}],system:'Be concise'});
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(response));
  });
 });
 const result=await h.transport.send(h.sendRequest(),'native-json',h.input);
 assert.equal(result.status,'ok');
 assert.equal(result.result.text,'Hello native');
 assert.equal(result.result.providerResponseId,'msg_native');
 assert.deepEqual(result.result.usage,{inputTokens:5,outputTokens:2,totalTokens:7});
 assert.equal(h.ledger.get('native-json').phase,'observed');
 assert.equal((await h.transport.send(h.sendRequest(),'native-json',h.input)).status,'blocked');
 assert.equal(seen,1);
});

test('native Anthropic SSE publishes text before terminal and retains usage',async t=>{
 let release;
 const barrier=new Promise(resolve=>release=resolve);
 let first;
 const published=new Promise(resolve=>first=resolve);
 const h=await setup(t,(req,res)=>{
  req.resume();
  res.writeHead(200,{'content-type':'text/event-stream'});
  res.write(event('message_start',{message:{id:'msg_stream',type:'message',role:'assistant',
   model:'claude-test',content:[],usage:{input_tokens:5,output_tokens:0}}}));
  res.write(event('content_block_start',{index:0,content_block:{type:'text',text:''}}));
  res.write(event('content_block_delta',{index:0,delta:{type:'text_delta',text:'First'}}));
  barrier.then(()=>{
   res.end(event('content_block_stop',{index:0})
    +event('message_delta',{delta:{stop_reason:'end_turn'},usage:{output_tokens:2}})
    +event('message_stop',{}));
  });
 });
 const delta=[];
 const ongoing=h.transport.send(h.sendRequest(),'native-sse',{...h.input,stream:true},undefined,
  part=>{delta.push(part);first();});
 await published;
 assert.deepEqual(delta,['First']);
 release();
 const result=await ongoing;
 assert.equal(result.status,'ok');
 assert.equal(result.result.text,'First');
 assert.equal(h.ledger.get('native-sse').phase,'observed');
});

test('native Anthropic directory and text probe use their own wire paths and keep tools blocked',async t=>{
 let calls=0;
 const h=await setup(t,(req,res)=>{
  calls++;
  if(req.url==='/v1/models'){
   assert.equal(req.method,'GET');
   res.writeHead(200,{'content-type':'application/json'});
   res.end(JSON.stringify({data:[{id:'claude-test',type:'model'}],has_more:false}));
  }else{
   assert.equal(req.url,'/v1/messages');
   assert.equal(req.method,'POST');
   let received='';req.on('data',part=>received+=part);req.on('end',()=>{
    const body=JSON.parse(received);
    assert.equal(body.max_tokens,8);
    assert.equal(body.stream,false);
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify(response));
   });
  }
 });
 const directory=await h.transport.refreshDirectory(
  h.f.request('directory.refresh',`connection:${h.connection.id}`),'native-dir',h.connection.id,1,1000);
 assert.equal(directory.status,'ok');
 assert.deepEqual(directory.observation.modelIds,['claude-test']);
 const probe=await h.transport.probeGeneration(
  h.f.request('model.probe',`model:${h.model.id}`),'native-probe',h.model.id,1,2,1000);
 assert.equal(probe.status,'ok');
 assert.equal(probe.observation.modelId,h.model.id);
 assert.equal(h.ledger.get('native-probe').phase,'observed');
 const toolProbe=await h.transport.probeGeneration(
  h.f.request('model.probe',`model:${h.model.id}`),'native-tool-probe',h.model.id,1,2,1000,undefined,'tools');
 assert.equal(toolProbe.status,'blocked');
 const tools=[{name:'read',parameters:{type:'object',properties:{},additionalProperties:false}}];
 const unsupported=await h.transport.send(h.sendRequest(),'native-tools',{...h.input,tools});
 assert.equal(unsupported.status,'blocked');
 assert.equal(unsupported.reason,'unsupported_protocol_input');
 assert.equal(h.ledger.get('native-tools'),undefined);
 assert.equal(calls,2);
});
