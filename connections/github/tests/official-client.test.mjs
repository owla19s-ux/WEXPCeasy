import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as github from '../../../dist/connections/github/src/index.js';
const connection={id:'gh',adapter:'github',endpoint:'https://api.github.com',credentialRef:'fixture-ref',enabled:true};
const file={owner:'owner',repo:'repo',ref:'main',path:'file.txt'};
const target=github.githubFileTarget(file);
const access=(check=()=>true)=>({request:{},check});
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
test('official Octokit factory reads through the existing product reader with a private credential',async()=>{
 const calls=[];const secret='fixture-secret-never-persist';
 const factory=github.createGitHubOfficialClientFactory({resolveCredential:async(c,a)=>{
  assert.equal(c.id,'gh');assert.equal(c.credentialRef,'fixture-ref');assert.ok(a.check());return secret;
 },fetch:async(url,init)=>{
  calls.push({url:String(url),authorization:new Headers(init.headers).get('authorization')});
  return response(200,{type:'file',path:'file.txt',sha:'a'.repeat(40),encoding:'base64',content:'aGVsbG8=',size:5});
 }});
 const result=await github.createGitHubFileReader(connection,factory).read(target,new AbortController().signal,access());
 assert.equal(result.content,'hello');assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.github.com/repos/owner/repo/contents/file.txt?ref=main');
 assert.equal(calls[0].authorization,'token '+secret);
 assert.ok(!JSON.stringify(result).includes(secret));
});
test('official SDK never retries a failed write and exposes no credential in errors',async()=>{
 let calls=0;
 const factory=github.createGitHubOfficialClientFactory({resolveCredential:async()=> 'fixture-token',
 fetch:async()=>{calls++;return response(500,{message:'fixture-token provider failure'});}});
 const adapter=github.createGitHubFileAdapter(factory);
 await assert.rejects(adapter.execute(connection,target,{kind:'put',message:'test',content:'x',expectedSha:null},access()),
  {message:'github_outcome_unconfirmed'});
 assert.equal(calls,1);
});
test('official client checks authority before resolving credentials and before every SDK call',async()=>{
 let resolutions=0,calls=0,enabled=true;
 const factory=github.createGitHubOfficialClientFactory({resolveCredential:async()=>{resolutions++;return 'fixture-token';},
 fetch:async()=>{calls++;return response(200,{});}});
 await assert.rejects(factory(connection),{message:'github_access_unavailable'});
 await assert.rejects(factory(connection,access(()=>false)),{message:'github_access_unavailable'});
 assert.equal(resolutions,0);
 const client=await factory(connection,access(()=>enabled));enabled=false;
 await assert.rejects(client.rest.repos.getContent({...file,request:{signal:new AbortController().signal}}),
  {message:'github_access_unavailable'});
 assert.equal(calls,0);
});
test('revocation during credential lookup prevents any SDK request',async()=>{
 let enabled=true,calls=0;
 const factory=github.createGitHubOfficialClientFactory({resolveCredential:async()=>{enabled=false;return 'fixture-token';},
 fetch:async()=>{calls++;return response(200,{});}});
 await assert.rejects(factory(connection,access(()=>enabled)),{message:'github_access_unavailable'});
 assert.equal(calls,0);
});
test('SDK errors retain only numeric status needed by existing adapter classification',async()=>{
 const factory=github.createGitHubOfficialClientFactory({resolveCredential:async()=> 'fixture-token',
 fetch:async()=>response(409,{message:'fixture-token conflict'})});
 const result=await github.createGitHubFileAdapter(factory).execute(connection,target,{kind:'put',message:'test',content:'x',expectedSha:null},access());
 assert.deepEqual(result,{status:'conflict',reason:'github_version_or_validation_conflict'});
});
test('SDK read is cancelled before transport and connection endpoint cannot be redirected',async()=>{
 let calls=0;
 const factory=github.createGitHubOfficialClientFactory({resolveCredential:async()=> 'fixture-token',
 fetch:async()=>{calls++;return response(200,{});}});
 await assert.rejects(factory({...connection,endpoint:'https://other.invalid'},access()));
 const client=await factory(connection,access());const controller=new AbortController();controller.abort();
 await assert.rejects(client.rest.repos.getContent({...file,request:{signal:controller.signal}}));
 assert.equal(calls,0);
});
