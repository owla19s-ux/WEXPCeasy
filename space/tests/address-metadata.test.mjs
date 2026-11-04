import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {fixture} from './fixture.mjs';

test('address type, source and multiple purposes persist independently of Context identity and primary selection',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);
 const command={kind:'address.add',intent:'metadata',contextId:c.id,name:'主仓',address:'https://github.com/example/repo',notes:'用户登记',type:'repository',source:'user supplied',purpose:['reference','output']};
 const a=await h.exec(s,command);assert.equal(a.status,'committed');
 assert.equal((await h.exec(s,{kind:'primary.select',intent:'primary',contextId:c.id,id:a.id,expectedRevision:1})).status,'committed');
 await s.close();const reopened=await h.open();assert.deepEqual(await h.exec(reopened,command),a);
 assert.equal((await h.exec(reopened,{...command,purpose:['operation']})).reason,'intent_conflict');
 const view=(await h.query(reopened,c.id)).value;assert.equal(view.id,c.id);assert.equal(view.primaryAddress,a.id);assert.equal(view.revision,2);
 assert.deepEqual(view.resources,[{id:a.id,revision:1,name:'主仓',address:command.address,notes:'用户登记',type:'repository',source:'user supplied',purpose:['reference','output'],status:'unverified'}]);
 const edited=await h.exec(reopened,{kind:'address.edit',intent:'edit',contextId:c.id,id:a.id,expectedRevision:1,name:'新名称',address:command.address,purpose:['operation']});assert.equal(edited.status,'committed');
 const after=(await h.query(reopened,c.id)).value;assert.equal(after.resources[0].type,'repository');assert.equal(after.resources[0].source,'user supplied');assert.deepEqual(after.resources[0].purpose,['operation']);assert.equal(after.resources[0].revision,2);assert.equal(after.revision,2);
 assert.equal((await h.exec(reopened,{kind:'address.edit',intent:'stale',contextId:c.id,id:a.id,expectedRevision:1,name:'old',address:command.address,type:'document'})).reason,'revision_conflict');
});

test('literal old address records load without added defaults, rewrites or identity changes',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);
 const a=await h.exec(s,{kind:'address.add',intent:'old',contextId:c.id,name:'old',address:'D:/work',purpose:'operation'});await s.close();
 const path=join(h.a,'wex-context.sqlite'),db=openSqliteStore(path,'space-context'),before=db.read();db.close();
 const reopened=await h.open();const q=await h.query(reopened,c.id);assert.equal(q.status,'ok');assert.deepEqual(q.value.resources,[{id:a.id,revision:1,name:'old',address:'D:/work',notes:'',purpose:'operation',status:'unverified'}]);
 const check=openSqliteStore(path,'space-context');assert.deepEqual(check.read(),before);check.close();
 assert.equal((await h.exec(reopened,{kind:'address.edit',intent:'extend-old',contextId:c.id,id:a.id,expectedRevision:1,name:'old',address:'D:/work',type:'directory',source:'manual',purpose:['operation','output']})).status,'committed');
 assert.deepEqual((await h.query(reopened,c.id)).value.resources[0].purpose,['operation','output']);
});

for(const [name,fields] of [
 ['duplicate purposes',{purpose:['reference','reference']}],
 ['empty purpose element',{purpose:['reference','']}],
 ['sparse purposes',{purpose:new Array(2)}],
 ['nonstring purpose',{purpose:['reference',false]}],
 ['object source',{source:{apiKey:'secret'}}],
 ['empty type',{type:''}]
])test(`invalid address metadata rejects ${name} without writing`,async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);
 assert.deepEqual(await h.exec(s,{kind:'address.add',intent:'bad',contextId:c.id,name:'bad',address:'https://example.org',...fields}),{status:'rejected',reason:'invalid_command'});
 assert.deepEqual((await h.query(s,c.id)).value.resources,[]);
});

test('address metadata supports explicit clearing and snapshots multi-purpose input before queuing',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);
 const command={kind:'address.add',intent:'snapshot',contextId:c.id,name:'a',address:'https://example.org',type:'document',source:'manual',purpose:['reference']};
 const result=h.exec(s,command);command.purpose.push('changed');const a=await result;assert.equal(a.status,'committed');assert.deepEqual((await h.query(s,c.id)).value.resources[0].purpose,['reference']);
 assert.equal((await h.exec(s,{kind:'address.edit',intent:'clear',contextId:c.id,id:a.id,expectedRevision:1,name:'a',address:command.address,type:null,source:null,purpose:[]})).status,'committed');
 const after=(await h.query(s,c.id)).value.resources[0];assert.equal('type'in after,false);assert.equal('source'in after,false);assert.deepEqual(after.purpose,[]);
});

for(const [field,value] of [['type',{}],['source',null],['purpose',['reference','reference']]])test(`invalid persisted address ${field} is rejected without automatic data repair`,async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);await h.exec(s,{kind:'address.add',intent:'a',contextId:c.id,name:'a',address:'https://example.org'});
 const path=join(h.a,'wex-context.sqlite'),db=openSqliteStore(path,'space-context'),snap=db.read();snap.value.resources[0][field]=value;
 assert.equal(db.commit({intent:'corrupt-metadata',expectedRevision:snap.revision,value:snap.value}).status,'committed');const before=db.read();db.close();
 assert.deepEqual(await h.query(s,c.id),{status:'unavailable',reason:'corrupt_context'});
 assert.equal((await h.exec(s,{kind:'address.add',intent:'blocked',contextId:c.id,name:'b',address:'D:/b'})).status,'unavailable');
 const check=openSqliteStore(path,'space-context');assert.deepEqual(check.read(),before);check.close();
});
