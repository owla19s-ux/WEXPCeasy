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
const body='data: {"choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
async function setup(t,handler,connectionPatch={},toolCapability='unknown',credentials){let calls=0;const server=createServer((req,res)=>{calls++;handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
let ledger;
const f=fixture(t,{readProbeOperation:id=>ledger.get(id),observer:{resolve(r,c,m){return {connectionId:c.id,connectionRevision:c.revision,modelId:m.modelId,source:'probe',sourceRevision:'test',observedAt:'2026-11-05T00:00:00Z',capabilities:{text:'supported',stream:'supported',tools:toolCapability,image:'unknown',reasoning:'unknown'},parameters:{}};}}});
const c=f.connection({endpoint:`http://127.0.0.1:${server.address().port}/v1`,credentialRef:null,...connectionPatch}),m=f.model(c.id);f.execute({kind:'model.observe',intent:'observe',id:m.id,expectedRevision:1});
const dir=mkdtempSync(join(tmpdir(),'api-operation-')),db=openSqliteStore(join(dir,'ops.sqlite'),'operations');t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});ledger=createOperationLedger(db);
const transport=createApiTransport(f.service,f.permission,ledger,{derivePrepareRequest:request=>f.request('request.prepare',f.permission.evaluate(request).scope.target),credentials});
const input={requestId:'request',connectionId:c.id,connectionRevision:1,modelId:m.id,modelRevision:2,context:null,parameters:{},messages:[{role:'user',content:'hello'}],timeoutMs:1000,stream:true};
return {f,c,m,transport,ledger,input,request:()=>f.request('request.send',`model:${m.id}`),calls:()=>calls};}
test('real HTTP POST and Operation receipt; replay never calls network twice',async t=>{const h=await setup(t,(req,res)=>{assert.equal(req.method,'POST');assert.equal(req.url,'/v1/chat/completions');assert.equal(req.headers.authorization,undefined);res.writeHead(200,{'content-type':'text/event-stream'});res.end(body);});const r=await h.transport.send(h.request(),'operation',h.input);assert.equal(r.status,'ok');assert.equal(r.result.text,'hello');assert.equal(h.ledger.get('operation').phase,'observed');assert.equal((await h.transport.send(h.request(),'operation',h.input)).status,'blocked');assert.equal(h.calls(),1);});
test('denied and pre-aborted requests never dispatch',async t=>{const h=await setup(t,()=>{});const abort=new AbortController();abort.abort();assert.equal((await h.transport.send(h.request(),'cancel',h.input,abort.signal)).status,'blocked');h.f.revoke();assert.equal((await h.transport.send(h.request(),'denied',h.input)).status,'blocked');assert.equal(h.calls(),0);assert.equal(h.ledger.get('denied'),undefined);});
test('redirects and raw provider errors are never followed or returned',async t=>{const h=await setup(t,(req,res)=>{res.writeHead(302,{location:'/stolen'});res.end('secret provider payload');});const r=await h.transport.send(h.request(),'redirect',h.input);assert.equal(r.status,'unknown');assert.equal(h.calls(),1);assert.equal(JSON.stringify(r).includes('secret'),false);assert.equal(h.ledger.get('redirect').phase,'unknown');});
test('timeout cancels a stalled response and records unknown without retry',async t=>{const h=await setup(t,()=>{});const r=await h.transport.send(h.request(),'timeout',{...h.input,timeoutMs:40});assert.equal(r.status,'unknown');assert.equal(r.reason,'timeout');assert.equal(h.ledger.get('timeout').attempts,1);});
test('revocation during body read suppresses output and records unknown',async t=>{const h=await setup(t,(req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.write(': start\n\n');h.f.revoke();res.end(body);});const r=await h.transport.send(h.request(),'revoked',h.input);assert.equal(r.status,'unknown');assert.equal('result'in r,false);});
test('unsupported secrets fail closed before preparing an Operation',async t=>{const h=await setup(t,()=>{},{credentialRef:{id:'key',revision:1}});const r=await h.transport.send(h.request(),'key',h.input);assert.equal(r.status,'blocked');assert.equal(r.reason,'credential_backend_unavailable');assert.equal(h.calls(),0);assert.equal(h.ledger.get('key'),undefined);});
test('caller abort interrupts a stalled body and stop seals future requests',async t=>{let started;const ready=new Promise(r=>started=r);const h=await setup(t,(req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.write(': waiting\n\n');started();});const abort=new AbortController();const pending=h.transport.send(h.request(),'cancel-mid',h.input,abort.signal);await ready;abort.abort();const r=await pending;assert.equal(r.status,'unknown');assert.equal(r.reason,'cancelled');h.transport.stop();assert.equal((await h.transport.send(h.request(),'after-stop',h.input)).status,'blocked');assert.equal(h.calls(),1);});
test('stop aborts an active request without returning partial content',async t=>{let started;const ready=new Promise(r=>started=r);const h=await setup(t,(req,res)=>{started();});const pending=h.transport.send(h.request(),'stop-mid',h.input);await ready;h.transport.stop();const r=await pending;assert.equal(r.status,'unknown');assert.equal(r.reason,'stopped');assert.equal(h.ledger.get('stop-mid').phase,'unknown');});
test('configuration changes during transport suppress the response',async t=>{const h=await setup(t,(req,res)=>{h.f.execute({kind:'connection.edit',intent:'disable',id:h.c.id,expectedRevision:1,enabled:false});res.writeHead(200,{'content-type':'text/event-stream'});res.end(body);});const r=await h.transport.send(h.request(),'config-change',h.input);assert.equal(r.status,'unknown');assert.equal('result'in r,false);});
test('truncated SSE records unknown and cannot replay',async t=>{const h=await setup(t,(req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.end(body.replace('data: [DONE]\n\n',''));});assert.equal((await h.transport.send(h.request(),'truncated',h.input)).status,'unknown');assert.equal((await h.transport.send(h.request(),'truncated',h.input)).status,'blocked');assert.equal(h.calls(),1);});
test('HTTP classifications never echo provider bodies',async t=>{for(const code of [401,403,429,500]){const h=await setup(t,(req,res)=>{res.writeHead(code);res.end('private-key-provider-error');});const r=await h.transport.send(h.request(),`http-${code}`,h.input);assert.equal(r.status,'unknown');assert.equal(JSON.stringify(r).includes('private-key'),false);assert.equal(h.ledger.get(`http-${code}`).phase,'unknown');}});
test('result persistence failure never returns successful content or retries',async t=>{const h=await setup(t,(req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.end(body);});const ledger={...h.ledger,observe(){return {status:'unknown',reason:'lost_ack'};}};const transport=createApiTransport(h.f.service,h.f.permission,ledger,{derivePrepareRequest:()=>h.f.request('request.prepare',`model:${h.m.id}`)});const r=await transport.send(h.request(),'lost-result',h.input);assert.equal(r.status,'unknown');assert.equal(r.reason,'result_persistence_unconfirmed');assert.equal('result'in r,false);assert.equal((await transport.send(h.request(),'lost-result',h.input)).status,'blocked');assert.equal(h.calls(),1);});
test('different actor in prepare projection and wrong send scope cannot dispatch',async t=>{const h=await setup(t,()=>{});const transport=createApiTransport(h.f.service,h.f.permission,h.ledger,{derivePrepareRequest:()=>h.f.request('request.prepare',`model:${h.m.id}`,null,{subject:'other-user'})});assert.equal((await transport.send(h.request(),'actor',h.input)).reason,'prepare_actor_mismatch');assert.equal((await h.transport.send(h.f.request('write',`model:${h.m.id}`),'scope',h.input)).status,'blocked');assert.equal(h.calls(),0);});
test('nonstream JSON response uses the same authorized snapshot and Operation receipt',async t=>{const h=await setup(t,(req,res)=>{let received='';req.on('data',x=>received+=x);req.on('end',()=>{assert.equal(JSON.parse(received).stream,false);res.writeHead(200,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({choices:[{index:0,message:{role:'assistant',content:'nonstream'},finish_reason:'stop'}],usage:{prompt_tokens:2,completion_tokens:1,total_tokens:3}}));});});const r=await h.transport.send(h.request(),'json',{...h.input,stream:false});assert.equal(r.status,'ok');assert.deepEqual(r.result,{text:'nonstream',usage:{inputTokens:2,outputTokens:1,totalTokens:3}});assert.equal(h.ledger.get('json').phase,'observed');});
test('out-of-range native timer values fail before creating an Operation',async t=>{const h=await setup(t,()=>{});const r=await h.transport.send(h.request(),'bad-timeout',{...h.input,timeoutMs:2147483648});assert.equal(r.status,'blocked');assert.equal(r.reason,'timeout_out_of_range');assert.equal(h.ledger.get('bad-timeout'),undefined);assert.equal(h.calls(),0);});
test('awaiting stop drains active requests before the host closes its ledger',async t=>{let started;const ready=new Promise(r=>started=r);const h=await setup(t,()=>started());const pending=h.transport.send(h.request(),'drain',h.input);await ready;await h.transport.stop();assert.equal(h.ledger.get('drain').phase,'unknown');assert.equal((await pending).reason,'stopped');});
test('JSON transport rejects invalid content type and incomplete responses with no result',async t=>{for(const variant of ['type','truncated','tools']){const h=await setup(t,(req,res)=>{res.writeHead(200,{'content-type':variant==='type'?'text/html':'application/json'});res.end(variant==='truncated'?'{':JSON.stringify({choices:[{index:0,message:{role:'assistant',content:'x',tool_calls:[]},finish_reason:'stop'}]}));});const r=await h.transport.send(h.request(),variant,{...h.input,stream:false});assert.equal(r.status,'unknown');assert.equal('result'in r,false);assert.equal(h.ledger.get(variant).phase,'unknown');}});
test('stop drains multiple in-flight requests and remains idempotent',async t=>{let count=0,started;const ready=new Promise(r=>started=r);const h=await setup(t,()=>{if(++count===2)started();});const a=h.transport.send(h.request(),'drain-a',h.input),b=h.transport.send(h.request(),'drain-b',{...h.input,requestId:'request-b'});await ready;await Promise.all([h.transport.stop(),h.transport.stop()]);assert.equal(h.ledger.get('drain-a').phase,'unknown');assert.equal(h.ledger.get('drain-b').phase,'unknown');assert.equal((await a).status,'unknown');assert.equal((await b).status,'unknown');assert.equal(h.calls(),2);});
test('real JSON and SSE calls return only validated tool proposals and persist them as observations',async t=>{for(const stream of [false,true]){const tools=[{name:'propose_read',parameters:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}}];const call={id:'propose-1',type:'function',function:{name:'propose_read',arguments:'{"path":"a.ts"}'}};const h=await setup(t,(req,res)=>{let body='';req.on('data',x=>body+=x);req.on('end',()=>{const input=JSON.parse(body);assert.equal(input.tools[0].function.name,'propose_read');assert.equal(input.stream,stream);res.writeHead(200,{'content-type':stream?'text/event-stream':'application/json'});res.end(stream?`data: ${JSON.stringify({choices:[{index:0,delta:{tool_calls:[{...call,index:0}]},finish_reason:'tool_calls'}]})}\n\ndata: [DONE]\n\n`:JSON.stringify({choices:[{index:0,message:{role:'assistant',content:null,tool_calls:[call]},finish_reason:'tool_calls'}]}));});},{},'supported');const r=await h.transport.send(h.request(),`proposal-${stream}`,{...h.input,tools,stream});assert.equal(r.status,'ok');assert.deepEqual(r.result.toolCalls,[{id:'propose-1',name:'propose_read',arguments:{path:'a.ts'}}]);assert.equal(h.ledger.get(`proposal-${stream}`).observations[0].value.toolCalls[0].name,'propose_read');assert.equal(h.calls(),1);}});
test('unverified tool capability blocks network dispatch and Operation creation',async t=>{const h=await setup(t,()=>{}),tools=[{name:'read',parameters:{type:'object',properties:{},additionalProperties:false}}];const r=await h.transport.send(h.request(),'unverified-tools',{...h.input,tools});assert.equal(r.status,'blocked');assert.equal(h.calls(),0);assert.equal(h.ledger.get('unverified-tools'),undefined);});
test('invalid tool arguments from real HTTP never become successful output or accepted receipt',async t=>{const h=await setup(t,(req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{index:0,message:{role:'assistant',content:null,tool_calls:[{id:'bad',type:'function',function:{name:'read',arguments:'{"path":3}'}}]},finish_reason:'tool_calls'}]}));},{},'supported');const tools=[{name:'read',parameters:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}}];const r=await h.transport.send(h.request(),'invalid-tools',{...h.input,stream:false,tools});assert.equal(r.status,'unknown');assert.equal('result'in r,false);assert.equal(h.ledger.get('invalid-tools').phase,'unknown');assert.equal(h.calls(),1);});
test('trusted credential port binds exact HTTPS target and keeps token out of the ledger',async t=>{
 const token='fixture-token-123456',requestCalls=[];
 const h=await setup(t,()=>{},{endpoint:'https://provider.example/v1',credentialRef:{id:'key',revision:3}},'unknown',{
  resolve(request,binding){requestCalls.push(request);assert.deepEqual(binding,{reference:{id:'key',revision:3},connectionId:h.c.id,connectionRevision:1,endpoint:'https://provider.example/v1/chat/completions',provider:'deepseek'});return token;}
 });
 const fetch=t.mock.method(globalThis,'fetch',async (url,init)=>{
  assert.equal(url,'https://provider.example/v1/chat/completions');
  assert.equal(init.redirect,'manual');
  assert.equal(init.headers.authorization,'Bearer '+token);
  assert.equal(init.body.includes(token),false);
  return new Response(body,{headers:{'content-type':'text/event-stream'}});
 });
 const request=h.request();
 assert.equal((await h.transport.send(request,'auth',h.input)).status,'ok');
 assert.equal((await h.transport.send(request,'auth',h.input)).status,'blocked');
 assert.deepEqual(requestCalls,[request]);
 assert.equal(fetch.mock.callCount(),1);
 assert.equal(JSON.stringify(h.ledger.get('auth')).includes(token),false);
});
test('credential resolution fails closed on insecure endpoints and revoked send permission',async t=>{
 let resolved=0;
 const insecure=await setup(t,()=>{},{credentialRef:{id:'key',revision:1}},'unknown',{resolve(){resolved++;return 'fixture-token';}});
 assert.equal((await insecure.transport.send(insecure.request(),'insecure',insecure.input)).reason,'credential_requires_https');
 const revoked=await setup(t,()=>{},{endpoint:'https://provider.example/v1',credentialRef:{id:'key',revision:1}},'unknown',{resolve(){resolved++;revoked.f.revoke();return 'fixture-token';}});
 const fetch=t.mock.method(globalThis,'fetch',async()=>{throw Error('must not dispatch');});
 assert.equal((await revoked.transport.send(revoked.request(),'revoked-key',revoked.input)).status,'blocked');
 assert.equal(fetch.mock.callCount(),0);
 assert.equal(resolved,1);
 assert.equal(revoked.ledger.get('revoked-key'),undefined);
});
test('provider echo of the credential is discarded before returning or saving a result',async t=>{
 const token='fixture-echo-token';
 const h=await setup(t,()=>{},{endpoint:'https://provider.example/v1',credentialRef:{id:'key',revision:1}},'unknown',{resolve(){return token;}});
 t.mock.method(globalThis,'fetch',async()=>new Response(body.replace('hello',token),{headers:{'content-type':'text/event-stream'}}));
 const r=await h.transport.send(h.request(),'echo',h.input);
 assert.equal(r.reason,'credential_echoed');
 assert.equal(JSON.stringify([r,h.ledger.get('echo')]).includes(token),false);
});

test('directory refresh records remote IDs without registering or verifying models',async t=>{
 const h=await setup(t,(req,res)=>{
  assert.equal(req.method,'GET');
  assert.equal(req.url,'/v1/models');
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({data:[{id:'remote-model',owned_by:'provider'}]}));
 });
 const request=h.f.request('directory.refresh',`connection:${h.c.id}`);
 const r=await h.transport.refreshDirectory(request,'directory',h.c.id,1,1000);
 assert.equal(r.status,'ok');
 assert.deepEqual(r.observation.modelIds,['remote-model']);
 assert.equal(r.observation.connectionRevision,1);
 assert.equal(h.ledger.get('directory').phase,'observed');
 const list=h.f.service.query(h.f.request('model.list',`connection:${h.c.id}`),{kind:'models',connectionId:h.c.id});
 assert.deepEqual(list.value.map(m=>m.modelId),['chat-model']);
 assert.equal((await h.transport.refreshDirectory(request,'directory',h.c.id,1,1000)).status,'blocked');
 assert.equal(h.calls(),1);
});

test('directory refresh requires its own grant and distinguishes authentication and malformed listings',async t=>{
 let code=401;
 const h=await setup(t,(req,res)=>{
  res.writeHead(code,{'content-type':'application/json'});
  res.end(JSON.stringify({data:[{id:'duplicate'},{id:'duplicate'}]}));
 });
 const request=h.f.request('directory.refresh',`connection:${h.c.id}`);
 assert.equal((await h.transport.refreshDirectory(h.request(),'wrong-grant',h.c.id,1,1000)).status,'blocked');
 assert.equal(h.calls(),0);
 assert.equal((await h.transport.refreshDirectory(request,'auth-failed',h.c.id,1,1000)).reason,'provider_authorization');
 code=200;
 assert.equal((await h.transport.refreshDirectory(request,'bad-list',h.c.id,1,1000)).reason,'invalid_model_directory');
 assert.equal(h.ledger.get('bad-list').phase,'unknown');
});

test('directory refresh cancels during host shutdown and records an unknown receipt',async t=>{
 let started;
 const ready=new Promise(resolve=>{started=resolve;});
 const h=await setup(t,()=>started());
 const request=h.f.request('directory.refresh',`connection:${h.c.id}`);
 const result=h.transport.refreshDirectory(request,'directory-stop',h.c.id,1,1000);
 await ready;
 await h.transport.stop();
 assert.equal((await result).reason,'stopped');
 assert.equal(h.ledger.get('directory-stop').phase,'unknown');
});

test('generation probe verifies an unobserved model with a fixed minimal request',async t=>{
 const h=await setup(t,async (req,res)=>{
  const chunks=[];
  for await(const chunk of req)chunks.push(chunk);
  const request=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(req.method,'POST');
  assert.equal(req.url,'/v1/chat/completions');
  assert.deepEqual(request,{model:'unverified-model',messages:[{role:'user',content:'Reply with OK.'}],stream:false,max_tokens:8});
  res.writeHead(200,{'content-type':'application/json','x-request-id':'probe-provider-123'});
  res.end(JSON.stringify({choices:[{index:0,message:{role:'assistant',content:'OK'},finish_reason:'stop'}]}));
 });
 const model=h.f.model(h.c.id,{modelId:'unverified-model'});
 const request=h.f.request('model.probe',`model:${model.id}`);
 const r=await h.transport.probeGeneration(request,'probe',model.id,1,1,1000);
 assert.equal(r.status,'ok');
 assert.equal(r.observation.source,'probe');
 assert.equal(r.observation.modelId,model.id);
 assert.equal(r.observation.usage,null);
 assert.equal(r.observation.providerRequestId,'probe-provider-123');
 assert.equal(h.ledger.get('probe').phase,'observed');
 assert.equal(h.f.query('model',model.id).value.observation,null);
 assert.equal((await h.transport.probeGeneration(request,'probe',model.id,1,1,1000)).status,'blocked');
 assert.equal(h.calls(),1);
});

test('generation probe requires an exact grant and both current revisions',async t=>{
 const h=await setup(t,()=>{throw Error('must not dispatch');});
 const request=h.f.request('model.probe',`model:${h.m.id}`);
 assert.equal((await h.transport.probeGeneration(h.request(),'wrong-action',h.m.id,1,2,1000)).status,'blocked');
 assert.equal((await h.transport.probeGeneration(request,'old-model',h.m.id,1,1,1000)).reason,'model_revision_changed');
 assert.equal((await h.transport.probeGeneration(request,'old-connection',h.m.id,2,2,1000)).reason,'configuration_changed_or_disabled');
 assert.equal(h.calls(),0);
});

test('generation probe treats provider failure as a diagnostic receipt without changing the model',async t=>{
 const h=await setup(t,(req,res)=>{
  res.writeHead(429,{'content-type':'application/json','x-request-id':'limited-provider-123'});
  res.end(JSON.stringify({error:'private response body'}));
 });
 const request=h.f.request('model.probe',`model:${h.m.id}`);
 const r=await h.transport.probeGeneration(request,'limited-probe',h.m.id,1,2,1000);
 assert.equal(r.reason,'provider_rate_limited');
 assert.equal(h.ledger.get('limited-probe').phase,'unknown');
 assert.equal(h.ledger.get('limited-probe').observations[0].value.providerRequestId,'limited-provider-123');
 assert.equal(JSON.stringify(h.ledger.get('limited-probe')).includes('private response body'),false);
 assert.equal(h.f.query('model',h.m.id).value.revision,2);
});

test('adopting a trusted probe enables ordinary nonstream text for an unverified model',async t=>{
 const h=await setup(t,(req,res)=>{
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({choices:[{index:0,message:{role:'assistant',content:'OK'},finish_reason:'stop'}]}));
 });
 const model=h.f.model(h.c.id,{modelId:'new-manual-model'});
 const target=`model:${model.id}`;
 const probe=h.f.request('model.probe',target);
 assert.equal((await h.transport.probeGeneration(probe,'evidence',model.id,1,1,1000)).status,'ok');
 const other=h.f.model(h.c.id,{modelId:'different-model'});
 assert.equal(h.f.execute({kind:'model.observe',intent:'wrong-model',id:other.id,expectedRevision:1,probeOperationId:'evidence'}).reason,'probe_evidence_mismatch');
 const cmd={kind:'model.observe',intent:'adopt-evidence',id:model.id,expectedRevision:1,probeOperationId:'evidence'};
 const adopted=h.f.execute(cmd);
 assert.equal(adopted.status,'committed');
 assert.deepEqual(h.f.execute(cmd),adopted);
 const record=h.f.query('model',model.id).value;
 assert.equal(record.observation.sourceRevision,'evidence');
 assert.deepEqual(record.observation.capabilities,{text:'supported',stream:'unknown',tools:'unknown',image:'unknown',reasoning:'unknown'});
 const request=h.f.request('request.send',target);
 const input={...h.input,modelId:model.id,modelRevision:2};
 assert.equal((await h.transport.send(request,'stream-unverified',input)).status,'blocked');
 assert.equal((await h.transport.send(request,'text-verified',{...input,stream:false})).status,'ok');
 assert.equal(h.calls(),2);
});

test('probe evidence cannot be adopted after its connection revision changes',async t=>{
 const h=await setup(t,(req,res)=>{
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({choices:[{index:0,message:{role:'assistant',content:'OK'},finish_reason:'stop'}]}));
 });
 const probe=h.f.request('model.probe',`model:${h.m.id}`);
 assert.equal((await h.transport.probeGeneration(probe,'stale-evidence',h.m.id,1,2,1000)).status,'ok');
 assert.equal(h.f.execute({kind:'connection.edit',intent:'edit-connection',id:h.c.id,expectedRevision:1,name:'edited'}).status,'committed');
 const result=h.f.execute({kind:'model.observe',intent:'adopt-stale',id:h.m.id,expectedRevision:2,probeOperationId:'stale-evidence'});
 assert.equal(result.reason,'probe_evidence_mismatch');
 assert.equal(h.f.query('model',h.m.id).value.revision,2);
});
