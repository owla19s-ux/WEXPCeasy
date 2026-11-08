import test from 'node:test';
import assert from 'node:assert/strict';
import {chatRoute,chatProbeBody,chatHeaders,chatContentType,decodeOpenAiChat,toolProbeDeclaration} from '../../../dist/connections/api/src/protocols/openai-chat.js';

const base={endpoint:'https://api.example.test/v1',endpointMode:'base'};
test('OpenAI Chat routes only append on base endpoints and preserve request-mode URLs',()=>{
 assert.equal(chatRoute(base,'models').href,'https://api.example.test/v1/models');
 assert.equal(chatRoute(base,'completions').href,'https://api.example.test/v1/chat/completions');
 assert.equal(chatRoute({endpoint:'https://api.example.test/prefix/custom',endpointMode:'request'},'completions').href,'https://api.example.test/prefix/custom');
});

test('OpenAI Chat probe constructs text, stream and tool wire formats independently',()=>{
 const model={modelId:'model-one'};
 const text=chatProbeBody(model,{stream:false,tools:false});
 assert.equal(text.model,'model-one');
 assert.equal(text.stream,false);
 assert.equal(text.max_tokens,8);
 assert.equal(Object.hasOwn(text,'tools'),false);
 const tools=chatProbeBody(model,{stream:true,tools:true});
 assert.equal(tools.stream,true);
 assert.equal(tools.max_tokens,64);
 assert.equal(tools.tools[0].function.name,toolProbeDeclaration.name);
 assert.deepEqual(tools.tool_choice,{type:'function',function:{name:toolProbeDeclaration.name}});
});

test('OpenAI Chat content type and authorization follow the selected wire mode',()=>{
 assert.equal(chatContentType(true).test('text/event-stream; charset=utf-8'),true);
 assert.equal(chatContentType(true).test('application/json'),false);
 assert.equal(chatContentType(false).test('application/json; charset=utf-8'),true);
 assert.equal(chatContentType(false).test('text/event-stream'),false);
 assert.deepEqual(chatHeaders(false,undefined,false),{accept:'application/json'});
 assert.deepEqual(chatHeaders(true,'test-token'),{accept:'text/event-stream','content-type':'application/json',authorization:'Bearer test-token'});
});

async function* bytes(text){yield new TextEncoder().encode(text);}
test('OpenAI Chat adapter dispatches to original nonstream and SSE terminal validation',async()=>{
 const json=JSON.stringify({choices:[{index:0,message:{role:'assistant',content:'hello'},finish_reason:'stop'}]});
 assert.equal((await decodeOpenAiChat(bytes(json),false,{})).text,'hello');
 const sse='data: '+json.replace('"message":{"role":"assistant","content":"hello"}','"delta":{"role":"assistant","content":"hello"}')+'\n\ndata: [DONE]\n\n';
 assert.equal((await decodeOpenAiChat(bytes(sse),true,{})).text,'hello');
 await assert.rejects(decodeOpenAiChat(bytes('data: [DONE]\n\n'),true,{}));
});
