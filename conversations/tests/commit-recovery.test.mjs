import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createConversations} from '../../dist/conversations/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'wex-chat-commit-')),file=join(dir,'conversations.sqlite'),stores=[];
 const open=()=>{const db=openSqliteStore(file,'conversations');stores.push(db);return db;};
 t.after(()=>{for(const db of stores)db.close();rmSync(dir,{recursive:true,force:true});});
 const request={};return {open,request,change:(service,intent,expectedRevision,change)=>service.change(request,{conversationId:'chat',intent,expectedRevision,change})};
}
test('conversation creation with lost commit acknowledgement replays its persisted receipt after reopening once',t=>{
 const f=fixture(t),db=f.open();let once=true;
 const service=createConversations({...db,commit(input){const result=db.commit(input);if(once){once=false;return {status:'unknown',intent:input.intent};}return result;}},()=>true);
 assert.equal(f.change(service,'create',0,{kind:'create'}).status,'unknown');
 const before=db.read(),reopened=f.open(),restored=createConversations(reopened,()=>true);
 assert.deepEqual(f.change(restored,'create',0,{kind:'create'}),{status:'committed',revision:1});
 assert.deepEqual(reopened.read(),before);assert.equal(restored.read(f.request,'chat').conversation.messages.length,0);
 assert.equal(f.change(restored,'create',0,{kind:'append',messageId:'different',segments:[{id:'p',text:'x'}]}).status,'intent_conflict');
});
test('conversation message result with lost acknowledgement remains one assistant reply after restart and replay',t=>{
 const f=fixture(t),db=f.open();let service=createConversations(db,()=>true);
 f.change(service,'create',0,{kind:'create'});
 f.change(service,'append',1,{kind:'append',messageId:'input',segments:[{id:'p',text:'question'}]});
 f.change(service,'begin',2,{kind:'begin',generationId:'gen',inputMessageId:'input'});
 f.change(service,'dispatch',3,{kind:'dispatch',generationId:'gen',operationId:'op',requestId:'request',replyId:'reply'});
 service=createConversations({...db,commit(input){db.commit(input);return {status:'unknown',intent:input.intent};}},()=>true);
 const finish={kind:'finish',generationId:'gen',messageId:'reply',segments:[{id:'p',text:'answer'}]};
 assert.equal(f.change(service,'finish',4,finish).status,'unknown');
 const reopened=f.open(),before=reopened.read(),restored=createConversations(reopened,()=>true);
 assert.deepEqual(f.change(restored,'finish',4,finish),{status:'committed',revision:5});
 assert.deepEqual(reopened.read(),before);
 const chat=restored.read(f.request,'chat').conversation;
 assert.deepEqual(chat.messages.map(m=>m.id),['input','reply']);assert.equal(chat.generations[0].status,'completed');
});
test('confirmed conversation commit failure leaves no message or business receipt and allows an explicit later attempt',t=>{
 const f=fixture(t),db=f.open(),service=createConversations(db,()=>true);
 f.change(service,'create',0,{kind:'create'});const before=db.read();
 const failed=createConversations({...db,commit(){return {status:'not_committed',reason:'storage_unavailable'};}},()=>true);
 const append={kind:'append',messageId:'input',segments:[{id:'p',text:'question'}]};
 assert.equal(f.change(failed,'append',1,append).status,'storage_unavailable');assert.deepEqual(db.read(),before);
 const reopened=f.open(),restored=createConversations(reopened,()=>true);
 assert.equal(f.change(restored,'append',1,append).status,'committed');assert.equal(restored.read(f.request,'chat').conversation.messages.length,1);
});
test('competing SQLite conversation instances cannot overwrite the winning message or its intent receipt',t=>{
 const f=fixture(t),one=f.open(),two=f.open(),other=createConversations(two,()=>true);
 f.change(other,'create',0,{kind:'create'});let rival;
 const first=createConversations({...one,commit(input){
  rival=f.change(other,'second',1,{kind:'append',messageId:'winner',segments:[{id:'p',text:'second'}]});
  return one.commit(input);
 }},()=>true);
 assert.equal(f.change(first,'first',1,{kind:'append',messageId:'loser',segments:[{id:'p',text:'first'}]}).status,'revision_conflict');
 assert.equal(rival.status,'committed');
 const reopened=f.open(),restored=createConversations(reopened,()=>true);
 assert.deepEqual(restored.read(f.request,'chat').conversation.messages.map(m=>m.id),['winner']);
 assert.equal(f.change(restored,'second',1,{kind:'append',messageId:'winner',segments:[{id:'p',text:'second'}]}).status,'committed');
});
test('conversation replay withholds receipt existence after authorization is revoked by a storage read',t=>{
 const f=fixture(t),db=f.open(),service=createConversations(db,()=>true);f.change(service,'create',0,{kind:'create'});const before=db.read();let allowed=true;
 const restored=createConversations({...db,read(){const value=db.read();allowed=false;return value;}},()=>allowed);
 assert.deepEqual(f.change(restored,'create',0,{kind:'create'}),{status:'denied'});assert.deepEqual(db.read(),before);
});
