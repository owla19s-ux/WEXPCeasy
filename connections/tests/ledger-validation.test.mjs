import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationLedger,createDispatchBoundary} from '../../dist/connections/src/index.js';
const prepared={id:'op',fingerprint:'fp',phase:'prepared',attempts:0,observations:[]};
const dispatched={...prepared,phase:'dispatched',attempts:1};
function fixture(value){let commits=0;return {read(){return {revision:1,value:structuredClone(value)};},query(){},commit(){commits++;return {status:'unknown',intent:'test'};},get commits(){return commits;}};}
const invalid=[
 ['duplicate operation ids',[prepared,{...prepared,fingerprint:'other'}]],
 ['empty identity',[{...prepared,id:''}]],
 ['empty fingerprint',[{...prepared,fingerprint:''}]],
 ['negative attempts',[{...prepared,attempts:-1}]],
 ['prepared with dispatched attempt',[{...prepared,attempts:1}]],
 ['dispatched without attempt',[{...dispatched,attempts:0}]],
 ['more than one dispatch',[{...dispatched,attempts:2}]],
 ['prepared with observation',[{...prepared,observations:[{id:'e',phase:'observed',value:null}]}]],
 ['dispatched with observation',[{...dispatched,observations:[{id:'e',phase:'observed',value:null}]}]],
 ['observed with no evidence',[{...dispatched,phase:'observed'}]],
 ['invalid observation phase',[{...dispatched,phase:'observed',observations:[{id:'e',phase:'success',value:null}]}]],
 ['missing observation value',[{...dispatched,phase:'observed',observations:[{id:'e',phase:'observed'}]}]],
 ['duplicate observation ids',[{...dispatched,phase:'observed',observations:[{id:'e',phase:'observed',value:1},{id:'e',phase:'observed',value:2}]}]],
 ['unknown hidden by observed phase',[{...dispatched,phase:'observed',observations:[{id:'e',phase:'unknown',value:null}]}]],
 ['unknown without unknown evidence',[{...dispatched,phase:'unknown',observations:[{id:'e',phase:'observed',value:null}]}]],
 ['nonfinite stored JSON',[{...dispatched,phase:'observed',observations:[{id:'e',phase:'observed',value:NaN}]}]],
];
for(const [name,operations] of invalid)test('corrupted ledger fails closed: '+name,()=>{
 const s=fixture({format:1,operations}),ledger=createOperationLedger(s);
 assert.throws(()=>ledger.read(),/invalid_operation_state/);
 assert.equal(ledger.prepare('new','fp').status,'unavailable');
 assert.equal(s.commits,0);
});
test('invalid observation inputs never reach persistence',()=>{
 const s=fixture({format:1,operations:[dispatched]}),ledger=createOperationLedger(s);
 const cyclic={};cyclic.self=cyclic;
 for(const [value,phase] of [[{},'success'],[undefined,'observed'],[NaN,'observed'],[cyclic,'unknown'],[new Date(),'observed'],[{x:undefined},'observed']]){
  assert.equal(ledger.observe('op','event',value,phase).reason,'invalid_request');
 }
 assert.equal(s.commits,0);
});
test('corrupted ledger blocks adapter dispatch',async()=>{
 const s=fixture({format:1,operations:[prepared,prepared]}),ledger=createOperationLedger(s);let calls=0;
 const scope={subject:'user',entry:'conversation',conversation:'c',context:null,resource:'fixture',target:'item',action:'write',relationship:'direct',relationshipGeneration:1};
 const permission={evaluate(){return {status:'allow',scope,revision:1,generation:1};},recheck(){return this.evaluate();}};
 const boundary=createDispatchBoundary(permission,ledger,{id:'fixture',async execute(){calls++;return null;}});
 assert.equal((await boundary.dispatch({},'new','item','fp',{})).status,'unknown');
 assert.equal(calls,0);assert.equal(s.commits,0);
});
