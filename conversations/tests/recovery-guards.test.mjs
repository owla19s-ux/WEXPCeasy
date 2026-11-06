import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createConversations,createConversationGeneration} from '../../dist/conversations/src/index.js';
test('receipt recovery cannot finalize cancelled, unbound or mismatched unknown generations',()=>{
 for(const variant of ['cancelled','unbound','wrong-request','wrong-reply']){
  const db=openSqliteStore(':memory:','conversations');
  try{
   const service=createConversations(db,()=>true);let revision=0;
   const change=change=>{
    const result=service.change({}, {conversationId:'chat',intent:'step-'+revision,expectedRevision:revision,change});
    assert.equal(result.status,'committed');revision++;return result;
   };
   change({kind:'create'});change({kind:'append',messageId:'input',segments:[{id:'p',text:'original'}]});
   change({kind:'begin',generationId:'gen',inputMessageId:'input'});
   if(variant!=='unbound')change({kind:'dispatch',generationId:'gen',operationId:'op',requestId:'request',replyId:'reply'});
   change({kind:variant==='cancelled'?'cancel':'unknown',generationId:'gen'});
   const before=db.read();
   const coordinator=createConversationGeneration(service,{async send(){throw Error('recovery must not dispatch');}},()=>({requestId:variant==='wrong-request'?'other':'request',text:'receipt'}));
   if(variant==='wrong-reply'){
    assert.equal(service.change({}, {conversationId:'chat',intent:'wrong',expectedRevision:revision,change:{kind:'finish',generationId:'gen',messageId:'other',segments:[{id:'p',text:'must not save'}]}}).status,'invalid_transition');
   }else{
    const result=coordinator.recover({read:{},receipt:{},finish:{}},'chat','gen','recover');
    assert.equal(result.status,variant==='wrong-request'?'unavailable':'invalid_transition');
   }
   assert.deepEqual(db.read(),before);
  }finally{db.close();}
 }
});
