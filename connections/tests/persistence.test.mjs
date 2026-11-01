import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createConnectionConfigs,createOperationLedger} from '../../dist/connections/src/index.js';
const sample={id:'local',adapter:'fixture',endpoint:'local:test',credentialRef:null,enabled:true};
function database(t){
 const dir=mkdtempSync(join(tmpdir(),'wex-connections-'));const stores=[];
 t.after(()=>{for(const s of stores)s.close();rmSync(dir,{recursive:true,force:true});});
 return namespace=>{const s=openSqliteStore(join(dir,'state.sqlite'),namespace);stores.push(s);return s;};
}
test('remove persists configuration deletion without deleting operation history',t=>{
 const open=database(t),configs=createConnectionConfigs(open('configs')),ledger=createOperationLedger(open('operations'));
 configs.put(sample,0,'create');ledger.prepare('operation','original-config');ledger.markDispatched('operation');
 assert.equal(configs.remove('local',1,'remove').status,'ok');
 assert.equal(createConnectionConfigs(open('configs')).get('local'),undefined);
 assert.equal(createOperationLedger(open('operations')).get('operation').phase,'dispatched');
 assert.equal(configs.read().revision,2);
});
test('remove rejects stale revision, missing connection and reused intent',t=>{
 const open=database(t),configs=createConnectionConfigs(open('configs'));
 configs.put(sample,0,'create');
 assert.equal(configs.remove('local',0,'stale').reason,'revision_conflict');
 assert.equal(configs.remove('missing',1,'missing').reason,'not_found');
 assert.equal(configs.remove('local',1,'create').status,'conflict');
 assert.deepEqual(configs.get('local'),sample);
});
test('remove validates requests before committing',t=>{
 const open=database(t),configs=createConnectionConfigs(open('configs'));
 configs.put(sample,0,'create');
 for(const [id,revision,intent] of [['',1,'delete'],['local',-1,'delete'],['local',1,''],['local',1,'x'.repeat(257)]]){
  assert.equal(configs.remove(id,revision,intent).reason,'invalid_request');
 }
 assert.equal(configs.read().revision,1);
});
test('reopened ledger preserves deduplication and unknown evidence',t=>{
 const open=database(t);let ledger=createOperationLedger(open('operations'));
 ledger.prepare('op','fingerprint');ledger.markDispatched('op');ledger.observe('op','disconnect',{source:'transport'},'unknown');
 ledger=createOperationLedger(open('operations'));
 assert.equal(ledger.prepare('op','changed').reason,'intent_conflict');
 assert.equal(ledger.markDispatched('op').status,'conflict');
 assert.equal(ledger.observe('op','disconnect',{source:'transport'},'unknown').status,'ok');
 assert.equal(ledger.observe('op','late',{result:true},'observed').status,'ok');
 assert.equal(ledger.get('op').phase,'unknown');
 assert.equal(ledger.get('op').attempts,1);
 assert.equal(ledger.get('op').observations.length,2);
});

test('different operation and observation pairs cannot collide in persistence intents',t=>{
 const ledger=createOperationLedger(database(t)('operations'));
 ledger.prepare('a:b','first');ledger.markDispatched('a:b');
 ledger.prepare('a','second');ledger.markDispatched('a');
 assert.equal(ledger.observe('a:b','c',{source:'first'},'observed').status,'ok');
 assert.equal(ledger.observe('a','b:c',{source:'second'},'observed').status,'ok');
 assert.deepEqual(ledger.get('a:b').observations,[{id:'c',phase:'observed',value:{source:'first'}}]);
 assert.deepEqual(ledger.get('a').observations,[{id:'b:c',phase:'observed',value:{source:'second'}}]);
});

const binding={connectionId:'connection',configRevision:1,adapterId:'fixture',adapterVersion:'1.0',endpoint:'local:original'};
test('operation binding survives reopening and cannot be changed by a duplicate prepare',t=>{
 const open=database(t),ledger=createOperationLedger(open('operations'));
 assert.equal(ledger.prepare('bound','same-fingerprint',binding).status,'ok');
 const restored=createOperationLedger(open('operations'));
 assert.deepEqual(restored.get('bound').connection,binding);
 assert.equal(restored.prepare('bound','same-fingerprint',{...binding,endpoint:'local:other'}).reason,'intent_conflict');
 const projection=restored.get('bound');projection.connection.endpoint='changed';
 assert.equal(restored.get('bound').connection.endpoint,'local:original');
 assert.equal(restored.prepare('bound','same-fingerprint',binding).status,'ok');
});
test('legacy operation remains readable and cannot be silently rebound',t=>{
 const ledger=createOperationLedger(database(t)('operations'));
 ledger.prepare('legacy','same-fingerprint');
 assert.equal(ledger.prepare('legacy','same-fingerprint',binding).reason,'intent_conflict');
 assert.equal(ledger.get('legacy').connection,undefined);
});
test('invalid operation bindings cannot be persisted or accepted from storage',t=>{
 const open=database(t),store=open('operations'),ledger=createOperationLedger(store);
 for(const invalid of [{...binding,configRevision:0},{...binding,adapterVersion:''},{...binding,endpoint:''},null]){
  assert.equal(ledger.prepare('bound','fp',invalid).reason,'invalid_request');
 }
 assert.equal(store.read().revision,0);
 store.commit({intent:'corrupt',expectedRevision:0,value:{format:1,operations:[{id:'bad',fingerprint:'fp',phase:'prepared',attempts:0,observations:[],connection:{...binding,configRevision:0}}]}});
 assert.throws(()=>ledger.read(),/invalid_operation_state/);
});
