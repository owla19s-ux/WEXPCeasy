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
 const click=async text=>wc.executeJavaScript(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent.trim()===${JSON.stringify(text)}||x.getAttribute('aria-label')===${JSON.stringify(text)}));if(!b)throw Error('button_missing');b.click();return true;})()`);
 const waitFor=async expression=>{const end=Date.now()+10000;while(!await wc.executeJavaScript(expression)){if(Date.now()>end){console.error('RENDERER_WAIT',expression,await wc.executeJavaScript("({dragging:document.querySelector('[data-workbench]')?.dataset.dragging,layout:localStorage.getItem('wex.workbench.layout.v1')})"));throw Error('renderer_wait_timeout');}await new Promise(r=>setTimeout(r,25));}};
 await waitFor("!!document.querySelector('[data-workbench]')");
 await wc.executeJavaScript("document.querySelector('[aria-label=\"折叠导航\"]').click();true");
 await waitFor("document.querySelector('[data-column=\"navigation\"]').getBoundingClientRect().width===56");
 const columns=await wc.executeJavaScript("[...document.querySelectorAll('[data-column]')].map(x=>x.getBoundingClientRect().width)");
 assert.equal(columns.length,4);assert.ok(columns[2]>=360);
 const divider=await wc.executeJavaScript("(()=>{const r=document.querySelector('[data-divider=\"column-1\"]').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+80)};})()");
 wc.sendInputEvent({type:'mouseMove',...divider});wc.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...divider});
 await waitFor("document.querySelector('[data-workbench]').dataset.dragging==='true'");
 wc.sendInputEvent({type:'mouseMove',x:divider.x+24,y:divider.y});
 await waitFor("document.querySelector('[data-column=\"structure\"]').getBoundingClientRect().width>"+(columns[1]+12));
 wc.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:divider.x+24,y:divider.y});
 await waitFor("document.querySelector('[data-workbench]').dataset.dragging==='false'");
 const adjusted=await wc.executeJavaScript("document.querySelector('[data-column=\"structure\"]').getBoundingClientRect().width");
 await wc.executeJavaScript("document.querySelector('[data-divider=\"column-1\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));true");
 await waitFor("document.querySelector('[data-column=\"structure\"]').getBoundingClientRect().width<"+(adjusted-8));
 const panelBefore=await wc.executeJavaScript("document.querySelector('.aux-panel').getBoundingClientRect().height");
 const handle=await wc.executeJavaScript("(()=>{const r=document.querySelector('[data-divider=\"panel-0\"]').getBoundingClientRect();return {x:Math.round(r.x+80),y:Math.round(r.y+r.height/2)};})()");
 wc.sendInputEvent({type:'mouseMove',...handle});wc.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...handle});
 await waitFor("document.querySelector('[data-workbench]').dataset.dragging==='true'");
 wc.sendInputEvent({type:'mouseMove',x:handle.x,y:handle.y+16});
 await waitFor("document.querySelector('.aux-panel').getBoundingClientRect().height>"+(panelBefore+6));
 wc.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:handle.x,y:handle.y+16});
 await waitFor("document.querySelector('[data-workbench]').dataset.dragging==='false'");
 await wc.executeJavaScript("[...document.querySelectorAll('[aria-label=\"占满辅助列\"]')].at(-1).click();true");
 await waitFor("document.querySelectorAll('.aux-panel:not([hidden])').length===1");
 await wc.executeJavaScript("document.querySelector('[aria-label=\"还原面板\"]').click();true");
 await waitFor("document.querySelectorAll('.aux-panel:not([hidden])').length===3");
 await wc.executeJavaScript("document.querySelector('[aria-label=\"展开导航\"]').click();true");
 await waitFor("!!document.querySelector('[aria-label=\"折叠导航\"]')");
 await waitFor("JSON.parse(localStorage.getItem('wex.workbench.layout.v1')||'{}').collapsed===false");
 const saved=await wc.executeJavaScript("localStorage.getItem('wex.workbench.layout.v1')");
 const loaded=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await loaded;
 await waitFor("!!document.querySelector('[data-workbench]')");
 assert.equal(await wc.executeJavaScript("localStorage.getItem('wex.workbench.layout.v1')"),saved);
 await click('设置');await waitFor("!document.querySelector('[data-settings]').hidden");
 await click('返回工作区');
 await click('打开工作区');await waitFor("!!document.querySelector('form input')");
 await wc.executeJavaScript(`(()=>{const field=document.querySelector('form input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'Desktop Space');field.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 await new Promise(r=>setTimeout(r,30));await click('设置');await click('返回工作区');assert.equal(await wc.executeJavaScript("document.querySelector('form input').value"),'Desktop Space');await wc.executeJavaScript("document.querySelector('form').requestSubmit();true");
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
 
// Category and address controls are exercised in the actual Renderer.
 const choose=async(selector,value)=>wc.executeJavaScript(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(field.tagName==='SELECT'?HTMLSelectElement.prototype:field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;})()`);
 await choose('form select','category.create');await choose('form input','Desktop category');await new Promise(r=>setTimeout(r,25));
 await wc.executeJavaScript("document.querySelector('form').requestSubmit();true");
 await waitFor("[...document.querySelectorAll('[data-categories] button')].some(x=>x.textContent==='Desktop category')");
 const withCategory=await invoke({kind:'snapshot'});assert.equal(withCategory.categories.length,1);
 const savedCategory=withCategory.categories[0];assert.equal((await invoke({kind:'space.edit',id:withCategory.spaces[0].id,expectedRevision:withCategory.spaces[0].revision,name:'Desktop Space',categoryId:savedCategory.id})).status,'committed');
 await click('刷新工作区');await waitFor("!document.querySelector('nav button').disabled");
 await wc.executeJavaScript("[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Desktop Context')).click();true");
 await waitFor("!!document.querySelector('form[aria-label=\"地址引用\"]')");
 await choose('input[name="address-name"]','Remote repository');await choose('input[name="address-value"]','https://github.com/example/project');await choose('textarea[name="address-notes"]','reference source');await new Promise(r=>setTimeout(r,25));
 await wc.executeJavaScript("document.querySelector('form[aria-label=\"地址引用\"]').requestSubmit();true");
 await waitFor("[...document.querySelectorAll('.address-card strong')].some(x=>x.textContent==='Remote repository')");
 await click('设为主地址');await waitFor("document.querySelector('.address-card strong').textContent.includes('主地址')");
 const previewFile=join(contextRoot,'preview.txt');await writeFile(previewFile,'<script>window.resourceExecuted=true</script>Selected local text');
 const linked=await invoke({kind:'address.add',contextId:created.id,name:'Selected local file',address:pathToFileURL(previewFile).href,notes:'no import',purpose:['reference','operation']});assert.equal(linked.status,'committed');
 const fileRead=await invoke({kind:'resource.read',contextId:created.id,id:linked.id,mode:'file'});
 if(process.platform==='linux')assert.equal(fileRead.status,'ok');else assert.ok(['ok','unavailable'].includes(fileRead.status));
 await wc.executeJavaScript("[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Desktop Context')).click();true");
 await waitFor("[...document.querySelectorAll('.address-card strong')].some(x=>x.textContent==='Selected local file')");
 if(fileRead.status==='ok'){
  await wc.executeJavaScript("[...document.querySelectorAll('.address-card')].find(x=>x.textContent.includes('Selected local file')).querySelector('button').click();true");
  await waitFor("!!document.querySelector('[aria-label=\"资源预览\"] pre')");
  assert.equal(await wc.executeJavaScript('window.resourceExecuted'),undefined);
  assert.match(await wc.executeJavaScript("document.querySelector('[aria-label=\"资源预览\"] pre').textContent"),/Selected local text/);
 }
 const retained=await invoke({kind:'context.open',id:created.id});assert.equal(retained.resources.length,2);assert.ok(retained.context.primaryAddress);
 
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
 runtime.window.show();
 await wc.executeJavaScript("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))");
 await writeFile(resolve('desktop-acceptance',process.platform+'.png'),(await wc.capturePage()).toPNG());
 // A close failure must leave the process and root lease alive, then permit retry.
 const quitReply=await wc.executeJavaScript('window.wexHost.requestQuit()');assert.deepEqual(quitReply,{ok:true,value:{accepted:true}});
 await new Promise((res,rej)=>{const end=Date.now()+8000;const poll=()=>runtime.readStatus().phase==='release-pending'?res():Date.now()>end?rej(Error('release phase timeout')):setTimeout(poll,20);poll();});
 assert.equal(runtime.window.isDestroyed(),false);assert.equal((await lstat(join(root,'.wex-write-lock'))).isDirectory(),true);
 assert.equal((await runtime.lifecycle.stop()).status,'stopped');
 const reopened=await startFoundations({dataRoot:root,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false}});
 assert.equal(reopened.status,'ready');assert.equal((await reopened.stop()).status,'stopped');
 const report={source:process.env.GITHUB_SHA??'unknown',platform:process.platform,rendering:process.platform==='linux'?'software-xvfb':'default',electron:process.versions.electron,node:process.versions.node,sqlite:process.versions.sqlite,fixtures:['native dialog responses','native directory selection','one permissions-store close failure'],limits:['Windows Local handle/scanner availability is reported explicitly','not an installer or manual Windows acceptance'],checks:['four-column native divider and keyboard resizing, auxiliary height and expand restoration, layout recovery and preserved Space draft','category creation and address form/primary selection through actual React DOM','controlled Local resource preview or explicit platform unavailability','React Space creation and Context navigation via actual DOM events','real SQLite Context create and group movement via IPC','native decline and path injection rejected','sandboxed React and narrow preload','default-deny identity','CSP network denied','window open denied','foreign real WebContents cannot read status or quit','quit waits and retains lease on release failure','retry releases real SQLite and root; restart succeeds']};
 await writeFile(resolve('desktop-acceptance',process.platform+'.json'),JSON.stringify(report,null,2));
 console.log('DESKTOP_ACCEPTANCE '+JSON.stringify(report));clearTimeout(timer);app.quit();
}catch(error){console.error(error);clearTimeout(timer);app.exit(1);}

}
void verify().catch(error=>{console.error(error);app.exit(1);});
