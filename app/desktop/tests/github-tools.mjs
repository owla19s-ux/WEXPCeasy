import assert from 'node:assert/strict';
import {app,BrowserWindow} from 'electron';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {runDesktop} from '../../../dist/app/src/desktop-runtime.js';
import {startFoundations} from '../../../dist/app/src/index.js';

app.enableSandbox();if(process.platform==='linux')app.disableHardwareAcceleration();
const token=process.env.WEX_GITHUB_READ_TOKEN;assert.ok(token);
const [owner,repo]=process.env.GITHUB_REPOSITORY.split('/');
const command=resolve(process.env.WEX_GITHUB_MCP_BINARY);
const expectedSha256=createHash('sha256').update(await readFile(command)).digest('hex');
const root=await mkdtemp(join(tmpdir(),'wex-github-tool-ui-')),id='github-tool-ui';
await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id}));
await mkdir(join(root,'user'));await mkdir(join(root,'session'));
app.setPath('userData',join(root,'user'));app.setPath('sessionData',join(root,'session'));
const key=randomBytes(32);
const cipher={available:()=>true,seal(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.update(value,'utf8'),c.final(),c.getAuthTag()]).toString('base64');},
 unseal(value){const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8');}};
let nativeAllowed=true,runtime,host;const prompts=[];
const timer=setTimeout(()=>{console.error('github_tool_ui_timeout');app.exit(1);},120000);
try{
 runtime=await runDesktop({url:pathToFileURL(resolve('desktop-dist/index.html')).href,preload:resolve('desktop-dist/preload.cjs'),show:true,spaceRootId:id,
  spacePlatform:{confirm:async summary=>{prompts.push(summary);return nativeAllowed;},chooseDirectory:async()=>undefined},
  start:policy=>startFoundations({dataRoot:root,expectedRootId:id,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false},
   space:{},api:{},conversations:true,ai:{bindRead:()=>undefined},credentials:{cipher},githubOfficial:{mcpRuntime:{command,expectedSha256},timeoutMs:60000},...policy})});
 host=await runtime.lifecycle.start();assert.equal(host.status,'ready');
 const wc=runtime.window.webContents;
 async function waitFor(expression){
  const until=Date.now()+30000;
  while(Date.now()<until){if(await wc.executeJavaScript(expression))return;await new Promise(r=>setTimeout(r,30));}
  throw Error('UI condition timed out');
 }
 async function click(text){
  await wc.executeJavaScript('(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==='+JSON.stringify(text)+'&&!b.disabled);if(!b)throw Error("button unavailable");b.click();return true;})()');
 }
 async function change(selector,value,tag='HTMLInputElement'){
  await wc.executeJavaScript('(()=>{const el=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor('+tag+'.prototype,"value").set.call(el,'+JSON.stringify(value)+');el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
 }
 await waitFor('!!document.querySelector("[data-workbench]")');
 await click('设置');await click('GitHub / Local');await click('读取连接与操作记录');
 await waitFor('!!document.querySelector("[data-connection-settings] select[name=github-tools-connection]")');
 await click('登记 GitHub 连接');
 await waitFor('[...document.querySelectorAll("button")].some(b=>b.textContent==="安全录入 GitHub Token")');
 await click('安全录入 GitHub Token');
 let secure;const until=Date.now()+15000;
 while(Date.now()<until){
  secure=BrowserWindow.getAllWindows().find(w=>w!==runtime.window);
  try{if(secure&&await secure.webContents.executeJavaScript('!!document.querySelector("input[type=password]:not(:disabled)")'))break;}catch{}
  await new Promise(r=>setTimeout(r,30));
 }
 assert.ok(secure,'isolated credential window missing');
 try{await secure.webContents.executeJavaScript('document.querySelector("input[type=password]").value='+JSON.stringify(token)+';document.querySelector("form").requestSubmit();true');}
 catch{if(!secure.isDestroyed())throw Error('secure credential submission failed');}
 await waitFor('document.querySelector("[data-connection-settings]").textContent.includes("已引用凭证")');
 const connectionId=await wc.executeJavaScript('document.querySelector("select[name=github-tools-connection]").options[1].value');
 await change('select[name=github-tools-connection]',connectionId,'HTMLSelectElement');
 await waitFor('!!document.querySelector("[data-github-tools]")');
 await click('读取官方工具目录');
 await waitFor('document.querySelectorAll("select[name=github-tool] option").length>0');
 const toolCount=await wc.executeJavaScript('document.querySelectorAll("select[name=github-tool] option").length');
 await change('select[name=github-tool]','actions_list','HTMLSelectElement');
 await change('textarea[name=github-tool-arguments]',JSON.stringify({method:'list_workflows',owner,repo,perPage:3}),'HTMLTextAreaElement');
 const before=host.connections.operations.read().operations.length;
 nativeAllowed=false;await click('确认调用所选工具');
 await waitFor('document.querySelector("[data-github-tools] [role=status]").textContent.includes("取消")');
 assert.equal(host.connections.operations.read().operations.length,before);
 nativeAllowed=true;await click('确认调用所选工具');
 await waitFor('!!document.querySelector("[data-tool-result]")');
 const displayed=await wc.executeJavaScript('JSON.parse(document.querySelector("[data-tool-result] pre").textContent)');
 assert.notEqual(displayed.isError,true);
 assert.ok(Array.isArray(displayed.content));assert.equal(host.connections.operations.read().operations.length,before+1);
 assert.ok(prompts.some(p=>p.includes('actions_list')&&p.includes('list_workflows')));
 const visible=await wc.executeJavaScript('document.body.textContent');assert.equal(visible.includes(token),false);
 await mkdir('desktop-acceptance',{recursive:true});
 await writeFile('desktop-acceptance/github-tools-'+process.platform+'.png',(await wc.capturePage()).toPNG());
 const promptCount=prompts.length;
 const foreign=new BrowserWindow({show:false,webPreferences:{preload:resolve('desktop-dist/preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await foreign.loadURL(wc.getURL());
 const denied=await foreign.webContents.executeJavaScript('window.wexHost.connections('+JSON.stringify({kind:'github.tools',id:connectionId,expectedRevision:2})+')');
 assert.deepEqual(denied,{ok:false,error:'untrusted_sender'});assert.equal(prompts.length,promptCount);foreign.destroy();
 const grants=(await wc.executeJavaScript('window.wexHost.permissions({kind:"snapshot"})')).value;
 const grant=grants.entries.find(e=>e.resource==='github'&&e.action==='write');assert.ok(grant);
 const revoked=await wc.executeJavaScript('window.wexHost.permissions('+JSON.stringify({kind:'revoke',id:grant.id,expectedRevision:grants.revision})+')');
 assert.equal(revoked.value.status,'committed');
 await waitFor('!document.querySelector("[data-tool-result]")&&!document.querySelector("select[name=github-tool]")');
 assert.equal(host.connections.operations.read().operations.length,before+1);
 const prefs=wc.getLastWebPreferences();assert.equal(prefs.sandbox,true);assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);
 assert.equal((await runtime.lifecycle.stop()).status,'stopped');host=undefined;
 await writeFile('desktop-acceptance/github-tools-'+process.platform+'.json',JSON.stringify({sha:process.env.GITHUB_SHA,platform:process.platform,
  sourceCommit:'99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3',toolCount,remoteMutations:0,
  checks:['actual React catalog selection and parameter entry','isolated credential modal','native decline sends no tool',
   'actual official Actions read through IPC and WEX adapter','observed Operation result rendered','foreign WebContents rejected','revocation clears catalog and result','no automatic replay','sandbox retained','runtime cleanup confirmed'],
  fixtures:['scripted native confirmation','ephemeral AES credential cipher'],limitations:['runtime supplied by trusted test host','no installer or manual desktop acceptance']},null,2));
 console.info('Official MCP desktop tool UI acceptance passed; tool count: '+toolCount+'; remote mutations: 0.');
 clearTimeout(timer);await rm(root,{recursive:true,force:true});app.quit();
}catch{
 try{await runtime?.lifecycle.stop();}catch{}
 clearTimeout(timer);console.error('github_tool_ui_acceptance_failed');app.exit(1);
}
