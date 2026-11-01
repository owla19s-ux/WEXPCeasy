import test from 'node:test';
import assert from 'node:assert/strict';
import {createDispatchBoundary,createOperationLedger} from '../../dist/connections/src/index.js';
function fixture(action='write'){
 let revision=0,value=null,calls=0;
 const store={read(){return {revision,value};},query(){return undefined;},commit(c){if(c.expectedRevision!==revision)return {status:'not_committed',reason:'revision_conflict'};value=c.value;revision++;return {status:'committed',intent:c.intent,revision};}};
 const ledger=createOperationLedger(store);
 const scope={subject:'user',entry:'conversation',conversation:'c1',context:null,resource:'fixture',target:'item',action,relationship:'direct',relationshipGeneration:1};
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

test('payload mutation during permission checks cannot change dispatched input',async()=>{
 const ledger=createOperationLedger((()=>{let revision=0,value=null;return {read:()=>({revision,value}),query(){},commit(c){value=structuredClone(c.value);return {status:'committed',intent:c.intent,revision:++revision};}};})());
 const payload={text:'approved'};let received;
 const scope={subject:'user',entry:'conversation',conversation:'c',context:null,resource:'fixture',target:'item',action:'write',relationship:'direct',relationshipGeneration:1};
 const permission={evaluate(){return {status:'allow',scope,revision:1,generation:1};},recheck(){payload.text='changed';return this.evaluate();}};
 const boundary=createDispatchBoundary(permission,ledger,{id:'fixture',async execute(target,input){received=input;return null;}});
 assert.equal((await boundary.dispatch({},'payload','item','intent',payload)).status,'observed');
 assert.deepEqual(received,{text:'approved'});
});
for(const [name,payload] of [['sparse array',new Array(1)],['undefined value',{x:undefined}],['cyclic object',(()=>{const x={};x.self=x;return x;})()]])test('invalid dispatch payload is rejected: '+name,async()=>{
 const h=fixture();
 const result=await h.boundary.dispatch({},'invalid','item','intent',payload);
 assert.equal(result.status,'blocked');assert.equal(result.reason,'invalid_payload');assert.equal(h.count(),0);assert.equal(h.ledger.read().operations.length,0);
});
