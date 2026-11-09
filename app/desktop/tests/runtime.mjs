import {createServer} from 'node:http';
import {app,BrowserWindow} from 'electron';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,lstat,rm,mkdir} from 'node:fs/promises';
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
const providerCalls=[];let heldResponse,providerMode='normal',directoryCalls=0;
const githubCalls=[];let githubText='Desktop GitHub original',githubSha='a'.repeat(40),githubMode='ok';
const provider=createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/v1/models'){
  directoryCalls++;res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data:[{id:'test-model'},{id:'second-model'}]}));return;
 }
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const input=JSON.parse(Buffer.concat(chunks).toString());providerCalls.push(input);
 res.writeHead(200,{'content-type':'text/event-stream'});
 const frame=(content,finish_reason=null)=>'data: '+JSON.stringify({choices:[{index:0,delta:content?{content}:{},finish_reason}]})+'\n\n';
 if(providerMode==='wait'){res.write(frame('Waiting chunk'));heldResponse=res;return;}
 res.end(frame('Desktop reply')+frame(undefined,'stop')+'data: [DONE]\n\n');
});
await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
const providerEndpoint='http://127.0.0.1:'+provider.address().port+'/v1';
let failClose=true;
const startup=policy=>startFoundations({dataRoot:root,expectedRootId:id,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false},
 space:{},api:{},credentials:{cipher:{
 available:()=>true,seal:value=>'fixture:'+Buffer.from(value).toString('base64'),unseal:value=>Buffer.from(value.slice(8),'base64').toString()
 }},githubOfficial:{fetch:async(url,init)=>{
 githubCalls.push({url:String(url),method:init?.method??'GET'});
 if(init?.method==='PUT'){
  if(githubMode==='conflict')return new Response(JSON.stringify({message:'conflict'}),{status:409,headers:{'content-type':'application/json'}});
  if(githubMode==='unknown')throw Error('fixture disconnected');
  const input=JSON.parse(init.body);assert.equal(input.sha,githubSha);
  githubText=Buffer.from(input.content,'base64').toString();githubSha='b'.repeat(40);
  return new Response(JSON.stringify({content:{path:'README.md',sha:githubSha},commit:{sha:'c'.repeat(40)}}),{status:200,headers:{'content-type':'application/json'}});
 }
 return new Response(JSON.stringify({type:'file',path:'README.md',sha:githubSha,encoding:'base64',content:Buffer.from(githubText).toString('base64'),size:Buffer.byteLength(githubText)}),{status:200,headers:{'content-type':'application/json'}});
 }},connections:{adapters:[],capabilityAdapters:[{id:'fixture',version:'1',async discover(){return [{name:'inspect',inputSchema:{type:'object'}}];},async invoke(){throw Error('context_selection_must_not_execute');},async stop(){}}]},conversations:true,ai:{bindRead:()=>undefined},localFiles:{coordinateWrites:true},localDirectories:{},technicalDiagnostics:{},
 openStore(path,namespace){const db=openSqliteStore(path,namespace);return {...db,close(){if(failClose&&namespace==='permissions'){failClose=false;throw Error('injected-close');}db.close();}};},...policy});
const timer=setTimeout(()=>{console.error('desktop_runtime_timeout');app.exit(1);},75000);
try{
 const runtime=await runDesktop({url:pathToFileURL(resolve('desktop-dist/index.html')).href,preload:resolve('desktop-dist/preload.cjs'),start:startup,spaceRootId:id,spacePlatform:{confirm:async summary=>{confirmations.push(summary);return nativeAllowed;},chooseDirectory:async()=>contextRoot},show:true});
 const host=await runtime.lifecycle.start();
 assert.equal(host.status,'ready');for(const name of ['space','api','ai','conversations','connections','localFiles','localDirectories','permissions'])assert.ok(host[name],name);
 assert.deepEqual(host.permissions.evaluate({}),{status:'indeterminate',reason:'trusted_facts_missing'});
 const wc=runtime.window.webContents;
 const capture=async suffix=>{
  runtime.window.show();
  await wc.executeJavaScript("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))");
  await writeFile(resolve('desktop-acceptance',process.platform+suffix+'.png'),(await wc.capturePage()).toPNG());
 };
 const facts=await wc.executeJavaScript(`(async()=>({node:typeof require,process:typeof process,bridge:Object.keys(window.wexHost).sort(),reply:await window.wexHost.readStatus(),title:document.title,text:document.body.innerText}))()`);
 assert.equal(facts.node,'undefined');assert.equal(facts.process,'undefined');
 assert.deepEqual(facts.bridge,['ai','api','cancelApi','cancelConversations','connections','conversations','onAccessChanged','onConversationText','permissions','readStatus','requestQuit','space']);assert.equal(facts.reply.ok,true);
 assert.equal(facts.reply.value.phase,'ready');assert.equal(facts.title,'WEXPCeasy');assert.match(facts.text,/WEXPCeasy/);
// Exercise the actual React form through DOM events; only native platform interactions are fixtures.
 const buttonExpression=text=>"[...document.querySelectorAll('button')].find(x=>(x.textContent.trim()==="+JSON.stringify(text)+"||x.getAttribute('aria-label')==="+JSON.stringify(text)+"))";
 const click=async text=>{
  const button=buttonExpression(text);
  await waitFor("(()=>{const b="+button+";return !!b&&!b.disabled;})()");
  return wc.executeJavaScript("(()=>{const b="+button+";const d=b.closest('details');if(d&&!d.open)d.querySelector('summary').click();b.click();return true;})()");
 };
 const waitFor=async expression=>{const end=Date.now()+10000;while(!await wc.executeJavaScript(expression)){if(Date.now()>end){console.error('RENDERER_WAIT',expression,await wc.executeJavaScript("({dragging:document.querySelector('[data-workbench]')?.dataset.dragging,layout:localStorage.getItem('wex.workbench.layout.v2'),statuses:[...document.querySelectorAll('[role=status]')].map(x=>x.textContent),disabledForms:[...document.querySelectorAll('form')].map(f=>({label:f.getAttribute('aria-label'),disabled:f.querySelectorAll(':disabled').length}))})"));throw Error('renderer_wait_timeout');}await new Promise(r=>setTimeout(r,25));}};
 await waitFor("!!document.querySelector('[data-workbench]')");
 await wc.executeJavaScript("document.querySelector('[aria-label=\"折叠导航\"]').click();true");
 await waitFor("document.querySelector('[data-column=\"navigation\"]').getBoundingClientRect().width===56");
 const columns=await wc.executeJavaScript("[...document.querySelectorAll('[data-column]')].map(x=>x.getBoundingClientRect().width)");
 assert.equal(columns.length,3);assert.ok(columns[1]>=280);assert.equal(columns[2],36);
 // The default auxiliary is collapsed; resizing is enabled only after opening it.
 await click('展开导航');
 await waitFor("document.querySelector('[data-divider=\"column-0\"]').getAttribute('aria-disabled')==='false'");
 const navBefore=await wc.executeJavaScript("document.querySelector('[data-column=\"navigation\"]').getBoundingClientRect().width");
 const divider=await wc.executeJavaScript("(()=>{const r=document.querySelector('[data-divider=\"column-0\"]').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+80)};})()");
 wc.sendInputEvent({type:'mouseMove',...divider});wc.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...divider});
 await waitFor("document.querySelector('[data-workbench]').dataset.dragging==='true'");
 wc.sendInputEvent({type:'mouseMove',modifiers:['leftButtonDown'],x:divider.x+24,y:divider.y});
 await waitFor("document.querySelector('[data-column=\"navigation\"]').getBoundingClientRect().width>"+(navBefore+20));
 wc.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:divider.x+24,y:divider.y});
 await waitFor("document.querySelector('[data-workbench]').dataset.dragging==='false'");
 const adjusted=await wc.executeJavaScript("document.querySelector('[data-column=\"navigation\"]').getBoundingClientRect().width");
 await wc.executeJavaScript("document.querySelector('[data-divider=\"column-0\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));true");
 await waitFor("document.querySelector('[data-column=\"navigation\"]').getBoundingClientRect().width<"+(adjusted-8));
 await click('展开辅助区');
 await waitFor("document.querySelector('[data-divider=\"column-1\"]').getAttribute('aria-disabled')==='false'");
 const auxBefore=await wc.executeJavaScript("document.querySelector('[data-column=\"auxiliary\"]').getBoundingClientRect().width");
 await wc.executeJavaScript("document.querySelector('[data-divider=\"column-1\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));true");
 await waitFor("document.querySelector('[data-column=\"auxiliary\"]').getBoundingClientRect().width>"+(auxBefore+8));
 await click('收起辅助区');
 await waitFor("document.querySelector('[data-column=\"auxiliary\"]').getBoundingClientRect().width===36");
 await waitFor("JSON.parse(localStorage.getItem('wex.workbench.layout.v2')||'{}').collapsed===false");
 const saved=await wc.executeJavaScript("localStorage.getItem('wex.workbench.layout.v2')");
 const loaded=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await loaded;
 await waitFor("!!document.querySelector('[data-workbench]')");
 assert.equal(await wc.executeJavaScript("localStorage.getItem('wex.workbench.layout.v2')"),saved);
 await click('摘要预览');
 await waitFor("!!document.querySelector('[aria-label=\"Context 摘要预览\"]')");
 await click('关闭预览');
 await waitFor("!document.querySelector('[aria-label=\"Context 摘要预览\"]')");
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
 const choose=async(selector,value)=>{
  await waitFor("(()=>{const f=document.querySelector("+JSON.stringify(selector)+");return !!f&&!f.disabled;})()");
  return wc.executeJavaScript(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});if(!field)throw Error('field_missing '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(field.tagName==='SELECT'?HTMLSelectElement.prototype:field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;})()`);};
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
 assert.equal(fileRead.status,'ok');
 await wc.executeJavaScript("[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Desktop Context')).click();true");
 await waitFor("[...document.querySelectorAll('.address-card strong')].some(x=>x.textContent==='Selected local file')");
 if(fileRead.status==='ok'){
  await wc.executeJavaScript("[...document.querySelectorAll('.address-card')].find(x=>x.textContent.includes('Selected local file')).querySelector('button').click();true");
  await waitFor("!!document.querySelector('[aria-label=\"资源预览\"] pre')");
  assert.equal(await wc.executeJavaScript('window.resourceExecuted'),undefined);
  assert.match(await wc.executeJavaScript("document.querySelector('[aria-label=\"资源预览\"] pre').textContent"),/Selected local text/);
  // Exercise the visible editor against a real selected file, including draft navigation and external conflicts.
  await choose('textarea[name="local-file-content"]','Desktop local edit');
  await click('关闭预览');
  await wc.executeJavaScript("[...document.querySelectorAll('.address-card')].find(x=>x.textContent.includes('Selected local file')).querySelector('button').click();true");
  await waitFor("document.querySelector('textarea[name=\"local-file-content\"]')?.value==='Desktop local edit'");
  nativeAllowed=false;await click('保存本地文件');
  await waitFor("document.querySelector('[data-local-editor] [role=status]').textContent.includes('保存已取消')");
  assert.match(await readFile(previewFile,'utf8'),/Selected local text/);
  nativeAllowed=true;await click('保存本地文件');
  await waitFor("document.querySelector('[data-local-editor] [role=status]').textContent.includes('已保存')");
  assert.equal(await readFile(previewFile,'utf8'),'Desktop local edit');
  await click('重新读取文件');
  await waitFor("document.querySelector('[data-local-editor] [role=status]').textContent.includes('已重新读取')");
  await choose('textarea[name="local-file-content"]','Desktop merged draft');
  await writeFile(previewFile,'External change');
  await click('保存本地文件');
  await waitFor("document.querySelector('[data-local-editor] [role=status]').textContent.includes('磁盘版本冲突')");
  assert.equal(await readFile(previewFile,'utf8'),'External change');
  assert.equal(await wc.executeJavaScript("document.querySelector('textarea[name=\"local-file-content\"]').value"),'Desktop merged draft');
  await click('重新读取文件');
  await waitFor("document.querySelector('[data-local-editor] pre').textContent==='External change'");
  await click('保存本地文件');
  await waitFor("document.querySelector('[data-local-editor] [role=status]').textContent.includes('已保存')");
  assert.equal(await readFile(previewFile,'utf8'),'Desktop merged draft');
  await capture('-local-editor');

 }
 // API settings are actual React forms, not a direct domain fixture.
 await click('设置');await click('API 与模型');
 await choose('form[aria-label="API 连接配置"] input','Desktop Provider');
 await choose('form[aria-label="API 连接配置"] input[type="url"]',providerEndpoint);
 await new Promise(r=>setTimeout(r,25));
 await wc.executeJavaScript("document.querySelector('form[aria-label=\"API 连接配置\"]').requestSubmit();true");
 await waitFor("[...document.querySelectorAll('[data-api-settings] li button')].some(b=>b.textContent==='Desktop Provider')");
 await click('Desktop Provider');
 await click('读取服务端模型目录');
 await waitFor("!!document.querySelector('select[aria-label=\"服务端模型目录\"] option[value=\"test-model\"]')");
 assert.equal(directoryCalls,1);
 assert.match(await wc.executeJavaScript("document.querySelector('[data-api-directory]').textContent"),/Operation/);
 const beforeImportConnections=await wc.executeJavaScript("window.wexHost.api({kind:'snapshot'})");
 const beforeImportConnection=beforeImportConnections.value.connections.find(c=>c.name==='Desktop Provider');
 const beforeImportModels=await wc.executeJavaScript('window.wexHost.api('+JSON.stringify({kind:'models',connectionId:beforeImportConnection.id})+')');
 assert.equal(beforeImportModels.value.models.length,0,'directory discovery must not register models');
 await choose('select[aria-label="服务端模型目录"]','test-model');await click('填入新模型表单');
 assert.equal(await wc.executeJavaScript("document.querySelectorAll('form[aria-label=\"模型配置\"] input')[1].value"),'test-model');
 const draftOnlyModels=await wc.executeJavaScript('window.wexHost.api('+JSON.stringify({kind:'models',connectionId:beforeImportConnection.id})+')');
 assert.equal(draftOnlyModels.value.models.length,0,'choosing a directory ID must not save or verify a model');
 await wc.executeJavaScript("document.querySelector('[data-api-directory]').scrollIntoView({block:'center'});true");
 await capture('-api-directory');
 await choose('form[aria-label="模型配置"] input','Desktop Model');
 await choose('form[aria-label="模型配置"] input:nth-of-type(1)','Desktop Model');
 const modelFields=await wc.executeJavaScript("([...document.querySelectorAll('form[aria-label=\"模型配置\"] input')].map(input=>({type:input.type,step:input.step})))");assert.equal(modelFields.length,4);assert.deepEqual(modelFields.map(x=>x.type),['text','text','number','number']);assert.equal(modelFields[3].step,'1');
 await wc.executeJavaScript("(()=>{const f=document.querySelectorAll('form[aria-label=\"模型配置\"] input')[1];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f,'test-model');f.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
 await new Promise(r=>setTimeout(r,25));
 await wc.executeJavaScript("document.querySelector('form[aria-label=\"模型配置\"]').requestSubmit();true");
 await waitFor("[...document.querySelectorAll('[data-api-settings] li button')].some(b=>b.textContent==='Desktop Model')");
 // Editing an existing model must preserve untouched settings and explicitly clear a numeric limit.
 const apiConnections=await wc.executeJavaScript("window.wexHost.api({kind:'snapshot'})");
 const apiConnection=apiConnections.value.connections.find(c=>c.name==='Desktop Provider');assert.ok(apiConnection);
 const readDesktopModel=async()=>{
  const reply=await wc.executeJavaScript('window.wexHost.api('+JSON.stringify({kind:'models',connectionId:apiConnection.id})+')');
  assert.equal(reply.ok,true);return reply.value.models.find(m=>m.name==='Desktop Model');
 };
 const initialModel=await readDesktopModel();assert.ok(initialModel);
 assert.equal(initialModel.observation,null,'directory selection must not manufacture model capability evidence');
 const seedParameters=await wc.executeJavaScript('window.wexHost.api('+JSON.stringify({kind:'model.edit',id:initialModel.id,expectedRevision:initialModel.revision,parameters:{temperature:{mode:'disabled'},top_p:{mode:'value',value:0.25},max_tokens:{mode:'value',value:64}}})+')');
 assert.equal(seedParameters.value.status,'committed');
 await click('读取已配置模型');await click('Desktop Model');
 await waitFor("document.querySelector('form[aria-label=\"模型配置\"] input[min=\"1\"]').value==='64'");
 await choose('form[aria-label="模型配置"] input[min="1"]','');
 await click('保存模型');
 await waitFor("!document.querySelector('form[aria-label=\"模型配置\"] input').disabled");
 const editedModel=await readDesktopModel();
 assert.deepEqual(editedModel.parameters,{temperature:{mode:'disabled'},top_p:{mode:'value',value:0.25},max_tokens:{mode:'provider-default'}},'UI edits must preserve untouched modes/parameters and clear an explicit limit');
 // The following generation fixture probes text/stream only; it does not claim top_p capability.
 const restoreProbeParameters=await wc.executeJavaScript('window.wexHost.api('+JSON.stringify({kind:'model.edit',id:editedModel.id,expectedRevision:editedModel.revision,parameters:{top_p:{mode:'provider-default'}}})+')');
 assert.equal(restoreProbeParameters.value.status,'committed');
 await click('读取已配置模型');
 await click('Desktop Model');await click('测试并保存模型观测');
 await waitFor("document.querySelector('[data-api-settings] [role=\"status\"]').textContent.includes('committed')");
 await click('Agent 与角色');await click('读取 AI 配置');
 await choose('input[name="ai-name"]','Desktop Role');await choose('textarea[name="ai-text"]','Precise fixture role.');
 await new Promise(r=>setTimeout(r,25));await wc.executeJavaScript("document.querySelector('form[aria-label=\"AI 配置\"]').requestSubmit();true");
 await waitFor("[...document.querySelectorAll('[data-ai-settings] li button')].some(b=>b.textContent==='Desktop Role')");
 await click('新建配置');await choose('select[name="ai-kind"]','position');await choose('input[name="ai-name"]','Desktop Position');await choose('textarea[name="ai-text"]','Answer carefully.');
 await new Promise(r=>setTimeout(r,25));await wc.executeJavaScript("document.querySelector('form[aria-label=\"AI 配置\"]').requestSubmit();true");
 await waitFor("[...document.querySelectorAll('[data-ai-settings] li button')].some(b=>b.textContent==='Desktop Position')");
 await click('新建配置');await choose('select[name="ai-kind"]','agent');await choose('input[name="ai-name"]','Desktop Agent');
 const aiSnapshot=await wc.executeJavaScript("window.wexHost.ai({kind:'snapshot'})");assert.equal(aiSnapshot.ok,true);
 const role=aiSnapshot.value.entries.find(e=>e.kind==='role'),position=aiSnapshot.value.entries.find(e=>e.kind==='position');
 await choose('select[name="ai-role"]',role.id);await choose('select[name="ai-position"]',position.id);
 await click('读取可选模型');await waitFor("document.querySelectorAll('select[name=\"ai-model\"] option').length>1");
 const modelOption=await wc.executeJavaScript("document.querySelector('select[name=\"ai-model\"] option:nth-child(2)').value");
 await choose('select[name="ai-model"]',modelOption);
 await new Promise(r=>setTimeout(r,25));await wc.executeJavaScript("document.querySelector('form[aria-label=\"AI 配置\"]').requestSubmit();true");
 await waitFor("[...document.querySelectorAll('[data-ai-settings] li button')].some(b=>b.textContent==='Desktop Agent')");
 await click('返回工作区');await click('普通对话');await click('新建普通对话');
 await waitFor("document.querySelector('[data-conversations] small')?.textContent.includes('修订 1')");
 await click('读取可用 Agent');
 await waitFor("document.querySelectorAll('[data-conversations] select option').length>1");
 const agent=await wc.executeJavaScript("document.querySelector('[data-conversations] select option:nth-child(2)').value");
 await choose('[data-conversations] select',agent);await choose('form[aria-label="普通对话输入"] textarea','Desktop question');
 await new Promise(r=>setTimeout(r,25));await wc.executeJavaScript("document.querySelector('form[aria-label=\"普通对话输入\"]').requestSubmit();true");
 await waitFor("[...document.querySelectorAll('[data-conversations] article p')].some(p=>p.textContent==='Desktop reply')");
 assert.ok(providerCalls.some(c=>c.messages.some(m=>m.content==='Desktop question')));

 // Complete the user round trip: sent text clears, editing retains history, streaming can be cancelled.
 await waitFor("document.querySelector('form[aria-label=\"普通对话输入\"] textarea').value===''");
 await click('编辑并重发');await choose('form[aria-label="普通对话输入"] textarea','Desktop corrected');
 await new Promise(r=>setTimeout(r,25));await wc.executeJavaScript("document.querySelector('form[aria-label=\"普通对话输入\"]').requestSubmit();true");
 await waitFor("document.querySelectorAll('[data-conversations] article').length===4");
 assert.equal(await wc.executeJavaScript("[...document.querySelectorAll('[data-conversations] article small')].some(e=>e.textContent.includes('修改重发自'))"),true);
 providerMode='wait';await choose('form[aria-label="普通对话输入"] textarea','Desktop cancel');
 await new Promise(r=>setTimeout(r,25));await wc.executeJavaScript("document.querySelector('form[aria-label=\"普通对话输入\"]').requestSubmit();true");
 await waitFor("!!document.querySelector('[aria-label=\"生成中\"]')");
 await click('停止本轮等待');heldResponse?.end();providerMode='normal';
 await waitFor("document.querySelector('[data-conversations]').textContent.includes('轮次：cancelled')");
 await waitFor("!document.querySelector('form[aria-label=\"普通对话输入\"] textarea').disabled");
 // Basic attachment reference uses existing Space/Local public IPC and never uploads the preview body.
 const beforeAttachment=providerCalls.length;
 await click('读取附件来源');await waitFor("document.querySelectorAll('[data-conversation-files] select')[0].options.length>1");
 await choose('[data-conversation-files] select',created.id);await click('读取来源文件引用');
 await waitFor("document.querySelectorAll('[data-conversation-files] select')[1].options.length>1");
 await choose('[data-conversation-files] label:nth-of-type(2) select',linked.id);await click('授权读取附件预览');
 await waitFor("!!document.querySelector('[aria-label=\"附件预览\"]')");
 assert.equal(await wc.executeJavaScript("document.querySelector('[aria-label=\"附件预览\"]').textContent"),'Desktop merged draft');
 await click('加入本轮文件引用');await click('移除此文件引用');
 assert.equal(await wc.executeJavaScript("[...document.querySelectorAll('button')].some(b=>b.textContent==='移除此文件引用')"),false);
 await click('授权读取附件预览');await waitFor("!!document.querySelector('[aria-label=\"附件预览\"]')");await click('加入本轮文件引用');
 await choose('form[aria-label="普通对话输入"] textarea','File reference only');await click('仅追加到历史');
 await waitFor("document.querySelector('[data-conversations] [role=status]').textContent.includes('已追加到历史')");
 assert.equal(providerCalls.length,beforeAttachment);
 assert.equal(await wc.executeJavaScript("document.querySelector('[data-conversations]').textContent.includes('文件来源')"),true);
 await capture('-conversation');
 await click('读取对话历史');await waitFor("document.querySelectorAll('nav[aria-label=\"普通对话历史\"] button').length===1");
 await click('设置');await click('当前窗口授权');await click('读取当前窗口授权');
 await waitFor("document.querySelectorAll('[data-permission-settings] li').length>0");
 const permissionSnapshot=await wc.executeJavaScript("window.wexHost.permissions({kind:'snapshot'})");
 assert.equal(permissionSnapshot.ok,true);
 assert.equal(permissionSnapshot.value.source.kind,'native-local');assert.equal(await wc.executeJavaScript("document.querySelector('[data-permission-settings]').textContent.includes('授权来源：本机可信确认')"),true);
 const historyGrant=permissionSnapshot.value.entries.find(e=>e.resource==='conversations'&&e.action==='read');
 assert.ok(historyGrant);
 await wc.executeJavaScript("[...document.querySelectorAll('[data-permission-settings] li')].find(li=>li.querySelector('strong').textContent==='conversations / read').querySelector('button').click();true");
 await waitFor("document.querySelector('[data-permission-settings] [role=status]').textContent.includes('已撤销')");
 await waitFor("document.querySelectorAll('[data-conversations] article').length===0");
 await waitFor("document.querySelectorAll('[aria-label=\"资源预览\"] pre').length===0");
 await click('GitHub / Local');await click('读取连接与操作记录');
 await waitFor("document.querySelector('[data-connection-settings]').textContent.includes('Operation 摘要')");

 // The complete connector form uses the real credential modal and official Octokit, with a trusted transport fixture.
 await click('登记 GitHub 连接');
 await waitFor("[...document.querySelectorAll('[data-connection-settings] button')].some(b=>b.textContent==='安全录入 GitHub Token')");
 await click('安全录入 GitHub Token');
 let secretWindow;
 await new Promise((res,rej)=>{const end=Date.now()+10000;const poll=async()=>{
  secretWindow=BrowserWindow.getAllWindows().find(w=>w!==runtime.window);
  try{if(secretWindow&&await secretWindow.webContents.executeJavaScript("!!document.querySelector('input[type=password]:not(:disabled)')"))return res();}catch{}
  if(Date.now()>end)return rej(Error('github credential dialog timeout'));setTimeout(poll,25);
 };void poll();});
 await secretWindow.webContents.executeJavaScript("document.querySelector('input[type=password]').value='fixture-github-token';document.querySelector('form').requestSubmit();true").catch(error=>{if(!secretWindow.isDestroyed()||!String(error).includes('Render frame was disposed'))throw error;});
 await waitFor("document.querySelector('[data-connection-settings]').textContent.includes('已引用凭证')");
 assert.equal(await wc.executeJavaScript("document.body.textContent.includes('fixture-github-token')"),false);
 await click('操作 GitHub 文件');await choose('input[name="github-owner"]','example');await choose('input[name="github-repo"]','project');await choose('input[name="github-path"]','README.md');
 await click('读取 GitHub 文件');await waitFor("document.querySelector('textarea[name=\"github-content\"]')?.value==='Desktop GitHub original'");
 await choose('textarea[name="github-content"]','Desktop GitHub edited');await choose('input[name="github-message"]','Desktop file edit');
 nativeAllowed=false;await click('确认提交 GitHub 修改');await waitFor("document.querySelector('[data-connection-settings] [role=status]').textContent.includes('cancelled')");
 assert.equal(githubCalls.filter(c=>c.method==='PUT').length,0);nativeAllowed=true;
 // Cancellation preserves the edit without issuing another confirmation; explicitly read again for this test.
 await click('读取 GitHub 文件');await waitFor("!!document.querySelector('textarea[name=\"github-content\"]')");
 await choose('textarea[name="github-content"]','Desktop GitHub edited');
 await click('确认提交 GitHub 修改');await waitFor("document.querySelector('[data-connection-settings] [role=status]').textContent.includes('已提交')");
 assert.equal(githubText,'Desktop GitHub edited');assert.equal(githubCalls.filter(c=>c.method==='PUT').length,1);
 await click('读取 GitHub 文件');await waitFor("document.querySelector('textarea[name=\"github-content\"]')?.value==='Desktop GitHub edited'");
 githubMode='unknown';await choose('textarea[name="github-content"]','uncertain edit');
 await click('确认提交 GitHub 修改');await waitFor("document.querySelector('[data-connection-settings] [role=status]').textContent.includes('unknown')");
 const writesAfterUnknown=githubCalls.filter(c=>c.method==='PUT').length;
 assert.equal(await wc.executeJavaScript("!!document.querySelector('textarea[name=\"github-content\"]')"),false);
 await click('读取连接与操作记录');assert.equal(githubCalls.filter(c=>c.method==='PUT').length,writesAfterUnknown);
 const beforeReceipt={provider:providerCalls.length,github:githubCalls.length};
 await wc.executeJavaScript("[...document.querySelectorAll('[data-connection-settings] li')].find(li=>li.querySelector('strong')?.textContent==='unknown').querySelector('[data-operation-receipt] button').click();true");
 await waitFor("[...document.querySelectorAll('[data-operation-receipt] p')].some(p=>p.textContent.includes('结果未知'))");
 assert.equal(await wc.executeJavaScript("[...document.querySelectorAll('[data-operation-receipt] time')].some(t=>Number.isFinite(Date.parse(t.dateTime)))"),true);
 assert.equal(providerCalls.length,beforeReceipt.provider);assert.equal(githubCalls.length,beforeReceipt.github);
 await capture('-connectors');
 await click('解除 GitHub Token 并停用');await waitFor("document.querySelector('[data-connection-settings]').textContent.includes('无凭证引用')");

 // Reload the actual desktop UI, then recover persisted configuration/history without replaying either network action.
 const networkBeforeReload={provider:providerCalls.length,github:githubCalls.length};
 const reloaded=new Promise(res=>wc.once('did-finish-load',res));wc.reload();await reloaded;
 await waitFor("!!document.querySelector('[data-workbench]')");
 await click('设置');await click('API 与模型');await click('读取 API 配置');
 await waitFor("[...document.querySelectorAll('[data-api-settings] li button')].some(b=>b.textContent==='Desktop Provider')");
 await click('Agent 与角色');await click('读取 AI 配置');
 await waitFor("[...document.querySelectorAll('[data-ai-settings] li button')].some(b=>b.textContent==='Desktop Agent')");
 await click('GitHub / Local');await click('读取连接与操作记录');
 await waitFor("document.querySelector('[data-connection-settings]').textContent.includes('unknown')");
 assert.equal(await wc.executeJavaScript("document.querySelector('[data-connection-settings]').textContent.includes('无凭证引用')"),true);
 await click('返回工作区');await click('普通对话');await click('读取对话历史');
 await waitFor("document.querySelectorAll('nav[aria-label=\"普通对话历史\"] button').length===1");
 await wc.executeJavaScript("document.querySelector('nav[aria-label=\"普通对话历史\"] button').click();true");
 await waitFor("document.querySelectorAll('[data-conversations] article').length===6");
 assert.equal(providerCalls.length,networkBeforeReload.provider);assert.equal(githubCalls.length,networkBeforeReload.github);assert.equal(await readFile(previewFile,'utf8'),'Desktop merged draft');
 await capture('-recovery');
 await click('设置');
 await click('返回工作区');await click('Space / Context');
 const currentConfig=host.connections.configs.read();assert.equal(host.connections.configs.put({id:'context-tools-fixture',adapter:'fixture',endpoint:'fixture:tools',credentialRef:null,enabled:true},currentConfig.revision,'context-tools-config').status,'ok');
 await click('打开工作区');await waitFor("[...document.querySelectorAll('nav button')].some(b=>b.textContent.includes('Desktop Context')&&!b.disabled)");
 await wc.executeJavaScript("[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes('Desktop Context')).click();true");
 await waitFor("!!document.querySelector('[data-context-tools]')");await click('读取可关联工具连接');
 await waitFor("document.querySelector('[data-context-tools] select').options.length>1");await choose('[data-context-tools] select','context-tools-fixture');await click('发现可关联工具');
 await waitFor("document.querySelector('form[aria-label=\"Context 工具引用\"] select').options.length>1");
 const selectedTool=await wc.executeJavaScript("document.querySelector('form[aria-label=\"Context 工具引用\"] select option:nth-child(2)').value");
 await choose('form[aria-label="Context 工具引用"] select',selectedTool);await choose('form[aria-label="Context 工具引用"] input','Inspect only');
 await wc.executeJavaScript("document.querySelector('form[aria-label=\"Context 工具引用\"]').requestSubmit();true");
 await waitFor("!![...document.querySelectorAll('[data-context-tools] button')].find(b=>b.textContent==='停用工具选择'&&!b.disabled)");await click('停用工具选择');
 await waitFor("!![...document.querySelectorAll('[data-context-tools] button')].find(b=>b.textContent==='启用工具选择'&&!b.disabled)");await click('解除工具引用');
 await waitFor("document.querySelectorAll('[data-context-tools] article').length===0");
 const toolGrants=await wc.executeJavaScript("window.wexHost.permissions({kind:'snapshot'})");assert.equal(toolGrants.value.entries.some(e=>e.resource==='fixture'&&e.action==='write'),false);
 const directory=await invoke({kind:'address.add',contextId:created.id,name:'Selected directory',address:pathToFileURL(contextRoot).href,purpose:'reference'});assert.equal(directory.status,'committed');
 const listed=await invoke({kind:'resource.read',contextId:created.id,id:directory.id,mode:'directory'});assert.equal(listed.status,'ok');assert.equal(listed.view,'directory');assert.ok(listed.entries.some(e=>e.name==='preview.txt'));
 const retained=await invoke({kind:'context.open',id:created.id});assert.equal(retained.resources.length,3);assert.ok(retained.context.primaryAddress);
 
 const prefs=wc.getLastWebPreferences();assert.equal(prefs.sandbox,true);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.nodeIntegration,false);
 assert.equal((await lstat(join(root,'.wex-write-lock'))).isDirectory(),true);
 const network=await wc.executeJavaScript(`fetch('https://example.com').then(()=>false,()=>true)`);assert.equal(network,true);
 const before=wc.getURL();await wc.executeJavaScript(`window.open('https://example.com');true`);assert.equal(wc.getURL(),before);assert.equal(BrowserWindow.getAllWindows().length,1);
 const promptCount=confirmations.length;
 const foreign=new BrowserWindow({show:false,webPreferences:{preload:resolve('desktop-dist/preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await foreign.loadURL(before);
 for(const method of ['readStatus','requestQuit','cancelApi','cancelConversations']){
  assert.deepEqual(await foreign.webContents.executeJavaScript('window.wexHost.'+method+'()'),{ok:false,error:'untrusted_sender'});
 }
 assert.deepEqual(await foreign.webContents.executeJavaScript("window.wexHost.space({kind:'snapshot'})"),{ok:false,error:'untrusted_sender'});
 assert.deepEqual(await foreign.webContents.executeJavaScript("window.wexHost.api({kind:'snapshot'})"),{ok:false,error:'untrusted_sender'});
 for(const method of ['ai','connections','conversations','permissions'])assert.deepEqual(await foreign.webContents.executeJavaScript("window.wexHost."+method+"({kind:'snapshot'})"),{ok:false,error:'untrusted_sender'});
 assert.equal(confirmations.length,promptCount);
 foreign.destroy();assert.equal(runtime.readStatus().phase,'ready');
 runtime.window.show();
 await wc.executeJavaScript("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))");
 await capture('');
 // A close failure must leave the process and root lease alive, then permit retry.
 const quitReply=await wc.executeJavaScript('window.wexHost.requestQuit()');assert.deepEqual(quitReply,{ok:true,value:{accepted:true}});
 await new Promise((res,rej)=>{const end=Date.now()+8000;const poll=()=>runtime.readStatus().phase==='release-pending'?res():Date.now()>end?rej(Error('release phase timeout')):setTimeout(poll,20);poll();});
 assert.equal(runtime.window.isDestroyed(),false);assert.equal((await lstat(join(root,'.wex-write-lock'))).isDirectory(),true);
 assert.equal((await runtime.lifecycle.stop()).status,'stopped');
 const reopened=await startFoundations({dataRoot:root,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false}});
 assert.equal(reopened.status,'ready');assert.equal((await reopened.stop()).status,'stopped');
 const report={source:process.env.GITHUB_SHA??'unknown',platform:process.platform,rendering:process.platform==='linux'?'software-xvfb':'default',electron:process.versions.electron,node:process.versions.node,sqlite:process.versions.sqlite,fixtures:['official Octokit transport responses and dummy credential cipher (no real GitHub writes)','local HTTP/SSE Provider','native dialog responses','native directory selection','one permissions-store close failure'],limits:['Windows Local native handle/scanner tested; requires Windows PowerShell with Add-Type available','not an installer or manual Windows acceptance'],checks:['Local real file editor save, draft close/reopen, native decline, external version conflict, reread/compare and explicit merged save','GitHub config, private credential form, SHA-bound read/edit/write, native decline, unknown receipt without automatic retry and credential detach','conversation edit/resend preserves history, streaming cancellation and cleared sent draft','API and AI config forms, actual local Provider generation, saved history and scoped permission UI','three-column navigation pointer and keyboard resizing, optional auxiliary width and collapse, on-demand preview, layout recovery and preserved Space draft','category creation and address form/primary selection through actual React DOM','controlled Local resource preview and pinned native directory enumeration','React Space creation and Context navigation via actual DOM events','real SQLite Context create and group movement via IPC','native decline and path injection rejected','sandboxed React and narrow preload','default-deny identity','CSP network denied','window open denied','foreign real WebContents cannot read status or quit','quit waits and retains lease on release failure','retry releases real SQLite and root; restart succeeds']};
 await writeFile(resolve('desktop-acceptance',process.platform+'.json'),JSON.stringify(report,null,2));
 console.log('DESKTOP_ACCEPTANCE '+JSON.stringify(report));provider.closeAllConnections();provider.close();clearTimeout(timer);app.quit();
}catch(error){provider.closeAllConnections();provider.close();console.error(error);clearTimeout(timer);app.exit(1);}

}
void verify().catch(error=>{console.error(error);app.exit(1);});
