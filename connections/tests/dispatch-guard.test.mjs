import test from 'node:test';
import assert from 'node:assert/strict';
import {createDispatchBoundary,createOperationLedger} from '../../dist/connections/src/index.js';
function fixture(action='write'){
 let revision=0,value=null,calls=0;
 const store={read(){return {revision,value};},query(){return undefined;},commit(c){if(c.expectedRevision!==revision)return {status:'not_committed',reason:'revision_conflict'};value=c.value;revision++;return {status:'committed',intent:c.intent,revision};}};
 const ledger=createOperationLedger(store);
 const scope={resource:'fixture',target:'item',action};
 const permission={evaluate(){return {status:'allow',scope,revision:1,generation:1};},recheck(){return this.evaluate();}};
 const boundary=createDispatchBoundary(permission,ledger,{id:'fixture',async execute(){calls++;return {ok:true};}});
 return {boundary,ledger,count(){return calls;}};
}
test('dispatch only once',async()=>{
 const h=fixture();
 assert.equal((await h.boundary.dispatch({},'id','item','fingerprint',{})).status,'observed');
 assert.equal((await h.boundary.dispatch({},'id','item','fingerprint',{})).status,'blocked');
 assert.equal(h.count(),1);
});
test('changed payload rejected',async()=>{
 const h=fixture();
 await h.boundary.dispatch({},'id','item','fingerprint',{a:1});
 assert.equal((await h.boundary.dispatch({},'id','item','fingerprint',{a:2})).reason,'intent_conflict');
 assert.equal(h.count(),1);
});
test('parallel requests execute once',async()=>{
 const h=fixture();
 await Promise.all([h.boundary.dispatch({},'id','item','fingerprint',{}),h.boundary.dispatch({},'id','item','fingerprint',{})]);
 assert.equal(h.count(),1);
});

test('read-only authorization cannot execute write adapter',async()=>{
 const h=fixture('read');
 const result=await h.boundary.dispatch({},'id','item','fingerprint',{});
 assert.equal(result.status,'blocked');
 assert.equal(result.reason,'scope_mismatch');
 assert.equal(h.count(),0);
});
