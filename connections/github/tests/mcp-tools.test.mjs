import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as github from '../../../dist/connections/github/src/index.js';
const command=process.execPath;
const expectedSha256=createHash('sha256').update(readFileSync(command)).digest('hex');
const fixture=fileURLToPath(new URL('./fixtures/mcp-tools-server.mjs',import.meta.url));
const connection={id:'gh',adapter:'github',endpoint:'https://api.github.com',credentialRef:'fixture-ref',enabled:true};
const access=(check=()=>true)=>({request:{},check});
const signal=()=>new AbortController().signal;
function adapter(mode='ok',extra={}){
 assert.equal(typeof github.createGitHubMcpAdapter,'function','generic MCP adapter must be exported');
 return github.createGitHubMcpAdapter(connection,{runtime:{command,expectedSha256,prefixArgs:[fixture,mode]},
  resolveCredential:async()=> 'fixture-token',timeoutMs:3000,...extra});
}
test('generic MCP discovers every page and preserves schemas, metadata and server version',async t=>{
 const a=adapter();t.after(()=>a.stop());
 const tools=await a.listTools(signal(),access());
 assert.deepEqual(tools.map(x=>x.name),['get_repository','pull_request_read','actions_list']);
 assert.deepEqual(tools[1].inputSchema.properties,{nested:{type:'object'}});
 assert.deepEqual(tools[1]._meta,{fixture:true});
 assert.equal(a.status().serverVersion.version,'future-source-build');
 assert.equal(a.status().state,'connected');
});
test('one generic path calls repository PR and Actions tools with original arguments and results',async t=>{
 const a=adapter();t.after(()=>a.stop());
 const args={nested:{values:[1,true,null]},fail:true};
 let pid,cwd;
 for(const name of ['get_repository','pull_request_read','actions_list']){
  const r=await a.callTool(name,args,signal(),access());
  assert.equal(r.content[0].text,name);assert.equal(r.isError,true);
  assert.deepEqual(r.structuredContent.arguments,args);
  assert.equal(r.structuredContent.allTools,true);assert.equal(r.structuredContent.readOnly,false);
  if(pid)assert.equal(r.structuredContent.pid,pid);
  pid=r.structuredContent.pid;cwd=r.structuredContent.cwd;
 }
 await a.stop();assert.equal(a.status().state,'stopped');assert.equal(existsSync(cwd),false);
 await assert.rejects(a.listTools(signal(),access()));
});
test('unknown tools never reach tools/call and failed calls are never replayed',async t=>{
 const a=adapter();t.after(()=>a.stop());
 await assert.rejects(a.callTool('not_discovered',{},signal(),access()),{message:'github_mcp_tool_unavailable'});
 const r=await a.callTool('get_repository',{},signal(),access());
 assert.equal(r.structuredContent.calls,1);
});
test('session reuse resolves credentials and checks fresh authority for each invocation',async t=>{
 let lookups=0,enabled=true;
 const a=adapter('ok',{resolveCredential:async()=>{lookups++;return 'fixture-token';}});t.after(()=>a.stop());
 await a.listTools(signal(),access());
 await assert.rejects(a.listTools(signal(),access(()=>false)));
 assert.equal(lookups,1);
 await a.listTools(signal(),access());assert.equal(lookups,2);
 await assert.rejects(a.listTools(signal(),access(()=>{throw Error('fixture-token');})),
  error=>!error.message.includes('fixture-token'));
 enabled=false;
 await assert.rejects(a.callTool('get_repository',{},signal(),access(()=>enabled)));
});
test('credential rotation replaces a session instead of reusing the old account',async t=>{
 let token='first-token';
 const a=adapter('ok',{resolveCredential:async()=>token});t.after(()=>a.stop());
 const first=await a.callTool('get_repository',{},signal(),access());
 token='second-token';
 const second=await a.callTool('get_repository',{},signal(),access());
 assert.notEqual(first.structuredContent.pid,second.structuredContent.pid);
 assert.equal(existsSync(first.structuredContent.cwd),false);
 assert.ok(!JSON.stringify(a.status()).includes('token'));
});
test('connection and arguments are captured before asynchronous preparation',async t=>{
 const input={...connection};
 const a=github.createGitHubMcpAdapter(input,{runtime:{command,expectedSha256,prefixArgs:[fixture,'ok']},
 resolveCredential:async c=>{assert.equal(c.id,'gh');assert.equal(c.credentialRef,'fixture-ref');return 'fixture-token';}});
 t.after(()=>a.stop());input.id='other';input.credentialRef='other';
 const args={nested:{value:'original'}};
 const pending=a.callTool('get_repository',args,signal(),access());args.nested.value='changed';
 assert.equal((await pending).structuredContent.arguments.nested.value,'original');
});
for(const mode of ['cursor-loop','slow-list']){
 test('discovery rejects '+mode+' and releases the session',async t=>{
  const a=adapter(mode,{timeoutMs:1000});t.after(()=>a.stop());
  await assert.rejects(a.listTools(signal(),access()),{message:'github_mcp_unavailable'});
  assert.equal(a.status().state,'disconnected');
 });
}
test('credential resolution timeout and revocation prevent launch',async t=>{
 const a=adapter('ok',{timeoutMs:1000,resolveCredential:()=>new Promise(()=>{})});t.after(()=>a.stop());
 await assert.rejects(a.listTools(signal(),access()),{message:'github_mcp_unavailable'});
 let enabled=true;
 const b=adapter('ok',{resolveCredential:async()=>{enabled=false;return 'fixture-token';}});t.after(()=>b.stop());
 await assert.rejects(b.listTools(signal(),access(()=>enabled)));
 assert.equal(b.status().state,'disconnected');
});
test('hash mismatch is rejected before credential lookup',async t=>{
 let calls=0;
 const a=adapter('ok',{runtime:{command,expectedSha256:'0'.repeat(64),prefixArgs:[fixture,'ok']},
 resolveCredential:async()=>{calls++;return 'fixture-token';}});t.after(()=>a.stop());
 await assert.rejects(a.listTools(signal(),access()));assert.equal(calls,0);
});
test('cancellation of dispatched calls reports unconfirmed outcome and permits no replay',async t=>{
 const a=adapter('slow');t.after(()=>a.stop());
 await a.listTools(signal(),access());
 const abort=new AbortController();
 const pending=a.callTool('get_repository',{},abort.signal,access());
 setTimeout(()=>abort.abort(),100);
 await assert.rejects(pending,{message:'github_mcp_outcome_unconfirmed'});
 assert.equal(a.status().state,'disconnected');
});
test('disconnect after dispatch reports unknown outcome without automatic reconnect or retry',async t=>{
 const a=adapter('exit');t.after(()=>a.stop());
 await assert.rejects(a.callTool('get_repository',{},signal(),access()),{message:'github_mcp_outcome_unconfirmed'});
 assert.equal(a.status().state,'disconnected');
});
test('stop cancels in-flight discovery and drains queued invocations',async()=>{
 const a=adapter('slow-list');
 const first=a.listTools(signal(),access()),second=a.listTools(signal(),access());
 const settled=Promise.allSettled([first,second]);
 await new Promise(r=>setTimeout(r,100));await a.stop();
 assert.deepEqual((await settled).map(x=>x.status),['rejected','rejected']);
 assert.equal(a.status().state,'stopped');
});
