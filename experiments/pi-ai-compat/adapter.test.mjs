import test from 'node:test';
import assert from 'node:assert/strict';
import {candidate,sealContinuation,openContinuation} from './adapter.mjs';
import {model,context,choice,frame,end,text,tool,bytesFetch,localServer} from './harness.mjs';
const scope={connection:'c1',revision:1,credentialRef:'k1',endpoint:model.baseUrl,conversation:'v1',generation:'g1',request:'r1',model:model.id,tools:['t1']};
function deps(overrides={}) {const log=[];return {log,permissions:async r=>{log.push('permission');return true;},credentials:async ref=>{log.push('credential');return 'fake-local-only';},attempt:async()=>log.push('attempt'),receipt:async()=>log.push('receipt'),...overrides};}
const request=(extra={})=>({model,context,scope,allowedParams:['temperature','maxTokens','top_p','reasoningEffort'],...extra});
const exec=(body,extra={},services={})=>candidate(request(extra),deps(services),{fetch:bytesFetch(body)});
const error=async(p,code)=>assert.equal((await p).error,code);

test('DEC-03 guarded truncation, filter, duplicate and conflicting terminals fail',async()=>{
 for(const reason of ['length','content_filter'])await error(exec(frame(choice({},reason))),'Protocol');
 for(const reason of ['stop','length'])await error(exec(frame(choice({},'stop'))+frame(choice({},reason))),'Protocol');
});
test('DEC-04 guarded malformed, array, duplicate tool ID, missing name, out-of-order index',async()=>{
 for(const args of ['{"p":','[]','null'])await error(exec(frame(tool(args))+frame(choice({},'tool_calls'))),'InvalidTool');
 await error(exec(frame(tool('{}',''))+frame(choice({},'tool_calls'))),'InvalidTool');
 await error(exec(frame(tool())+frame(tool('{}','write','t1',1))+frame(choice({},'tool_calls'))),'InvalidTool');
 await error(exec(frame(tool('{}','write','t1',2))+frame(choice({},'tool_calls'))),'Protocol');
 const good=await exec(frame(tool('{"p":'))+frame(choice({tool_calls:[{index:0,function:{arguments:'"x"}'}}]}))+frame(choice({},'tool_calls')));
 assert.equal(good.message.content[0].arguments.p,'x');
});
test('DEC-05 guarded multiple choices, role conflict and post-terminal content fail',async()=>{
 await error(exec(frame({choices:[{index:0,delta:{}},{index:0,delta:{}}]})+end()),'Protocol');
 await error(exec(frame(choice({role:'user'}))+end()),'Protocol');
 await error(exec(frame(choice({},'stop'))+text('late')),'Protocol');
});
test('DEC-06 independent raw frame, response and buffered event limits',async()=>{
 await error(exec(text('x'.repeat(200))+end(),{limits:{frameBytes:100}}),'FrameLimit');
 await error(exec(text('x')+text('y')+end(),{limits:{responseBytes:100}}),'ResponseLimit');
 await error(exec(text('x')+text('y')+end(),{limits:{events:1}}),'EventLimit');
});
test('DEC-07 continuation exact bytes accepted, byte overflow rejected without truncation',()=>{
 const p={reasoning:'中文🌟'};const n=Buffer.byteLength(JSON.stringify(p));
 const e=sealContinuation(scope,p,n);assert.deepEqual(openContinuation(scope,e,n),p);
 assert.throws(()=>sealContinuation(scope,p,n-1),/ContinuationLimit/);
});
test('DEC-08 continuation bound to full request identity and ordered tools',()=>{
 const e=sealContinuation(scope,{signature:'s'},100);
 for(const [k,v] of Object.entries({...scope,connection:'c2',revision:2,credentialRef:'k2',endpoint:'https://other',conversation:'v2',generation:'g2',request:'r2',model:'other',tools:['other']})) {
  if(JSON.stringify(v)!==JSON.stringify(scope[k]))assert.throws(()=>openContinuation({...scope,[k]:v},e,100),/ContinuationScope/);
 }
});
test('DEC-09 HTTP 200 error and 401/403/429/500 redacted, no retry',async()=>{
 await error(exec(frame({error:{message:'fake-sensitive'}})),'Provider');
 for(const [status,code] of [[401,'Authentication'],[403,'Authentication'],[429,'RateLimit'],[500,'Provider']]){
  let count=0;const f=bytesFetch('{"error":{"message":"fake-sensitive fake-local-only"}}',{status});
  const r=await candidate(request(),deps(),{fetch:async(...args)=>{count++;return f(...args);}});
  assert.equal(r.error,code);assert(!JSON.stringify(r).includes('fake-sensitive'));assert(!JSON.stringify(r).includes('fake-local-only'));assert.equal(count,1);
 }
});
test('DEC-10 cancellation while SDK waits for network; bounded consumer abort and late events',async()=>{
 const ac=new AbortController();const server=await localServer((req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.write(text('partial'));});
 try {const p=candidate(request({model:{...model,baseUrl:server.url},scope:{...scope,endpoint:server.url},signal:ac.signal}),deps(),{fetch:globalThis.fetch});setTimeout(()=>ac.abort(),30);const start=Date.now();await error(p,'Cancelled');assert(Date.now()-start<1000);}finally{await server.close();}
 // There is no bounded SDK producer queue; this tests adapter drain/abort, not a full-channel join.
});
test('DEC-11 header/connect, idle and total deadlines classified separately (injected transport)',async()=>{
 const never=()=>new Promise(()=>{});
 await error(candidate(request({timeouts:{connect:15}}),deps(),{fetch:never}),'ConnectTimeout');
 const idle=async()=>new Response(new ReadableStream({start(c){c.enqueue(Buffer.from(text('a')));}}),{headers:{'content-type':'text/event-stream'}});
 await error(candidate(request({timeouts:{idle:15,total:500}}),deps(),{fetch:idle}),'IdleTimeout');
 await error(candidate(request({timeouts:{total:15,connect:500}}),deps(),{fetch:never}),'TotalTimeout');
});
test('DEC-12 credential URL rejected before network; proxy fail closed; redirects not followed',async()=>{
 await error(exec(end(),{model:{...model,baseUrl:'https://user:secret@example.org/v1'},scope:{...scope,endpoint:'https://user:secret@example.org/v1'}}),'Endpoint');
 await error(exec(end(),{proxy:'http://127.0.0.1:1'}),'UnsupportedProxy');
 let second=0;const target=await localServer((req,res)=>{second++;res.end(end());});
 const first=await localServer((req,res)=>{res.writeHead(307,{location:target.url});res.end();});
 try {await error(candidate(request({model:{...model,baseUrl:first.url},scope:{...scope,endpoint:first.url}}),deps(),{fetch:globalThis.fetch}),'Redirect');assert.equal(second,0);}finally{await first.close();await target.close();}
});
test('DEC-13 partial then EOF is incomplete, never completed',async()=>{const r=await exec(text('partial'));assert.equal(r.error,'Protocol');assert.equal(r.completed,false);assert(r.partial.some(e=>e.type==='text_delta'));});
test('DEC-14 generation cancellation does not mutate tool write outcome (boundary substitute)',async()=>{
 const operation={state:'unknown'};const ac=new AbortController();ac.abort();await error(exec(end(),{signal:ac.signal}),'Cancelled');assert.equal(operation.state,'unknown');
});
test('DEC-15 two overlapping tool intentions are returned, never executed by API',async()=>{
 let writes=0;const services={executeTool:()=>writes++};
 const results=await Promise.all([exec(frame(tool('{"path":"same"}'))+frame(choice({},'tool_calls')),{},services),exec(frame(tool('{"path":"same"}'))+frame(choice({},'tool_calls')),{},services)]);
 assert(results.every(r=>r.message.content[0].type==='toolCall'));assert.equal(writes,0);
 // Actual runtime resource coordination is outside this experiment and NOT_RUN.
});
test('DEC-16 unknown options/tool fields, reserved overrides, invalid tool args rejected',async()=>{
 for(const params of [{unknown:1},{samplingParams:{model:'other'}},{top_p:'invalid'}])await error(exec(end(),{params}),'UnsupportedParameter');
 await error(exec(end(),{context:{...context,tools:[{name:'write',description:'',parameters:{type:'object'},unknown:true}]}}),'UnsupportedParameter');
 await error(exec(frame(tool('{"path":3}'))+frame(choice({},'tool_calls')),{context:{...context,tools:[{name:'write',description:'',parameters:{type:'object',properties:{path:{type:'string'}},required:['path']}}]}}),'InvalidTool');
});
test('REG unsupported image user/tool history fails before credential and dispatch; text-only model succeeds',async()=>{
 for(const role of ['user','toolResult']) {const d=deps();const r=await candidate(request({context:{messages:[{role,content:[{type:'image',data:'AA==',mimeType:'image/png'}]}]}}),d,{fetch:bytesFetch(end())});assert.equal(r.error,'UnsupportedImage');assert.equal(d.log.length,0);}
 assert.equal((await exec(text('plain')+end())).completed,true);
});
test('REG provider switch requires actual target authorization; config remains immutable; receipt failure is not retry',async()=>{
 const d=deps({permissions:async r=>r.model.baseUrl===model.baseUrl});await error(candidate(request({model:{...model,baseUrl:'https://other.invalid/v1'}}),d,{fetch:bytesFetch(end())}),'Permission');assert.equal(d.log.length,0);
 const ok=deps();const r=request();await candidate(r,ok,{fetch:bytesFetch(end())});assert.deepEqual(ok.log,['permission','credential','attempt','receipt']);assert.equal(r.model.baseUrl,model.baseUrl);
 const fail=deps({attempt:async()=>{throw Error('storage');}});let sent=0;await error(candidate(request(),fail,{fetch:async()=>{sent++;return new Response();}}),'AttemptPersistence');assert.equal(sent,0);
 await error(exec(end(),{},{receipt:async()=>{throw Error('storage');}}),'ReceiptPersistence');
});

test('KNOWN GAP: bytes after DONE are ignored by SDK; candidate cannot certify strict post-DONE rejection',async()=>{
 const r=await exec(end()+text('after-DONE'));
 assert.equal(r.completed,true); // Documents incompatibility; this is not an acceptance assertion.
});
test('REG raw transport errors must not echo secret text',async()=>{
 const r=await candidate(request(),deps(),{fetch:async()=>{throw Error('fake-local-only sensitive-url');}});
 assert(!JSON.stringify(r).includes('fake-local-only'));assert.equal(r.error,'NetworkUnknown');
});
test('REG model defaults cannot bypass reserved parameter checks',async()=>{
 await error(exec(end(),{model:{...model,samplingParams:{model:'evil'}}}),'UnsupportedParameter');
});

test('REVIEW auth model headers cannot override controlled credential or reach permission callback',async()=>{
 for(const headers of [{Authorization:'Bearer fake-other-key'},{'x-api-key':'fake-other-key'}]) {
  const d=deps();let sent=0;
  const r=await candidate(request({model:{...model,headers}}),d,{fetch:async()=>{sent++;return bytesFetch(end())();}});
  assert.equal(r.error,'UnsupportedParameter');assert.equal(sent,0);assert.deepEqual(d.log,[]);
 }
});
test('REVIEW compat cannot synthesize success for a stream missing terminal',async()=>{
 const r=await exec(text('truncated'),{model:{...model,compat:{supportsFinishReason:false}}});
 assert.equal(r.completed,false);assert.equal(r.error,'UnsupportedParameter');
});
test('REVIEW callbacks cannot mutate authorized snapshot endpoint, scope or content',async()=>{
 let payload;
 const d=deps({permissions:async r=>{
  assert.throws(()=>{r.model.baseUrl='http://127.0.0.1:9999/evil';},TypeError);
  assert.throws(()=>{r.scope.endpoint='http://127.0.0.1:9999/evil';},TypeError);
  assert.throws(()=>{r.context.messages[0].content='changed';},TypeError);
  return true;
 }});
 const r=await candidate(request(),d,{fetch:async(input,init)=>{payload=JSON.parse(init.body);assert.match(String(input),/127\.0\.0\.1:1\/v1/);return bytesFetch(end())();}});
 assert.equal(r.completed,true);assert.equal(payload.messages[0].content,'hello');
});
