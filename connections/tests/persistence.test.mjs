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
