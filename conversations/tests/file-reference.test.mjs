import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createConversations} from '../../dist/conversations/src/index.js';
test('basic file references retain source and observed version without importing file content or authority',()=>{
 const store=openSqliteStore(':memory:','conversations'),request={};
 const service=createConversations(store,candidate=>candidate===request);
 const change=(intent,expectedRevision,change)=>service.change(request,{conversationId:'chat',intent,expectedRevision,change});
 try{
  change('create',0,{kind:'create'});
  const source={kind:'local-reference',contextId:'context',addressId:'address',version:'a'.repeat(64),mime:'text/plain'};
  const segment={id:'file',text:'文件引用（正文未发送）',source};
  assert.equal(change('append',1,{kind:'append',messageId:'user',segments:[segment]}).status,'committed');
  assert.deepEqual(service.read(request,'chat').conversation.messages[0].segments[0],segment);
  const restored=createConversations(store,candidate=>candidate===request);
  assert.deepEqual(restored.read(request,'chat').conversation.messages[0].segments[0].source,source);
  assert.equal(restored.read({},'chat').status,'denied');
  assert.equal(change('forged',2,{kind:'append',messageId:'forged',segments:[{...segment,source:{...source,permissions:'all'}}]}).status,'invalid');
 }finally{store.close();}
});
