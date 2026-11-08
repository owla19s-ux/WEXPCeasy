import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as github from '../../../dist/connections/github/src/index.js';
const command=process.execPath;
const expectedSha256=createHash('sha256').update(readFileSync(command)).digest('hex');
const fixture=fileURLToPath(new URL('./fixtures/mcp-generic-server.mjs',import.meta.url));
const connection={id:'gh',adapter:'github',endpoint:'https://api.github.com',credentialRef:'fixture-ref',enabled:true};
function setup(mode='ok',extra={}){
 let allowed=true,credentials=0;
 const adapter=github.createGitHubMcpAdapter({runtime:{command,expectedSha256,prefixArgs:[fixture,mode]},
  resolveCredential:async()=>{credentials++;return 'fixture-token';},timeoutMs:3000,...extra});
 return {adapter,access:{request:{},check:()=>allowed},revoke:()=>{allowed=false;},credentials:()=>credentials};
}
test('generic MCP export exists',()=>assert.equal(typeof github.createGitHubMcpAdapter,'function'));
test('discovers all pages and preserves schemas, annotations and server version',async()=>{
 const {adapter,access}=setup();
 try{
  assert.equal(adapter.status().state,'stopped');
  await adapter.start(connection,access);
  const tools=await adapter.listTools();
  assert.deepEqual(tools.map(t=>t.name),['get_file_contents','pull_request_read','actions_list']);
  assert.equal(tools[1].inputSchema.properties.method.type,'string');
  assert.equal(tools[1].annotations.readOnlyHint,true);
  assert.equal(adapter.status().server.version,'9.9.9');
  assert.equal(adapter.status().toolCount,3);
 }finally{await adapter.stop();}
 assert.equal(adapter.status().state,'stopped');
 await assert.rejects(adapter.listTools(),{message:'github_mcp_unavailable'});
});
test('one session invokes three tool categories with raw arguments and result fields',async()=>{
 const s=setup();const {adapter,access}=s;
 try{
  await Promise.all([adapter.start(connection,access),adapter.start(connection,access)]);
  const results=[];
  for(const name of ['get_file_contents','pull_request_read','actions_list']){
   const args={owner:'owner',repo:'repo',method:'list',nested:{number:17,values:[false,null]}};
   const result=await adapter.callTool(name,args);
   assert.deepEqual(result.structuredContent.arguments,args);
   assert.equal(result.structuredContent.name,name);
   assert.equal(result.content[0].text,'fixture result');
   results.push(result);
  }
  assert.equal(new Set(results.map(r=>r.structuredContent.pid)).size,1);
  assert.equal(s.credentials(),1);
  const businessError=await adapter.callTool('actions_list',{fail:true});
  assert.equal(businessError.isError,true);
  assert.equal(businessError.structuredContent.reason,'fixture_failure');
  assert.equal(adapter.status().state,'connected');
 }finally{await adapter.stop();}
});
test('rejects unknown tools before sending and snapshots arguments at invocation',async()=>{
 const {adapter,access}=setup();
 try{
  await adapter.start(connection,access);
  await assert.rejects(adapter.callTool('unknown',{}),{message:'github_mcp_tool_unavailable'});
  const args={nested:{value:'original'}};
  const pending=adapter.callTool('actions_list',args);args.nested.value='mutated';
  assert.equal((await pending).structuredContent.arguments.nested.value,'original');
 }finally{await adapter.stop();}
});
test('checks authority on a reused session and closes it after revocation',async()=>{
 const {adapter,access,revoke}=setup();
 await adapter.start(connection,access);await adapter.callTool('actions_list',{});
 revoke();
 await assert.rejects(adapter.callTool('actions_list',{}),{message:'github_mcp_unavailable'});
 assert.equal(adapter.status().state,'error');
 await adapter.stop();
});
test('captures connection before async preparation and rejects rebinding a live session',async()=>{
 const {adapter,access}=setup();
 const input={...connection};const pending=adapter.start(input,access);
 input.id='changed';input.credentialRef='changed';
 try{
  await pending;
  assert.equal(adapter.status().connectionId,'gh');
  await assert.rejects(adapter.start({...connection,id:'other'},access),{message:'github_mcp_connection_mismatch'});
 }finally{await adapter.stop();}
});
for(const mode of ['cycle','duplicate','exit']){
 test('fails closed for '+mode+' without exposing server errors',async()=>{
  const {adapter,access}=setup(mode);
  try{
   if(mode==='exit'){await adapter.start(connection,access);await assert.rejects(adapter.callTool('actions_list',{}),{message:'github_mcp_unavailable'});}
   else await assert.rejects(adapter.start(connection,access),{message:'github_mcp_unavailable'});
   assert.equal(adapter.status().state,'error');
  }finally{await adapter.stop();}
 });
}
test('verifies executable before credential lookup',async()=>{
 let credentials=0;
 const {adapter,access}=setup('ok',{runtime:{command,expectedSha256:'0'.repeat(64),prefixArgs:[fixture,'ok']},
  resolveCredential:async()=>{credentials++;return 'fixture-token';}});
 await assert.rejects(adapter.start(connection,access),{message:'github_mcp_unavailable'});
 assert.equal(credentials,0);await adapter.stop();
});
test('timeout bounds a stalled credential resolver',async()=>{
 const {adapter,access}=setup('ok',{timeoutMs:100,resolveCredential:()=>new Promise(()=>{})});
 await assert.rejects(adapter.start(connection,access),{message:'github_mcp_unavailable'});
 await adapter.stop();
});
test('cancellation and stop interrupt pending calls without replay',async()=>{
 for(const stop of [false,true]){
  const {adapter,access}=setup('slow');
  await adapter.start(connection,access);
  const controller=new AbortController();
  const pending=adapter.callTool('actions_list',{},controller.signal);
  const rejected=assert.rejects(pending,{message:'github_mcp_unavailable'});
  if(stop)await adapter.stop();else controller.abort();
  await rejected;await adapter.stop();
  assert.equal(adapter.status().state,'stopped');
 }
});
test('revocation while receiving a response withholds the response',async()=>{
 const {adapter,access,revoke}=setup('slow');
 try{
  await adapter.start(connection,access);
  const pending=adapter.callTool('actions_list',{});
  revoke();
  await assert.rejects(pending,{message:'github_mcp_unavailable'});
 }finally{await adapter.stop();}
});

test('idle server exit invalidates its status and catalog without reconnecting',async()=>{
 const {adapter,access}=setup('idle-exit');
 try{
  await adapter.start(connection,access);
  const until=Date.now()+3000;
  while(adapter.status().state==='connected'&&Date.now()<until)await new Promise(r=>setTimeout(r,25));
  assert.equal(adapter.status().state,'error');
  assert.equal(adapter.status().toolCount,0);
  await assert.rejects(adapter.callTool('actions_list',{}),{message:'github_mcp_unavailable'});
 }finally{await adapter.stop();}
});
