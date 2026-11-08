import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePreparationParameters} from '../../../dist/connections/api/src/preparation-parameters.js';

const observed={parameters:{
 temperature:{type:'number',minimum:0,maximum:2},
 thinking:{type:'boolean'},
 custom:{type:'object'},
 stop:{type:'array'}
}};

test('verified parameters preserve zero, false and structured values with their source',()=>{
 const result=resolvePreparationParameters(
  {temperature:{mode:'value',value:0}},
  {thinking:{mode:'value',value:false}},
  {custom:{mode:'value',value:{nested:[1,null,false]}},stop:{mode:'value',value:['END']}},
  observed);
 assert.deepEqual(result.values,{temperature:0,thinking:false,custom:{nested:[1,null,false]},stop:['END']});
 assert.deepEqual(result.sources,{temperature:['connection'],thinking:['model'],custom:['request'],stop:['request']});
});

test('equal settings merge provenance, provider default and disabled never appear in wire fields',()=>{
 const result=resolvePreparationParameters(
  {temperature:{mode:'value',value:0},thinking:{mode:'provider-default'}},
  {temperature:{mode:'value',value:0},thinking:{mode:'provider-default'}},
  {temperature:{mode:'value',value:0},stop:{mode:'disabled'}},observed);
 assert.deepEqual(result.values,{temperature:0});
 assert.deepEqual(result.sources.temperature,['connection','model','request']);
 assert.deepEqual(result.sources.thinking,['connection','model']);
 assert.equal(result.settings.get('stop').setting.mode,'disabled');
});

test('contradictory parameter sources remain rejected until A1 explicitly specifies precedence',()=>{
 assert.throws(()=>resolvePreparationParameters(
  {temperature:{mode:'value',value:0.2}},
  {temperature:{mode:'value',value:0.6}}, {}, observed),/parameter_conflict/);
 assert.throws(()=>resolvePreparationParameters(
  {thinking:{mode:'provider-default'}},
  {thinking:{mode:'disabled'}}, {}, observed),/parameter_conflict/);
});

test('unsupported and invalid parameters cannot be sent as wire values',()=>{
 assert.throws(()=>resolvePreparationParameters({}, {}, {unknown:{mode:'value',value:true}},observed),/parameter_unsupported/);
 assert.throws(()=>resolvePreparationParameters({}, {}, {temperature:{mode:'value',value:3}},observed),/parameter_invalid/);
 assert.throws(()=>resolvePreparationParameters({}, {}, {thinking:{mode:'value',value:0}},observed),/parameter_invalid/);
});
