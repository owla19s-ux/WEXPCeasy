import {app,BrowserWindow} from 'electron';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,lstat,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {runDesktop} from '../../../dist/app/src/desktop-runtime.js';
import {startFoundations} from '../../../dist/app/src/index.js';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
async function verify(){
app.enableSandbox();
// Xvfb has no GPU; use Chromium software rendering for the CI bitmap only.
if(process.platform==='linux')app.disableHardwareAcceleration();
const root=process.env.WEX_DESKTOP_FIXTURE_ROOT;assert.ok(root,'parent-owned test root');
const id=randomUUID();await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id}));
await mkdir(join(root,'electron-user'));await mkdir(join(root,'electron-session'));
app.setPath('userData',join(root,'electron-user'));
app.setPath('sessionData',join(root,'electron-session'));
const contextRoot=join(root,'selected-context');await mkdir(contextRoot);await writeFile(join(contextRoot,'.wex-root.json'),JSON.stringify({format:1,id:randomUUID()}));
let nativeAllowed=true;const confirmations=[];
let failClose=true;
const startup=policy=>startFoundations({dataRoot:root,expectedRootId:id,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false},
 space:{},api:{},conversations:true,ai:{bindRead:()=>undefined},localFiles:{},localDirectories:{},technicalDiagnostics:{},
 openStore(path,namespace){const db=openSqliteStore(path,namespace);return {...db,close(){if(failClose&&namespace==='permissions'){failClose=false;throw Error('injected-close');}db.close();}};},...policy});
const timer=setTimeout(()=>{console.error('desktop_runtime_timeout');app.exit(1);},45000);
try{
 const runtime=await runDesktop({url:pathToFileURL(resolve('desktop-dist/index.html')).href,preload:resolve('desktop-dist/preload.cjs'),start:startup,spaceRootId:id,spacePlatform:{confirm:async summary=>{confirmations.push(summary);return nativeAllowed;},chooseDirectory:async()=>contextRoot},show:process.platform==='linux'});
 const host=await runtime.lifecycle.start();
 assert.equal(host.status,'ready');for(const name of ['space','api','ai','conversations','connections','localFiles','localDirectories','permissions'])assert.ok(host[name],name);
 assert.deepEqual(host.permissions.evaluate({}),{status:'indeterminate',reason:'trusted_facts_missing'});
 const wc=runtime.window.webContents;
 const facts=await wc.executeJavaScript(`(async()=>({node:typeof require,process:typeof process,bridge:Object.keys(window.wexHost).sort(),reply:await window.wexHost.readStatus(),title:document.title,text:document.body.innerText}))()`);
 assert.equal(facts.node,'undefined');assert.equal(facts.process,'undefined');
 assert.deepEqual(facts.bridge,['readStatus','requestQuit','space']);assert.equal(facts.reply.ok,true);
 assert.equal(facts.reply.value.phase,'ready');assert.equal(facts.title,'WEXPCeasy');assert.match(facts.text,/WEXPCeasy/);
// Exercise the actual React form through DOM events; only native platform interactions are fixtures.
 const click=async text=>wc.executeJavaScript(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('button_missing');b.click();return true;})()`);
 const waitFor=async expression=>{const end=Date.now()+10000;while(!await wc.executeJavaScript(expression)){if(Date.now()>end)throw Error('renderer_wait_timeout');await new Promise(r=>setTimeout(r,25));}};
 await click('打开工作区');await waitFor("!!document.querySelector('form input')");
 await wc.executeJavaScript(`(()=>{const field=document.querySelector('form input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'Desktop Space');field.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 await new Promise(r=>setTimeout(r,30));await wc.executeJavaScript("document.querySelector('form').requestSubmit();true");
 await waitFor("[...document.querySelectorAll('nav button')].some(x=>x.textContent==='Desktop Space')");
 const invoke=async input=>{const reply=await wc.executeJavaScript('window.wexHost.space('+JSON.stringify(input)+')');assert.equal(reply.ok,true);return reply.value;};
 const created=await invoke({kind:'context.create',name:'Desktop Context',description:'persistent'});assert.equal(created.status,'committed');
 const snapshot=await invoke({kind:'snapshot'});assert.equal(snapshot.status,'ok');assert.equal(snapshot.contexts[0].id,created.id);
 const group=await invoke({kind:'group.create',spaceId:snapshot.spaces[0].id,name:'Desktop Group'});assert.equal(group.status,'committed');
 assert.equal((await invoke({kind:'context.group',contextId:created.id,spaceId:snapshot.spaces[0].id,groupId:group.id,expectedRevision:0})).status,'committed');
 await click('刷新工作区');await waitFor("[...document.querySelectorAll('nav button')].some(x=>x.textContent.includes('Desktop Context'))");
 await wc.executeJavaScript("[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Desktop Context')).click();true");
 await waitFor("!!document.querySelector('article small')&&document.querySelector('article small').textContent.includes("+JSON.stringify(created.id)+")");
 nativeAllowed=false;assert.equal((await invoke({kind:'space.create',name:'Declined'})).status,'cancelled');nativeAllowed=true;
 assert.equal((await invoke({kind:'context.create',name:'Injected',location:'/untrusted'})).status,'rejected');
 const checked=await invoke({kind:'snapshot'});assert.equal(checked.spaces.length,1);assert.equal(checked.organizations[0].groupId,group.id);
 
 const prefs=wc.getLastWebPreferences();assert.equal(prefs.sandbox,true);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.nodeIntegration,false);
 assert.equal((await lstat(join(root,'.wex-write-lock'))).isDirectory(),true);
 const network=await wc.executeJavaScript(`fetch('https://example.com').then(()=>false,()=>true)`);assert.equal(network,true);
 const before=wc.getURL();await wc.executeJavaScript(`window.open('https://example.com');true`);assert.equal(wc.getURL(),before);assert.equal(BrowserWindow.getAllWindows().length,1);
 const promptCount=confirmations.length;
 const foreign=new BrowserWindow({show:false,webPreferences:{preload:resolve('desktop-dist/preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await foreign.loadURL(before);
 for(const method of ['readStatus','requestQuit']){
  assert.deepEqual(await foreign.webContents.executeJavaScript('window.wexHost.'+method+'()'),{ok:false,error:'untrusted_sender'});
 }
 assert.deepEqual(await foreign.webContents.executeJavaScript("window.wexHost.space({kind:'snapshot'})"),{ok:false,error:'untrusted_sender'});
 assert.equal(confirmations.length,promptCount);
 foreign.destroy();assert.equal(runtime.readStatus().phase,'ready');
 await writeFile(resolve('desktop-acceptance',process.platform+'.png'),(await wc.capturePage()).toPNG());
 // A close failure must leave the process and root lease alive, then permit retry.
 const quitReply=await wc.executeJavaScript('window.wexHost.requestQuit()');assert.deepEqual(quitReply,{ok:true,value:{accepted:true}});
 await new Promise((res,rej)=>{const end=Date.now()+8000;const poll=()=>runtime.readStatus().phase==='release-pending'?res():Date.now()>end?rej(Error('release phase timeout')):setTimeout(poll,20);poll();});
 assert.equal(runtime.window.isDestroyed(),false);assert.equal((await lstat(join(root,'.wex-write-lock'))).isDirectory(),true);
 assert.equal((await runtime.lifecycle.stop()).status,'stopped');
 const reopened=await startFoundations({dataRoot:root,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false}});
 assert.equal(reopened.status,'ready');assert.equal((await reopened.stop()).status,'stopped');
 const report={source:process.env.GITHUB_SHA??'unknown',platform:process.platform,rendering:process.platform==='linux'?'software-xvfb':'default',electron:process.versions.electron,node:process.versions.node,sqlite:process.versions.sqlite,checks:['React Space creation and Context navigation via actual DOM events','real SQLite Context create and group movement via IPC','native decline and path injection rejected','sandboxed React and narrow preload','default-deny identity','CSP network denied','window open denied','foreign real WebContents cannot read status or quit','quit waits and retains lease on release failure','retry releases real SQLite and root; restart succeeds']};
 await writeFile(resolve('desktop-acceptance',process.platform+'.json'),JSON.stringify(report,null,2));
 console.log('DESKTOP_ACCEPTANCE '+JSON.stringify(report));clearTimeout(timer);app.quit();
}catch(error){console.error(error);clearTimeout(timer);app.exit(1);}

}
void verify().catch(error=>{console.error(error);app.exit(1);});
