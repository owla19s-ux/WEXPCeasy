import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createConversations,createConversationGeneration} from '../../dist/conversations/src/index.js';
function fixture(t){
 const db=openSqliteStore(':memory:','conversations');t.after(()=>db.close());
 const request={},service=createConversations(db,()=>true);
 const change=(intent,expectedRevision,change)=>service.change(request,{conversationId:'chat',intent,expectedRevision,change});
 change('create',0,{kind:'create'});change('append',1,{kind:'append',messageId:'input',segments:[{id:'p',text:'question'}]});
 change('begin',2,{kind:'begin',generationId:'gen',inputMessageId:'input'});
 const input={conversationId:'chat',generationId:'gen',operationId:'operation',replyId:'reply',intent:'send',expectedRevision:3,
  preparation:{requestId:'request'},requests:{read:request,dispatch:request,api:request,finish:request,fail:request,unknown:request}};
 return {db,service,request,input};
}
test('generation captures an explicitly supplied system prompt before dispatch without inserting it into conversation history',async t=>{
 const f=fixture(t);let resolve,sent;
 const generation=createConversationGeneration(f.service,{async send(_r,operationId,preparation){
  sent=preparation;await new Promise(r=>{resolve=r;});return {status:'ok',operationId,result:{text:'answer',usage:null}};
 }});
 const input={...f.input,systemPrompt:'Use the selected role instructions.'},pending=generation.send(input);
 input.systemPrompt='Changed after dispatch';
 try{assert.deepEqual(sent.messages,[{role:'system',content:'Use the selected role instructions.'},{role:'user',content:'question'}]);}finally{resolve();}
 assert.equal((await pending).status,'committed');
 assert.deepEqual(f.service.read(f.request,'chat').conversation.messages.map(m=>m.role),['user','assistant']);
});
test('invalid system prompts are rejected before dispatch reservation or API calls',async t=>{
 for(const systemPrompt of ['',null,{},'x'.repeat(32001)]){
  const f=fixture(t),before=f.db.read();let calls=0;
  const generation=createConversationGeneration(f.service,{async send(){calls++;return {status:'blocked',operationId:'operation',reason:'unexpected'};}});
  assert.deepEqual(await generation.send({...f.input,systemPrompt}),{status:'invalid'});
  assert.equal(calls,0);assert.deepEqual(f.db.read(),before);
 }
});

test('uncloneable preparation is invalid before conversation reads, reservation or API calls',async t=>{
 const f=fixture(t),before=f.db.read();let calls=0;
 const generation=createConversationGeneration(f.service,{async send(){calls++;throw Error('must not send');}});
 const result=await generation.send({...f.input,preparation:{...f.input.preparation,parameters:{unsafe:()=>true}}});
 assert.deepEqual(result,{status:'invalid'});assert.equal(calls,0);assert.deepEqual(f.db.read(),before);
});
