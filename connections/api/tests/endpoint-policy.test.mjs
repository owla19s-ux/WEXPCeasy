import test from 'node:test';
import assert from 'node:assert/strict';
import {validateApiEndpoint} from '../../../dist/connections/api/src/endpoint-policy.js';
import {endpoint} from '../../../dist/connections/api/src/model.js';

test('API endpoint policy accepts remote HTTPS and loopback HTTP, preserving URL',()=>{
 assert.deepEqual(validateApiEndpoint('https://api.example.test/v1','base'),{status:'ok',url:'https://api.example.test/v1'});
 for(const value of ['http://localhost:1234/v1','http://127.0.0.1:1234/v1','http://[::1]:1234/v1']){
  assert.equal(validateApiEndpoint(value,'base').status,'ok');
  assert.equal(endpoint(value,'base'),new URL(value).href);
 }
 assert.equal(endpoint('https://api.example.test/tenant/chat/completions','request'),'https://api.example.test/tenant/chat/completions');
});

test('API endpoint policy refuses remote plaintext and embedded credentials or query',()=>{
 for(const value of ['http://api.example.test/v1','ftp://api.example.test/v1',
  'https://username:secret@api.example.test/v1',
  'https://api.example.test/v1?token=secret','https://api.example.test/v1#fragment','invalid-url']){
  assert.equal(validateApiEndpoint(value,'base').status,'invalid_endpoint',value);
  assert.throws(()=>endpoint(value,'base'),/invalid_endpoint/,value);
 }
});

test('base URLs reject an already-assembled Chat completion route; request URLs retain it',()=>{
 const value='https://api.example.test/v1/chat/completions';
 assert.equal(validateApiEndpoint(value,'base').status,'ambiguous_endpoint');
 assert.throws(()=>endpoint(value,'base'),/ambiguous_endpoint/);
 assert.deepEqual(validateApiEndpoint(value,'request'),{status:'ok',url:value});
});
