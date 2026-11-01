import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectionConfigs} from '../../dist/connections/src/index.js';
function store(){let revision=0,value=null;return {read(){return {revision,value:structuredClone(value)};},query(){return undefined;},commit(c){if(c.expectedRevision!==revision)return {status:'not_committed',reason:'revision_conflict'};revision++;value=structuredClone(c.value);return {status:'committed',intent:c.intent,revision};}};}
const sample={id:'api',adapter:'provider',endpoint:'https://example.invalid',credentialRef:'credential:1',enabled:true};
test('configuration persists with revision',()=>{const c=createConnectionConfigs(store());assert.equal(c.put(sample,0,'put:1').status,'ok');assert.deepEqual(c.get('api'),sample);assert.equal(c.read().revision,1);});
test('stale revision rejected',()=>{const c=createConnectionConfigs(store());c.put(sample,0,'put:1');assert.equal(c.put({...sample,enabled:false},0,'put:2').reason,'revision_conflict');assert.equal(c.get('api').enabled,true);});
test('invalid configuration rejected',()=>{const c=createConnectionConfigs(store());assert.equal(c.put({...sample,id:''},0,'put:1').reason,'invalid_request');assert.equal(c.read().items.length,0);});
test('returned objects are isolated',()=>{const c=createConnectionConfigs(store());c.put(sample,0,'put:1');c.get('api').enabled=false;assert.equal(c.get('api').enabled,true);});
