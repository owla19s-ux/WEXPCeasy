import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileTextProbeObservation} from '../../../dist/connections/api/src/observation-reconciliation.js';

const base=(patch={})=>({
 connectionId:'connection-1',connectionRevision:1,modelId:'model-a',source:'probe',
 sourceRevision:'original',observedAt:'2026-11-08T00:00:00Z',
 capabilities:{text:'supported',stream:'unknown',tools:'supported',image:'unsupported',reasoning:'unknown'},
 parameters:{temperature:{type:'number',minimum:0,maximum:2}},
 limits:{contextWindow:8192},
 ...patch
});

test('a verified streaming probe upgrades streaming without erasing other evidence',()=>{
 const prior=base();
 const probe=base({sourceRevision:'probe-new',observedAt:'2026-11-08T01:00:00Z',
  capabilities:{text:'supported',stream:'supported',tools:'unknown',image:'unknown',reasoning:'unknown'},
  parameters:{}});
 const out=reconcileTextProbeObservation(probe,prior,1,'operation-1');
 assert.equal(out.capabilities.stream,'supported');
 assert.equal(out.capabilities.tools,'supported');
 assert.equal(out.capabilities.image,'unsupported');
 assert.deepEqual(out.parameters,prior.parameters);
 assert.deepEqual(out.limits,prior.limits);
 assert.deepEqual(out.streamProbe,{operationId:'operation-1',observedAt:probe.observedAt});
 assert.equal(prior.capabilities.stream,'unknown');
});

test('text-only probes do not erase verified capabilities, parameters or limits',()=>{
 const prior=base();
 const probe=base({capabilities:{text:'supported',stream:'unknown',tools:'unknown',image:'unknown',reasoning:'unknown'},parameters:{}});
 assert.throws(()=>reconcileTextProbeObservation(probe,prior,1,'operation-2'),/probe_would_replace_verified_evidence/);
});

test('text-only probes retain original behavior without same-revision prior evidence',()=>{
 const probe=base({capabilities:{text:'supported',stream:'unknown',tools:'unknown',image:'unknown',reasoning:'unknown'},parameters:{}});
 assert.equal(reconcileTextProbeObservation(probe,null,1,'operation-3'),probe);
 assert.equal(reconcileTextProbeObservation(probe,base({connectionRevision:2}),1,'operation-3'),probe);
});

test('explicitly unsupported streaming cannot be silently replaced by probe evidence',()=>{
 const prior=base({capabilities:{text:'supported',stream:'unsupported',tools:'unknown',image:'unknown',reasoning:'unknown'},parameters:{},limits:undefined});
 const probe=base({capabilities:{text:'supported',stream:'supported',tools:'unknown',image:'unknown',reasoning:'unknown'},parameters:{},limits:undefined});
 assert.throws(()=>reconcileTextProbeObservation(probe,prior,1,'operation-4'),/probe_would_replace_verified_evidence/);
});

test('text probes preserve directional evidence even when legacy capabilities are unknown',()=>{
 const capabilities={text:'supported',stream:'unknown',tools:'unknown',image:'unknown',reasoning:'unknown'};
 const prior=base({capabilities,parameters:{},limits:undefined,
  modalities:{text:{input:'supported',output:'supported'},image:{input:'supported'},audio:{output:'unsupported'}}});
 const probe=base({capabilities,parameters:{},limits:undefined});
 const out=reconcileTextProbeObservation(probe,prior,1,'operation-direction');
 assert.deepEqual(out.modalities,prior.modalities);
 assert.equal(out.sourceRevision,probe.sourceRevision);
 assert.equal(probe.modalities,undefined);
});

test('text and streaming probes cannot replace explicitly unsupported text directions',()=>{
 for(const direction of ['input','output']){
  for(const stream of ['unknown','supported']){
   const capabilities={text:'supported',stream:'unknown',tools:'unknown',image:'unknown',reasoning:'unknown'};
   const prior=base({capabilities,parameters:{},limits:undefined,modalities:{text:{[direction]:'unsupported'}}});
   const probe=base({capabilities:{...capabilities,stream},parameters:{},limits:undefined});
   assert.throws(()=>reconcileTextProbeObservation(probe,prior,1,'operation-conflict'),/probe_would_replace_verified_evidence/);
   assert.equal(prior.modalities.text[direction],'unsupported');
  }
 }
});
