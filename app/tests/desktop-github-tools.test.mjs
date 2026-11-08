import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {startFoundations} from '../../dist/app/src/index.js';
import {createDesktopAuthority} from '../../dist/app/src/desktop-authority.js';
import {createDesktopConnections} from '../../dist/app/src/desktop-connections.js';
async function setup(t,mode='ok',installed=true){
 const root=await mkdtemp(join(tmpdir(),'wex-desktop-tools-'));
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'desktop-tools'}));
 let consent=true,prompts=[],unseals=0;
 const authority=createDesktopAuthority();
 const controls=createDesktopConnections({authority,confirm:async summary=>{prompts.push(summary);return consent;},requestCredential:async()=> 'fixture-token'});
 const runtime={command:process.execPath,expectedSha256:createHash('sha256').update(readFileSync(process.execPath)).digest('hex'),
  prefixArgs:[fileURLToPath(new URL('../../connections/github/tests/fixtures/mcp-generic-server.mjs',import.meta.url)),mode]};
 const host=await startFoundations({dataRoot:root,...authority.policy,githubOfficial:installed?{mcpRuntime:runtime,timeoutMs:5000}:{},
  credentials:{cipher:{available:()=>true,seal:s=>Buffer.from(s).toString('base64'),unseal:s=>{unseals++;return Buffer.from(s,'base64').toString();}}}});
 controls.attach(host);
 t.after(async()=>{controls.close();authority.close();await host.stop();await rm(root,{recursive:true,force:true});});
 let snap=await controls.request({kind:'snapshot'});
 assert.equal((await controls.request({kind:'github.create',expectedRevision:snap.revision})).status,'committed');
 snap=await controls.request({kind:'snapshot'});const id=snap.connections[0].id;
 assert.equal((await controls.request({kind:'credential.set',id,expectedRevision:snap.revision})).status,'committed');
 snap=await controls.request({kind:'snapshot'});
 return {host,controls,authority,id,revision:snap.revision,deny:()=>consent=false,prompts,unseals:()=>unseals,snap};
}
test('desktop discovers official tools and invokes one exact confirmed call with its receipt',async t=>{
 const h=await setup(t);
 assert.equal(h.snap.githubMcpConfigured,true);
 const catalog=await h.controls.request({kind:'github.tools',id:h.id,expectedRevision:h.revision});
 assert.equal(catalog.status,'tools');assert.equal(catalog.tools.length,3);
 const args={owner:'owner',repo:'repo',nested:{value:'exact'}};
 const result=await h.controls.request({kind:'github.invoke',id:h.id,expectedRevision:h.revision,toolName:'actions_list',arguments:args});
 assert.equal(result.status,'tool-result');assert.equal(result.result.structuredContent.name,'actions_list');
 assert.deepEqual(result.result.structuredContent.arguments,args);
 assert.equal(h.host.connections.operations.get(result.operationId).phase,'observed');
 assert.ok(h.prompts.at(-1).includes('actions_list'));assert.ok(h.prompts.at(-1).includes('exact'));
 assert.equal(JSON.stringify(result).includes('fixture-token'),false);
});
test('desktop rejects forged authority fields and malformed arguments before prompting',async t=>{
 const h=await setup(t),before=h.prompts.length;
 const base={kind:'github.invoke',id:h.id,expectedRevision:h.revision,toolName:'actions_list',arguments:{}};
 for(const input of [{...base,scope:'admin'},{...base,command:'/bin/sh'},{...base,arguments:[]},{...base,arguments:{value:NaN}},{...base,arguments:{secret:undefined}}])
  assert.equal((await h.controls.request(input)).status,'rejected');
 assert.equal(h.prompts.length,before);assert.equal(h.unseals(),0);
});
test('native decline and stale configuration cannot send a generic tool',async t=>{
 const h=await setup(t);h.deny();
 const input={kind:'github.invoke',id:h.id,expectedRevision:h.revision,toolName:'actions_list',arguments:{}};
 assert.equal((await h.controls.request(input)).status,'cancelled');assert.equal(h.unseals(),0);
 const stale=await setup(t);assert.equal((await stale.controls.request({...input,id:stale.id,expectedRevision:stale.revision+1})).status,'conflict');
 assert.equal(stale.unseals(),0);
});
test('tool business failure stays a tool failure, and process loss retains unknown operation',async t=>{
 const h=await setup(t);
 const failed=await h.controls.request({kind:'github.invoke',id:h.id,expectedRevision:h.revision,toolName:'actions_list',arguments:{fail:true}});
 assert.equal(failed.status,'tool-result');assert.equal(failed.result.isError,true);
 const broken=await setup(t,'exit');
 const unknown=await broken.controls.request({kind:'github.invoke',id:broken.id,expectedRevision:broken.revision,toolName:'actions_list',arguments:{}});
 assert.equal(unknown.status,'unknown');assert.ok(unknown.operationId);
 assert.equal(broken.host.connections.operations.get(unknown.operationId).phase,'unknown');
 const attempts=broken.host.connections.operations.get(unknown.operationId).attempts;
 await broken.controls.request({kind:'snapshot'});assert.equal(broken.host.connections.operations.get(unknown.operationId).attempts,attempts);
});
test('missing runtime is explicit and closed desktop entry does not return late tool data',async t=>{
 const absent=await setup(t,'ok',false);assert.equal(absent.snap.githubMcpConfigured,false);
 assert.equal((await absent.controls.request({kind:'github.tools',id:absent.id,expectedRevision:absent.revision})).status,'unavailable');
 const h=await setup(t,'slow');
 const pending=h.controls.request({kind:'github.invoke',id:h.id,expectedRevision:h.revision,toolName:'actions_list',arguments:{}});
 while(h.unseals()===0)await new Promise(r=>setTimeout(r,10));
 h.controls.close();const result=await pending;
 assert.notEqual(result.status,'tool-result');assert.ok(result.operationId);
});
