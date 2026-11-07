import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as github from '../../../dist/connections/github/src/index.js';
const connection={id:'gh',adapter:'github',endpoint:'https://api.github.com',credentialRef:null,enabled:true};
test('GitHub credential references bind exact vault revisions without storing secrets',()=>{
 const reference={id:'key-a',revision:2};
 const credentialRef=github.githubCredentialRef(reference);
 assert.equal(credentialRef,'github-credential:["key-a",2]');
 assert.deepEqual(github.githubCredentialTarget({...connection,credentialRef}),{
  reference:{id:'key-a',revision:2},binding:{connectionId:'gh',endpoint:'https://api.github.com',provider:'github'},
 });
});
test('GitHub credential decoding refuses legacy opaque values and noncanonical or invalid references',()=>{
 for(const credentialRef of [null,'key-a','github-credential:["key-a",0]','github-credential:["key-a",1.5]','github-credential:[ "key-a",2]','github-credential:["key-a",2,"secret"]','github-credential:["../key",2]']){
  assert.equal(github.githubCredentialTarget({...connection,credentialRef}),undefined);
 }
});
test('GitHub credential binding rejects disabled or retargeted connections',()=>{
 const credentialRef=github.githubCredentialRef({id:'key-a',revision:1});
 for(const change of [{enabled:false},{adapter:'local'},{endpoint:'https://other.invalid'},{id:''}]){
  assert.equal(github.githubCredentialTarget({...connection,credentialRef,...change}),undefined);
 }
});
