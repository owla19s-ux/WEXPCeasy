import test from 'node:test';
import assert from 'node:assert/strict';
import {fauxProvider,fauxAssistantMessage,createProvider} from '@earendil-works/pi-ai';
import {openAICompletionsApi} from '@earendil-works/pi-ai/api/openai-completions.lazy';
import {model,context,choice,frame,end,text,tool,run,localServer} from './harness.mjs';

test('A: official Faux custom provider registers multiple manual models, stream and collected completion',async()=>{
 const f=fauxProvider({provider:'wex-faux',models:[{id:'plain'},{id:'vision',input:['text','image']}],tokensPerSecond:100000});
 f.setResponses([fauxAssistantMessage('one'),fauxAssistantMessage('two')]);
 assert.equal(f.models.length,2);
 const s=f.provider.stream(f.getModel('plain'),context); const events=[];for await(const e of s)events.push(e);
 assert.equal((await s.result()).stopReason,'stop');assert(events.some(e=>e.type==='text_delta'));
 assert.equal((await f.provider.stream(f.getModel('plain'),context).result()).content[0].text,'two');
});
test('A: custom Provider and independent Connection model snapshots do not require tool support',async()=>{
 const p=createProvider({id:'wex-test',baseUrl:model.baseUrl,auth:{},models:[model,{...model,id:'second'}],api:openAICompletionsApi()});
 assert.equal(p.getModels().length,2);assert.equal(p.getModels()[0].id,model.id);
 const server=await localServer((req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.end(text('local')+end());});
 try {const r=await run('',{model:{...model,baseUrl:server.url},fetch:globalThis.fetch,temperature:0,maxTokens:32,samplingParams:{top_p:0.7},reasoningEffort:'low'});
 assert.equal(r.message.stopReason,'stop');assert.equal(server.requests[0].url,'/custom/v1/chat/completions');assert.equal(server.requests[0].body.temperature,0);assert.equal(server.requests[0].body.top_p,0.7);assert.equal(server.requests[0].body.stream,true);
 }finally{await server.close();}
});
test('DEC-01 native byte splits, UTF8, CRLF, comments and multiline data',async()=>{
 const body=': comment\r\nevent: message\r\ndata: {"choices":\r\ndata: [{"index":0,"delta":{"content":"中文🌟"},"finish_reason":null}]}\r\n\r\n'+end();
 const r=await run(body);assert.equal(r.message.stopReason,'stop');assert.equal(r.message.content[0].text,'中文🌟');
});
test('DEC-02 native EOF and DONE alone fail',async()=>{for(const b of ['', 'data: [DONE]\n\n',text('partial')])assert.equal((await run(b)).message.stopReason,'error');});
test('DEC-03 native observed gap: duplicate terminals accepted; length is done(length)',async()=>{
 const r=await run(text('x')+frame(choice({},'length')));assert.equal(r.message.stopReason,'length');assert.equal(r.events.at(-1).type,'done');
 assert.equal((await run(end()+end())).message.stopReason,'stop');
 assert.equal((await run(frame(choice({},'content_filter')))).message.stopReason,'error');
 const duplicate=await run(frame(choice({},'stop'))+frame(choice({},'stop')));assert.equal(duplicate.message.stopReason,'stop');
});
test('DEC-04 native malformed JSON flagged on tool, never implicitly valid',async()=>{
 const r=await run(frame(tool('{"path":'))+frame(choice({},'tool_calls')));
 assert.equal(r.message.content[0].type,'toolCall');assert(r.message.content[0].argumentsError);assert.equal(r.message.stopReason,'toolUse');
});
test('DEC-05 native observed gap: extra choices and content after terminal accepted',async()=>{
 const multi={choices:[{index:0,delta:{content:'first'},finish_reason:null},{index:0,delta:{content:'other'},finish_reason:null}]};
 assert.equal((await run(frame(multi)+end())).message.content[0].text,'first');
 assert.equal((await run(frame(choice({},'stop'))+text('late'))).message.stopReason,'stop');
});
test('REG image: native replaces unsupported user image rather than rejecting',async()=>{
 let payload;const r=await run(text('accepted')+end(),{context:{messages:[{role:'user',content:[{type:'image',data:'AA==',mimeType:'image/png'}],timestamp:1}]},onPayload:p=>{payload=p;}});
 assert.equal(r.message.stopReason,'stop');assert(JSON.stringify(payload).includes('image omitted'));assert(!JSON.stringify(payload).includes('image_url'));
});
test('REG parameters: native unknown option silently ignored; samplingParams can override model',async()=>{
 let payload;await run(end(),{unknownOption:true,samplingParams:{model:'overridden'},onPayload:p=>{payload=p;}});
 assert.equal(payload.model,'overridden');assert(!('unknownOption' in payload));
});
test('REG usage: omitted usage becomes zero-filled, not proof of zero billing',async()=>{
 const r=await run(end());assert.equal(r.message.usage.totalTokens,0);
});
