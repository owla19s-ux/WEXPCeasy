import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createAiConfigurations} from '../../dist/AI/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
function fixture(t,policy){
 const directory=mkdtempSync(join(tmpdir(),'wex-ai-list-')),path=join(directory,'ai.sqlite');
 let store=openSqliteStore(path,'ai'),service,closed=false;
 const close=()=>{if(!closed){store.close();closed=true;}};
 const writer={},reader={};
 const make=()=>createAiConfigurations(store,(request,access)=>request===writer||request===reader&&policy(access),()=>true);
 service=make();
 for(const [id,value] of [
  ['a',{kind:'role',name:'Visible',prompt:'Authorized prompt'}],
  ['b',{kind:'role',name:'Hidden',prompt:'Private prompt'}],
  ['p',{kind:'position',name:'Position',responsibility:'Review'}],
  ['agent',{kind:'agent',name:'Agent',roleId:'a',positionId:'p',model:{connectionId:'connection',modelId:'model'}}],
 ])assert.equal(service.save(writer,{id,intent:'create-'+id,expectedRevision:0,value}).status,'committed');
 t.after(()=>{close();rmSync(directory,{recursive:true,force:true});});
 return {reader,writer,close,get store(){return store;},get service(){return service;},
  reopen(){close();store=openSqliteStore(path,'ai');closed=false;service=make();}};
}
test('AI lists require a list grant and independent row reads without hidden totals',t=>{
 let list=true,reads=new Set(['a']);
 const f=fixture(t,a=>a.action==='list'?list&&a.kind==='role'&&a.id==='*':a.action==='read'&&reads.has(a.id));
 assert.deepEqual(f.service.list(f.reader,'role'),{status:'ok',entries:[{kind:'role',name:'Visible',prompt:'Authorized prompt',id:'a',revision:1}]});
 assert.deepEqual(f.service.list(f.reader,'position'),{status:'denied'});
 reads.clear();assert.deepEqual(f.service.list(f.reader,'role'),{status:'ok',entries:[]});
 reads.add('a');list=false;assert.deepEqual(f.service.list(f.reader,'role'),{status:'denied'});
 assert.deepEqual(f.service.list({},'role'),{status:'denied'});
});
test('AI enumeration is read-only persists across reopen and returns independent configuration values',t=>{
 const f=fixture(t,()=>true),revision=f.store.read().revision;
 const roles=f.service.list(f.reader,'role');assert.deepEqual(roles.entries.map(x=>x.id),['a','b']);
 const agent=f.service.list(f.reader,'agent');agent.entries[0].model.connectionId='tampered';
 assert.equal(f.store.read().revision,revision);f.reopen();
 assert.equal(f.service.list(f.reader,'agent').entries[0].model.connectionId,'connection');
 assert.deepEqual(f.service.list(f.reader,'position').entries.map(x=>x.id),['p']);
 assert.deepEqual(f.service.list(f.reader,'role'),roles);
});
test('AI list denial and invalid kinds precede storage access',t=>{
 const f=fixture(t,()=>false);f.close();
 assert.deepEqual(f.service.list(f.reader,'role'),{status:'denied'});
 for(const kind of ['other','',null,{},'role:*'])assert.deepEqual(f.service.list(f.writer,kind),{status:'denied'});
});
test('AI list revocation during row authorization discloses no entries',t=>{
 let list=true;
 const f=fixture(t,a=>{if(a.action==='list')return list;if(a.action==='read'){list=false;return true;}return false;});
 assert.deepEqual(f.service.list(f.reader,'role'),{status:'denied'});
});
test('AI list rechecks early visible rows after later dependency callbacks',t=>{
 const visible=new Set(['a','b']);
 const f=fixture(t,a=>{if(a.action==='list')return true;if(a.id==='b')visible.delete('a');return visible.has(a.id);});
 assert.deepEqual(f.service.list(f.reader,'role').entries.map(x=>x.id),['b']);
});
test('AI list refuses damaged state rather than returning a partial or empty healthy list',t=>{
 const f=fixture(t,()=>true),snapshot=f.store.read();
 snapshot.value.receipts=[];assert.equal(f.store.commit({intent:'corrupt',expectedRevision:snapshot.revision,value:snapshot.value}).status,'committed');
 assert.deepEqual(f.service.list(f.reader,'role'),{status:'unavailable'});
});
test('AI list treats authority exceptions as denial without leaking their text',t=>{
 const f=fixture(t,()=>{throw Error('Private prompt');});
 assert.deepEqual(f.service.list(f.reader,'role'),{status:'denied'});
});
