import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationLedger} from '../../dist/connections/src/index.js';
test('observations do not increment attempts',()=>{
 let value=null,revision=0;const store={read(){return {revision,value};},query(){return undefined;},commit(c){value=c.value;revision++;return {status:'committed',intent:c.intent,revision};}};
 const ledger=createOperationLedger(store);
 assert.equal(ledger.prepare('a','x').status,'ok');
 assert.equal(ledger.markDispatched('a').status,'ok');
 assert.equal(ledger.observe('a','event',{ok:true},'observed').status,'ok');
 assert.equal(ledger.get('a').attempts,1);
 assert.equal(ledger.observe('a','event',{ok:false},'observed').status,'conflict');
});
