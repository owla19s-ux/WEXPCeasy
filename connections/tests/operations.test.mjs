import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationLedger} from '../../dist/connections/src/index.js';
function store(){
 let revision=0,value=null;const intents=new Map();
 return {read(){return {revision,value:structuredClone(value)};},query(id){return intents.get(id);},commit(c){
  if(intents.has(c.intent))return intents.get(c.intent);
  if(c.expectedRevision!==revision)return {status:'not_committed',reason:'revision_conflict'};
  revision++;value=structuredClone(c.value);const result={status:'committed',intent:c.intent,revision};intents.set(c.intent,result);return result;
 }};
}
test('prepare and deduplicate',()=>{
 const l=createOperationLedger(store());
 assert.equal(l.prepare('a','x').status,'ok');
 assert.equal(l.prepare('a','x').status,'ok');
 assert.equal(l.prepare('a','y').status,'conflict');
 assert.equal(l.read().operations.length,1);
});
test('observation saved once',()=>{
 const l=createOperationLedger(store());
 l.prepare('a','x');
 l.markDispatched('a');
 assert.equal(l.observe('a','event',{result:'ok'},'observed').status,'ok');
 assert.equal(l.observe('a','event',{result:'ok'},'observed').status,'ok');
 assert.equal(l.get('a').observations.length,1);
});
test('missing intent rejected',()=>{
 const l=createOperationLedger(store());
 assert.equal(l.observe('missing','e',{},'unknown').status,'conflict');
});
test('unknown write not reported as success',()=>{
 const s=store();s.commit=()=>({status:'unknown',intent:'a'});
 const l=createOperationLedger(s);
 assert.equal(l.prepare('a','x').status,'unknown');
});

test('observation before dispatch reservation is refused',()=>{
 const l=createOperationLedger(store());
 l.prepare('early','fingerprint');
 assert.equal(l.observe('early','result',{ok:true},'observed').status,'conflict');
 assert.equal(l.get('early').observations.length,0);
});

test('late observation does not erase unknown outcome',()=>{
 const l=createOperationLedger(store());
 l.prepare('late','fingerprint');
 l.markDispatched('late');
 assert.equal(l.observe('late','disconnect',{source:'transport'},'unknown').status,'ok');
 assert.equal(l.observe('late','late-result',{source:'remote'},'observed').status,'ok');
 assert.equal(l.get('late').phase,'unknown');
 assert.equal(l.get('late').observations.length,2);
});
