import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectionConfigs} from '../../dist/connections/src/index.js';
function store(){let revision=0,value=null;const intents=new Map();return {read(){return {revision,value:structuredClone(value)};},query(id){return intents.get(id);},commit(c){if(intents.has(c.intent))return intents.get(c.intent);if(c.expectedRevision!==revision)return {status:'not_committed',reason:'revision_conflict'};revision++;value=structuredClone(c.value);const result={status:'committed',intent:c.intent,revision};intents.set(c.intent,result);return result;}};}
const sample={id:'api',adapter:'provider',endpoint:'https://example.invalid',credentialRef:'credential:1',enabled:true};
test('configuration persists with revision',()=>{const c=createConnectionConfigs(store());assert.equal(c.put(sample,0,'put:1').status,'ok');assert.deepEqual(c.get('api'),sample);assert.equal(c.read().revision,1);});
test('stale revision rejected',()=>{const c=createConnectionConfigs(store());c.put(sample,0,'put:1');assert.equal(c.put({...sample,enabled:false},0,'put:2').reason,'revision_conflict');assert.equal(c.get('api').enabled,true);});
test('invalid configuration rejected',()=>{const c=createConnectionConfigs(store());assert.equal(c.put({...sample,id:''},0,'put:1').reason,'invalid_request');assert.equal(c.read().items.length,0);});
test('returned objects are isolated',()=>{const c=createConnectionConfigs(store());c.put(sample,0,'put:1');c.get('api').enabled=false;assert.equal(c.get('api').enabled,true);});

test('same intent cannot silently accept different config',()=>{
 const c=createConnectionConfigs(store());
 assert.equal(c.put(sample,0,'same').status,'ok');
 const altered={...sample,enabled:false};
 const result=c.put(altered,1,'same');
 assert.notEqual(result.status,'ok');
 assert.equal(c.get('api').enabled,true);
});

test('remove does not claim success after unknown commit',()=>{
 const s=store(),configs=createConnectionConfigs(s);configs.put(sample,0,'create');
 s.commit=()=>({status:'unknown',intent:'remove'});
 assert.equal(configs.remove('api',1,'remove').status,'unknown');
 assert.deepEqual(configs.get('api'),sample);
});
test('remove verifies acknowledged deletion against persisted state',()=>{
 const s=store(),configs=createConnectionConfigs(s);configs.put(sample,0,'create');
 s.commit=()=>({status:'committed',intent:'remove',revision:2});
 assert.equal(configs.remove('api',1,'remove').reason,'persisted_state_mismatch');
 assert.deepEqual(configs.get('api'),sample);
});
