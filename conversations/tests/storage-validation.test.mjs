import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import * as conversations from '../../dist/conversations/src/index.js';
function seed(db){
 const service=conversations.createConversations(db,()=>true);
 const changes=[
  {kind:'create'},
  {kind:'append',messageId:'input',segments:[{id:'p',text:'message'}]},
  {kind:'begin',generationId:'generation',inputMessageId:'input'},
  {kind:'dispatch',generationId:'generation',operationId:'operation',requestId:'request',replyId:'reply'},
  {kind:'select',messageId:'input',segmentIds:['p']},
 ];
 for(const [i,change] of changes.entries())assert.equal(service.change({}, {conversationId:'chat',intent:'step-'+i,expectedRevision:i,change}).status,'committed');
}
for(const [name,damage] of [
 ['aggregate extra secret',s=>s.apiKey='must-not-project'],
 ['conversation extra secret',s=>s.conversations[0].apiKey='must-not-project'],
 ['message extra secret',s=>s.conversations[0].messages[0].apiKey='must-not-project'],
 ['segment extra secret',s=>s.conversations[0].messages[0].segments[0].apiKey='must-not-project'],
 ['generation extra secret',s=>s.conversations[0].generations[0].apiKey='must-not-project'],
 ['selection extra secret',s=>s.conversations[0].selections[0].apiKey='must-not-project'],
 ['duplicate selections',s=>s.conversations[0].selections.push({...s.conversations[0].selections[0]})],
 ['partial dispatch identity',s=>delete s.conversations[0].generations[0].replyId],
 ['completed generation without output',s=>s.conversations[0].generations[0].status='completed'],
 ['missing latest receipt',s=>delete s.receipts['chat:step-4']],
 ['receipt command missing fields',s=>s.receipts['chat:step-4'].fingerprint='{}'],
 ['receipt revision ahead of conversation',s=>s.receipts['chat:step-4'].revision=99],
]){
 test('Conversations rejects '+name+' after real SQLite reopen without leaking or rewriting state',()=>{
  const dir=mkdtempSync(join(tmpdir(),'wex-conversation-corrupt-')),file=join(dir,'state.sqlite');let db=openSqliteStore(file,'conversations');
  try{
   seed(db);const snap=db.read();damage(snap.value);
   assert.equal(db.commit({intent:'damage',expectedRevision:snap.revision,value:snap.value}).status,'committed');
   db.close();db=openSqliteStore(file,'conversations');const before=db.read(),service=conversations.createConversations(db,()=>true);
   assert.deepEqual(service.read({},'chat'),{status:'unavailable'});
   assert.deepEqual(service.change({}, {conversationId:'chat',intent:'overwrite',expectedRevision:5,change:{kind:'append',messageId:'other',segments:[{id:'p',text:'new'}]}}),{status:'unavailable'});
   assert.deepEqual(db.read(),before);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
 });
}
test('Conversations owner inspection validates healthy persisted state without returning messages or mutating it',()=>{
 assert.equal(typeof conversations.inspectConversationStore,'function');
 const db=openSqliteStore(':memory:','conversations');
 try{
  assert.deepEqual(conversations.inspectConversationStore(db),{status:'ready'});seed(db);const before=db.read();
  assert.deepEqual(conversations.inspectConversationStore(db),{status:'ready'});assert.deepEqual(db.read(),before);
  db.commit({intent:'future',expectedRevision:before.revision,value:{format:99,conversations:[],receipts:{}}});
  const damaged=db.read();assert.deepEqual(conversations.inspectConversationStore(db),{status:'unavailable'});assert.deepEqual(db.read(),damaged);
 }finally{db.close();}
});
