import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createConversations,createConversationGeneration} from '../../dist/conversations/src/index.js';

test('streamed text is not delivered after read permission is revoked while generation remains in flight',async()=>{
 const db=openSqliteStore(':memory:','conversations');
 try{
  const request={};let readable=true;
  const service=createConversations(db,(_request,action)=>action!=='read'||readable);
  const change=(intent,expectedRevision,change)=>service.change(request,{conversationId:'chat',intent,expectedRevision,change});
  change('create',0,{kind:'create'});
  change('append',1,{kind:'append',messageId:'input',segments:[{id:'p',text:'hello'}]});
  change('begin',2,{kind:'begin',generationId:'gen',inputMessageId:'input'});
  const deltas=[];
  const generation=createConversationGeneration(service,{async send(_request,operationId,_preparation,_signal,onText){
   onText('visible');readable=false;onText('private');
   return {status:'ok',operationId,result:{text:'private',usage:null}};
  }});
  await generation.send({conversationId:'chat',generationId:'gen',operationId:'op',replyId:'reply',intent:'send',expectedRevision:3,
   preparation:{requestId:'request'},requests:{read:request,dispatch:request,api:request,finish:request,fail:request,unknown:request},
   onText:delta=>deltas.push(delta)});
  assert.deepEqual(deltas,['visible']);
  assert.equal(service.read(request,'chat').status,'denied');
  readable=true;
  assert.equal(service.read(request,'chat').conversation.messages.length,1);
 }finally{db.close();}
});
