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

test('a dispatched generation can finish only with its bound reply identity',()=>{
 const db=openSqliteStore(':memory:','conversations');
 try{
  const service=createConversations(db,()=>true);let revision=0;
  const change=command=>service.change({}, {conversationId:'chat',intent:'step-'+revision,expectedRevision:revision,change:command});
  for(const command of [{kind:'create'},{kind:'append',messageId:'input',segments:[{id:'p',text:'original'}]},
   {kind:'begin',generationId:'gen',inputMessageId:'input'},
   {kind:'dispatch',generationId:'gen',operationId:'op',requestId:'request',replyId:'reply'}]){
   assert.equal(change(command).status,'committed');revision++;
  }
  const before=db.read();
  assert.equal(change({kind:'finish',generationId:'gen',messageId:'other',segments:[{id:'p',text:'wrong reply'}]}).status,'invalid_transition');
  assert.deepEqual(db.read(),before);
  assert.equal(change({kind:'finish',generationId:'gen',messageId:'reply',segments:[{id:'p',text:'correct reply'}]}).status,'committed');
  const observed=service.read({},'chat');
  assert.equal(observed.status,'ok');assert.equal(observed.conversation.generations[0].outputMessageId,'reply');
 }finally{db.close();}
});
test('completed reply identity corruption is rejected after SQLite reopen without rewriting history',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs'),{join}=await import('node:path'),{tmpdir}=await import('node:os');
 const directory=mkdtempSync(join(tmpdir(),'wex-reply-binding-')),file=join(directory,'state.sqlite');
 let db=openSqliteStore(file,'conversations');
 try{
  let service=createConversations(db,()=>true),revision=0;
  for(const change of [{kind:'create'},{kind:'append',messageId:'input',segments:[{id:'p',text:'original'}]},
   {kind:'begin',generationId:'gen',inputMessageId:'input'},
   {kind:'dispatch',generationId:'gen',operationId:'op',requestId:'request',replyId:'reply'},
   {kind:'finish',generationId:'gen',messageId:'reply',segments:[{id:'p',text:'answer'}]}]){
   assert.equal(service.change({}, {conversationId:'chat',intent:'step-'+revision,expectedRevision:revision,change}).status,'committed');revision++;
  }
  const snapshot=db.read();snapshot.value.conversations[0].generations[0].replyId='other';
  assert.equal(db.commit({intent:'damage',expectedRevision:snapshot.revision,value:snapshot.value}).status,'committed');
  db.close();db=openSqliteStore(file,'conversations');service=createConversations(db,()=>true);
  const before=db.read();
  assert.deepEqual(service.read({},'chat'),{status:'unavailable'});
  assert.equal(service.change({}, {conversationId:'chat',intent:'append',expectedRevision:5,
   change:{kind:'append',messageId:'new',segments:[{id:'p',text:'new'}]}}).status,'unavailable');
  assert.deepEqual(db.read(),before);
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});
