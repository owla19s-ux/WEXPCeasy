import test from 'node:test';
import assert from 'node:assert/strict';
import {stream as responses} from '@earendil-works/pi-ai/api/openai-responses';
import {stream as anthropic} from '@earendil-works/pi-ai/api/anthropic-messages';
import {transformMessages} from '@earendil-works/pi-ai/api/transform-messages';
import {model,context,frame,run,end,text,choice,tool,bytesFetch} from './harness.mjs';

test('A Responses native typed terminal and early EOF (injected HTTP stream)',async()=>{
 const m={...model,api:'openai-responses',provider:'openai'};
 const completed=frame({type:'response.completed',sequence_number:0,response:{id:'resp1',status:'completed',usage:{input_tokens:2,output_tokens:1,total_tokens:3}}});
 const ok=await responses(m,context,{apiKey:'fake-local-only',maxRetries:0,fetch:bytesFetch(completed)}).result();
 assert.equal(ok.stopReason,'stop');assert.equal(ok.usage.totalTokens,3);
 const incomplete=await responses(m,context,{apiKey:'fake-local-only',maxRetries:0,fetch:bytesFetch(frame({type:'response.created',sequence_number:0,response:{id:'r'}}))}).result();
 assert.equal(incomplete.stopReason,'error');
});
test('A Anthropic native text and budget request (injected HTTP SSE)',async()=>{
 const m={...model,api:'anthropic-messages',provider:'anthropic',id:'claude-test',reasoning:true};let payload;
 const events=[['message_start',{type:'message_start',message:{id:'m1',type:'message',role:'assistant',content:[],model:m.id,usage:{input_tokens:2,output_tokens:0}}}],['content_block_start',{type:'content_block_start',index:0,content_block:{type:'text',text:''}}],['content_block_delta',{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'hello'}}],['content_block_stop',{type:'content_block_stop',index:0}],['message_delta',{type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:1}}],['message_stop',{type:'message_stop'}]];
 const body=events.map(([name,data])=>`event: ${name}\n${frame(data)}`).join('');
 const r=await anthropic(m,context,{apiKey:'fake-local-only',maxRetries:0,thinkingEnabled:true,thinkingBudgetTokens:1024,fetch:bytesFetch(body),onPayload:p=>{payload=p;}}).result();
 assert.equal(r.stopReason,'stop');assert.equal(r.content[0].text,'hello');assert.equal(payload.thinking?.budget_tokens,1024);
});
test('A DeepSeek thinking/tool roundtrip keeps same-model reasoning payload; cross-model strips thinking',async()=>{
 const m={...model,provider:'deepseek',id:'deepseek-reasoner',reasoning:true,compat:{thinkingFormat:'deepseek',supportsReasoningEffort:true}};
 let sent;const response=await run(frame(choice({reasoning_content:'private-reasoning'}))+frame(tool())+frame(choice({},'tool_calls')),{model:m});
 assert.equal(response.message.stopReason,'toolUse');assert(response.message.content.some(c=>c.type==='thinking'));
 const ctx={messages:[...context.messages,response.message,{role:'toolResult',toolCallId:'t1',toolName:'write',content:[{type:'text',text:'approved receipt'}],isError:false,timestamp:2}]};
 await run(text('next')+end(),{model:m,context:ctx,reasoningEffort:'high',onPayload:p=>{sent=p;}});
 assert.equal(sent.messages.find(msg=>msg.role==='assistant').reasoning_content,'private-reasoning');
 assert.equal(sent.thinking?.type,'enabled');
 const transformed=transformMessages(ctx.messages,{...m,id:'different'});assert(!transformed.find(msg=>msg.role==='assistant').content.some(c=>c.type==='thinking'));
 // Pi matches provider/api/model, not WEX Connection or generation identity.
 const same=transformMessages(ctx.messages,{...m,baseUrl:'https://different.invalid'});assert(same.find(msg=>msg.role==='assistant').content.some(c=>c.type==='thinking'));
});
test('A vision image is encoded for a declared vision model, no capability inference from name',async()=>{
 let payload;
 await run(end(),{model:{...model,input:['text','image']},context:{messages:[{role:'user',content:[{type:'image',data:'AA==',mimeType:'image/png'}],timestamp:1}]},onPayload:p=>{payload=p;}});
 assert(JSON.stringify(payload).includes('data:image/png;base64,AA=='));
});

test('A Google custom fetch cannot carry WEX HTTP guards: explicit SDK rejection',async()=>{
 const {stream:google}=await import('@earendil-works/pi-ai/api/google-generative-ai');
 const r=await google({...model,api:'google-generative-ai',provider:'google'},context,{apiKey:'fake-local-only',maxRetries:0,fetch:bytesFetch(end())}).result();
 assert.equal(r.stopReason,'error');assert.match(r.errorMessage,/Custom fetch is not supported/);
});
