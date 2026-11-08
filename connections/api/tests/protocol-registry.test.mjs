import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveApiProtocol,supportedApiProtocols} from '../../../dist/connections/api/src/protocols/index.js';

test('protocol selection depends on explicit protocol ID, never the Provider name',()=>{
 assert.deepEqual(supportedApiProtocols(),['openai-chat','anthropic-messages']);
 const native=resolveApiProtocol('anthropic-messages');
 assert.equal(native?.supportsDirectory,true);
 assert.equal(native?.supportsProbe,true);
 assert.equal(native?.supportsToolProbe,false);
 assert.equal(native?.diagnosticVersion(),'anthropic-messages-models-1');
 assert.equal(native?.diagnosticVersion({stream:false,tools:false}),'anthropic-messages-probe-1');
 assert.equal(native?.generationVersion,'anthropic-messages-text-1');
 const adapter=resolveApiProtocol('openai-chat');
 assert.equal(adapter?.id,'openai-chat');
 assert.equal(resolveApiProtocol('anthropic-message'),undefined);
 assert.equal(resolveApiProtocol('deepseek'),undefined);
 assert.equal(resolveApiProtocol('OpenAI'),undefined);
 assert.equal(resolveApiProtocol('toString'),undefined);
 assert.equal(resolveApiProtocol('__proto__'),undefined);
});

test('registered Chat adapter retains route, diagnostic versions, and probe encoding',()=>{
 const adapter=resolveApiProtocol('openai-chat');
 assert.ok(adapter);
 const connection={endpoint:'https://api.example.test/v1',endpointMode:'base'};
 assert.equal(adapter.route(connection,'completions').href,'https://api.example.test/v1/chat/completions');
 assert.equal(adapter.route(connection,'models').href,'https://api.example.test/v1/models');
 assert.equal(adapter.generationVersion,'openai-chat-text-1');
 assert.equal(adapter.diagnosticVersion(),'openai-chat-models-1');
 assert.equal(adapter.diagnosticVersion({stream:false,tools:false}),'openai-chat-probe-1');
 assert.equal(adapter.diagnosticVersion({stream:true,tools:false}),'openai-chat-stream-probe-1');
 assert.equal(adapter.diagnosticVersion({stream:false,tools:true}),'openai-chat-tool-probe-1');
 assert.equal(adapter.diagnosticVersion({stream:true,tools:true}),'openai-chat-stream-tool-probe-1');
 assert.equal(adapter.probeBody({modelId:'model-x'},{stream:true,tools:true}).tools[0].function.name,'wex_probe');
 assert.deepEqual(adapter.directory('{"data":[{"id":"model-x"}]}'),['model-x']);
 assert.equal(adapter.contentType(true).test('text/event-stream'),true);
 assert.equal(adapter.headers(false,undefined).accept,'application/json');
});

test('Chat adapter validates both JSON and SSE through selected protocol',async()=>{
 const adapter=resolveApiProtocol('openai-chat');
 assert.ok(adapter);
 const bytes=async function* (text){yield new TextEncoder().encode(text);};
 const nonstream=JSON.stringify({choices:[{index:0,message:{role:'assistant',content:'ok'},finish_reason:'stop'}]});
 assert.equal((await adapter.decode(bytes(nonstream),false,{})).text,'ok');
 const sse='data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
 assert.equal((await adapter.decode(bytes(sse),true,{})).text,'ok');
 await assert.rejects(adapter.decode(bytes('data: [DONE]\n\n'),true,{}));
});
