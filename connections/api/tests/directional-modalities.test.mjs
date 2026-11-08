import test from 'node:test';
import assert from 'node:assert/strict';
import {observation,decode} from '../../../dist/connections/api/src/model.js';

const legacy={
 connectionId:'connection-1',connectionRevision:1,modelId:'model-1',
 source:'provider',sourceRevision:'catalog-1',observedAt:'2026-11-08T00:00:00.000Z',
 capabilities:{text:'supported',stream:'unknown',tools:'unverified',image:'unknown',reasoning:'unknown'},
 parameters:{}
};

test('legacy observations remain readable without inventing directional capabilities',()=>{
 assert.equal(observation(legacy),true);
 assert.equal(Object.hasOwn(legacy,'modalities'),false);
});

test('directional evidence accepts independently unknown, unsupported and verified input/output',()=>{
 const next={...legacy,modalities:{
  text:{input:'supported',output:'supported'},
  image:{input:'supported',output:'unknown'},
  audio:{input:'unverified',output:'unsupported'},
  video:{input:'unknown'},file:{output:'unknown'}
 }};
 assert.equal(observation(next),true);
 assert.deepEqual(next.modalities.image,{input:'supported',output:'unknown'});
});

test('malformed or invented modality evidence is rejected rather than silently dropped',()=>{
 for(const modalities of [
  {image:{input:'yes'}},{image:{bidirectional:'supported'}},
  {image:{}},{image:null},{image:['supported']},
  {unknown:{input:'supported'}},[],null
 ])assert.equal(observation({...legacy,modalities}),false,JSON.stringify(modalities));
});

test('legacy format 1 state restores with directional evidence absent and new observations round-trip',()=>{
 const connection={id:'connection-1',revision:1,name:'A',provider:'Custom',protocol:'openai-chat',
  endpoint:'https://example.org/v1',endpointMode:'base',credentialRef:null,enabled:true,parameters:{}};
 const base={id:'model-record-1',revision:1,connectionId:connection.id,name:'M',modelId:'model-1',parameters:{},observation:legacy};
 const state={format:1,domain:'api-configurations',connections:[connection],models:[base],intents:[]};
 const restored=decode(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.models[0].observation.modalities,undefined);
 const withEvidence=structuredClone(state);
 withEvidence.models[0].observation.modalities={image:{input:'supported',output:'unknown'}};
 assert.deepEqual(decode(JSON.parse(JSON.stringify(withEvidence))),withEvidence);
 const malformed=structuredClone(withEvidence);
 malformed.models[0].observation.modalities.image.output='yes';
 assert.throws(()=>decode(malformed),/corrupt_api_state/);
});
