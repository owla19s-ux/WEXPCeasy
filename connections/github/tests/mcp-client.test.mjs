import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as github from '../../../dist/connections/github/src/index.js';
const command=process.execPath;
const expectedSha256=createHash('sha256').update(readFileSync(command)).digest('hex');
const fixture=fileURLToPath(new URL('./fixtures/mcp-server.mjs',import.meta.url));
const connection={id:'gh',adapter:'github',endpoint:'https://api.github.com',credentialRef:'fixture-ref',enabled:true};
const file={owner:'owner',repo:'repo',ref:'a'.repeat(40),path:'file.txt'};
const target=github.githubFileTarget(file);
const access=(check=()=>true)=>({request:{},check});
function reader(mode='ok',extra={}){
 return github.createGitHubMcpFileReader({runtime:{command,expectedSha256,prefixArgs:[fixture,mode]},resolveCredential:async()=> 'fixture-token',timeoutMs:3000,...extra});
}
test('MCP uses real SDK initialization discovery and exact pinned-file identity',async()=>{
 const result=await reader().read(connection,target,new AbortController().signal,access());
 assert.equal(result.content,'hello');assert.equal(result.ref,file.ref);
 assert.equal(result.sha,'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
 assert.ok(!JSON.stringify(result).includes('fixture-token'));
});
for(const mode of ['uri','version','tools','error','exit']){
 test('MCP rejects '+mode+' without returning server details or credentials',async()=>{
  await assert.rejects(reader(mode).read(connection,target,new AbortController().signal,access()),
   error=>error.message==='github_mcp_unavailable'&&!JSON.stringify(error).includes('fixture-token'));
 });
}
test('MCP rejects mutable branch refs before obtaining credentials or launching',async()=>{
 let calls=0;
 const adapter=reader('ok',{resolveCredential:async()=>{calls++;return 'fixture-token';}});
 await assert.rejects(adapter.read(connection,github.githubFileTarget({...file,ref:'main'}),new AbortController().signal,access()));
 assert.equal(calls,0);
});
test('MCP denies stale authority and verifies binary integrity before credential resolution',async()=>{
 let calls=0;const resolveCredential=async()=>{calls++;return 'fixture-token';};
 await assert.rejects(reader('ok',{resolveCredential}).read(connection,target,new AbortController().signal,access(()=>false)));
 await assert.rejects(reader('ok',{resolveCredential,runtime:{command,expectedSha256:'0'.repeat(64),prefixArgs:[fixture,'ok']}}).read(connection,target,new AbortController().signal,access()));
 assert.equal(calls,0);
});
test('MCP revocation during credential lookup blocks process start',async()=>{
 let enabled=true;
 await assert.rejects(reader('ok',{resolveCredential:async()=>{enabled=false;return 'fixture-token';}}).read(connection,target,new AbortController().signal,access(()=>enabled)));
});
test('MCP cancellation and timeout stop the per-call process without replay',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(reader().read(connection,target,controller.signal,access()));
 await assert.rejects(reader('slow',{timeoutMs:1000}).read(connection,target,new AbortController().signal,access()),{message:'github_mcp_unavailable'});
});

test('MCP authority exceptions cannot escape as credential-bearing errors',async()=>{
 await assert.rejects(reader().read(connection,target,new AbortController().signal,access(()=>{throw Error('fixture-token');})),
  {message:'github_mcp_unavailable'});
});
test('MCP timeout also bounds a stalled trusted credential resolver',{timeout:5000},async()=>{
 let entered=false;
 await assert.rejects(reader('ok',{timeoutMs:1000,resolveCredential:()=>{entered=true;return new Promise(()=>{});}}).read(connection,target,new AbortController().signal,access()),
  {message:'github_mcp_unavailable'});
 assert.equal(entered,true);
});

test('MCP credential lookup uses the captured connection rather than caller mutations',async()=>{
 const input={...connection};
 const adapter=reader('ok',{resolveCredential:async(c)=>{
  assert.equal(c.id,'gh');assert.equal(c.endpoint,'https://api.github.com');
  assert.equal(c.credentialRef,'fixture-ref');return 'fixture-token';
 }});
 const pending=adapter.read(input,target,new AbortController().signal,access());
 input.id='other';input.endpoint='https://other.invalid';input.credentialRef='other-ref';
 assert.equal((await pending).content,'hello');
});
