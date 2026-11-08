import test from 'node:test';
import assert from 'node:assert/strict';
import {anthropicRoute,anthropicHeaders,encodeAnthropicMessages,decodeAnthropicMessages,decodeAnthropicDirectory,anthropicProbeBody} from '../../../dist/connections/api/src/protocols/anthropic-messages.js';

async function* bytes(value){yield new TextEncoder().encode(value);}
const response={id:'msg_123',type:'message',role:'assistant',model:'claude-test',content:[{type:'text',text:'Hello'}],stop_reason:'end_turn',usage:{input_tokens:3,output_tokens:2}};
const event=(name,value)=>'event: '+name+'\ndata: '+JSON.stringify({type:name,...value})+'\n\n';

test('Anthropic route and credential headers are independent of OpenAI Chat',()=>{
 assert.equal(anthropicRoute({endpoint:'https://api.anthropic.com/v1',endpointMode:'base'}).href,'https://api.anthropic.com/v1/messages');
 assert.equal(anthropicRoute({endpoint:'https://example.test/custom',endpointMode:'request'}).href,'https://example.test/custom');
 assert.equal(anthropicHeaders(false,'key-test')['x-api-key'],'key-test');
 assert.equal(anthropicHeaders(true)['anthropic-version'],'2023-06-01');
 assert.equal(anthropicHeaders(true).accept,'text/event-stream');
 assert.equal(Object.hasOwn(anthropicHeaders(true,'key-test'),'authorization'),false);
});

test('Anthropic native request moves initial system role to top level and requires output budget',()=>{
 const encoded=encodeAnthropicMessages({model:'claude-test',stream:false,max_tokens:256,messages:[{role:'system',content:'Be clear'},{role:'user',content:'Hi'}]});
 assert.deepEqual(encoded,{model:'claude-test',stream:false,max_tokens:256,messages:[{role:'user',content:'Hi'}],system:'Be clear'});
 assert.throws(()=>encodeAnthropicMessages({model:'claude-test',stream:false,messages:[{role:'user',content:'Hi'}]}),/anthropic_max_tokens_required/);
 assert.throws(()=>encodeAnthropicMessages({model:'claude-test',stream:false,max_tokens:200,tools:[],messages:[{role:'user',content:'Hi'}]}),/unsupported_anthropic_parameter/);
 assert.throws(()=>encodeAnthropicMessages({model:'claude-test',stream:false,max_tokens:200,messages:[{role:'user',content:'Hi'},{role:'system',content:'Late system'}]}),/unsupported_anthropic_system_position/);
});

test('Anthropic JSON normalizes response and rejects truncation and native tool blocks',async()=>{
 const result=await decodeAnthropicMessages(bytes(JSON.stringify(response)),false);
 assert.deepEqual(result,{text:'Hello',usage:{inputTokens:3,outputTokens:2,totalTokens:5},providerResponseId:'msg_123',providerModelId:'claude-test'});
 await assert.rejects(decodeAnthropicMessages(bytes(JSON.stringify({...response,stop_reason:'max_tokens'})),false),/provider_length_truncated/);
 await assert.rejects(decodeAnthropicMessages(bytes(JSON.stringify({...response,content:[{type:'tool_use',id:'tool',name:'read',input:{}}],stop_reason:'tool_use'})),false));
});

test('Anthropic SSE normalizes terminal text and token counts without accepting truncated streams',async()=>{
 const raw=event('message_start',{message:{id:'msg_123',type:'message',role:'assistant',model:'claude-test',content:[],usage:{input_tokens:3,output_tokens:0}}})
 +event('content_block_start',{index:0,content_block:{type:'text',text:''}})
 +event('content_block_delta',{index:0,delta:{type:'text_delta',text:'Hello'}})
 +event('content_block_stop',{index:0})
 +event('message_delta',{delta:{stop_reason:'end_turn'},usage:{output_tokens:2}})
 +event('message_stop',{});
 const deltas=[];
 const result=await decodeAnthropicMessages(bytes(raw),true,{onText:v=>deltas.push(v)});
 assert.equal(result.text,'Hello');
 assert.deepEqual(deltas,['Hello']);
 assert.deepEqual(result.usage,{inputTokens:3,outputTokens:2,totalTokens:5});
 await assert.rejects(decodeAnthropicMessages(bytes(raw.replace(event('message_stop',{}),'')),true),/incomplete_anthropic_stream/);
});

test('native model directory rejects incomplete pages and duplicate model IDs',()=>{
 assert.deepEqual(decodeAnthropicDirectory(JSON.stringify({data:[{id:'claude-test',type:'model'}],has_more:false})),['claude-test']);
 assert.throws(()=>decodeAnthropicDirectory(JSON.stringify({data:[{id:'one'},{id:'one'}],has_more:false})),/invalid_model_directory/);
 assert.throws(()=>decodeAnthropicDirectory(JSON.stringify({data:[{id:'one'}],has_more:true})),/model_directory_incomplete/);
 assert.throws(()=>decodeAnthropicDirectory('{"data":[],"data":[{"id":"injected"}]}'),/invalid_model_directory/);
});

test('native probe is a fixed small text request, not a tool capability probe',()=>{
 assert.deepEqual(anthropicProbeBody({modelId:'claude-test'},{stream:false,tools:false}),
  {model:'claude-test',max_tokens:8,stream:false,messages:[{role:'user',content:'Reply with OK.'}]});
 assert.throws(()=>anthropicProbeBody({modelId:'claude-test'},{stream:true,tools:true}),/unsupported_anthropic_tool_probe/);
});
