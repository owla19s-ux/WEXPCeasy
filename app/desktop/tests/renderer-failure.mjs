import {app} from 'electron';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {writeFile,mkdir,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {runDesktop} from '../../../dist/app/src/desktop-runtime.js';
import {startFoundations} from '../../../dist/app/src/index.js';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {createDesktopAuthority} from '../../../dist/app/src/desktop-authority.js';
import {createDesktopSpace} from '../../../dist/app/src/desktop-space.js';
import {createDesktopApi} from '../../../dist/app/src/desktop-api.js';
import {createDesktopAi} from '../../../dist/app/src/desktop-ai.js';
import {createDesktopConversations} from '../../../dist/app/src/desktop-conversations.js';
async function verify(){
 app.enableSandbox();if(process.platform==='linux')app.disableHardwareAcceleration();
 const scenario=process.argv.at(-1);assert.ok(['idle','startup','stream','destroyed'].includes(scenario));
 const root=process.env.WEX_DESKTOP_FIXTURE_ROOT;assert.ok(root);const id=randomUUID();
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id}));
 for(const folder of ['electron-user','electron-session'])await mkdir(join(root,folder));
 app.setPath('userData',join(root,'electron-user'));app.setPath('sessionData',join(root,'electron-session'));
 const wait=async(predicate,label)=>{const until=Date.now()+12000;while(!await predicate()){if(Date.now()>until)throw Error(label+'_timeout');await new Promise(r=>setTimeout(r,25));}};
 const exists=async path=>{try{await lstat(path);return true;}catch{return false;}};
 const choices=[],confirmations=[],calls=[];let streaming=false,arrived,heldResponse,releaseStartup,created;
 const startupGate=new Promise(r=>releaseStartup=r),providerCreated=new Promise(r=>created=r);
 const server=createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);calls.push(JSON.parse(Buffer.concat(chunks).toString()));
  res.writeHead(200,{'content-type':'text/event-stream'});
  res.write('data: '+JSON.stringify({choices:[{index:0,delta:{content:'partial'},finish_reason:null}]})+'\n\n');
  if(streaming){heldResponse=res;arrived?.();return;}
  res.end('data: '+JSON.stringify({choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let failClose=scenario==='idle';
 const timer=setTimeout(()=>{console.error('renderer_failure_timeout '+scenario);app.exit(1);},75000);
 let reopened,controls;
 try{
  const runtime=await runDesktop({url:pathToFileURL(resolve('desktop-dist/index.html')).href,preload:resolve('desktop-dist/preload.cjs'),spaceRootId:id,show:false,
   spacePlatform:{confirm:async summary=>{confirmations.push(summary);return true;},chooseDirectory:async()=>undefined},
   failureAction:async state=>{choices.push(state);return 'hold';},
   start:async policy=>{
    const host=await startFoundations({dataRoot:root,expectedRootId:id,...policy,space:{deriveRequest:policy.space.deriveRequest},api:{deriveRequest:policy.api.deriveRequest},ai:{bindRead:policy.ai.bindRead},conversations:true,technicalDiagnostics:{},
     openStore(path,namespace){const db=openSqliteStore(path,namespace);return {...db,close(){if(failClose&&namespace==='permissions'){failClose=false;throw Error('fixture-close-failure');}db.close();}};}
    });
    created(host);if(scenario==='startup')await startupGate;return host;
   }
  });
  const wc=runtime.window.webContents,host=await providerCreated;
  const invoke=async(method,input)=>{const reply=await wc.executeJavaScript('window.wexHost.'+method+'('+JSON.stringify(input)+')');assert.equal(reply.ok,true);return reply.value;};
  let savedSpace,conversation;
  if(scenario!=='startup'){
   await runtime.lifecycle.start();await wait(()=>runtime.readStatus().phase==='ready','ready');
   savedSpace=await invoke('space',{kind:'space.create',name:'Persisted before renderer fault'});assert.equal(savedSpace.status,'committed');
  }
  if(scenario==='stream'){
   const c=await invoke('api',{kind:'connection.create',name:'Crash fixture',provider:'fixture',endpoint:'http://127.0.0.1:'+server.address().port+'/v1',endpointMode:'base',enabled:true});assert.equal(c.status,'committed');
   const m=await invoke('api',{kind:'model.create',connectionId:c.id,name:'Fixture',modelId:'fixture'});assert.equal(m.status,'committed');
   assert.equal((await invoke('api',{kind:'model.probe',id:m.id,expectedRevision:1})).status,'committed');
   assert.equal((await invoke('ai',{kind:'save',id:'role',expectedRevision:0,value:{kind:'role',name:'Role',prompt:'private fixture prompt'}})).status,'committed');
   assert.equal((await invoke('ai',{kind:'save',id:'position',expectedRevision:0,value:{kind:'position',name:'Position',responsibility:'Fixture'}})).status,'committed');
   assert.equal((await invoke('ai',{kind:'save',id:'agent',expectedRevision:0,value:{kind:'agent',name:'Agent',roleId:'role',positionId:'position',model:{connectionId:c.id,modelId:m.id}}})).status,'committed');
   conversation=await invoke('conversations',{kind:'create'});assert.equal(conversation.status,'committed');
   streaming=true;const ready=new Promise(r=>arrived=r);
   void invoke('conversations',{kind:'send',id:conversation.id,expectedRevision:1,agentId:'agent',text:'private fixture question'}).catch(()=>undefined);
   await ready;
  }
  const requestsBefore=calls.length;
  if(scenario==='destroyed')runtime.window.destroy();
  else{
   const gone=new Promise(r=>wc.once('render-process-gone',r));wc.forcefullyCrashRenderer();await gone;
  }
  if(scenario==='startup'){
   await wait(()=>runtime.readStatus().phase==='failed','startup fault');
   assert.equal(choices.length,0);assert.equal(await exists(join(root,'.wex-write-lock')),true);releaseStartup();
  }
  await wait(()=>choices.length===1,'failure choice');
  assert.equal(runtime.readStatus().phase,scenario==='idle'?'release-pending':'failed');
  assert.equal(choices[0].release,scenario==='idle'?'incomplete':'stopped');
  if(scenario==='idle'){
   assert.equal(await exists(join(root,'.wex-write-lock')),true);
   const competing=await startFoundations({dataRoot:root,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false}});
   assert.equal(competing.status,'failed');
  }
  if(scenario!=='destroyed'){
   const loaded=new Promise(r=>wc.once('did-finish-load',r));wc.reload();await loaded;
   await wait(async()=>await wc.executeJavaScript("typeof window.wexHost==='object'"),'reloaded preload');
   const before=confirmations.length;
   for(const method of ['space','api','ai','conversations','connections','permissions']){
    assert.deepEqual(await wc.executeJavaScript('window.wexHost.'+method+'({kind:"snapshot"})'),{ok:false,error:'host_unavailable'});
   }
   for(const method of ['cancelApi','cancelConversations'])assert.deepEqual(await wc.executeJavaScript('window.wexHost.'+method+'()'),{ok:false,error:'host_unavailable'});
   assert.equal(confirmations.length,before);
  }
  assert.equal((await runtime.lifecycle.stop()).status,'stopped');
  assert.equal(await exists(join(root,'.wex-write-lock')),false);assert.equal(calls.length,requestsBefore);
  const authority=createDesktopAuthority(),confirm=async()=>true;
  const space=createDesktopSpace({authority,rootId:id,confirm,chooseDirectory:async()=>undefined});
  const api=createDesktopApi({authority,confirm,requestCredential:async()=>undefined,cancelCredential(){}});
  const ai=createDesktopAi({authority,confirm}),chat=createDesktopConversations({authority,confirm});
  controls={space,api,ai,chat};
  reopened=await startFoundations({dataRoot:root,expectedRootId:id,...authority.policy,space:{deriveRequest:space.derive},api:{deriveRequest:api.derive},ai:{bindRead:ai.bindRead},conversations:true,technicalDiagnostics:{}});
  assert.equal(reopened.status,'ready');space.attach(reopened);api.attach(reopened);ai.attach(reopened);chat.attach(reopened);
  assert.equal((await authority.settings({kind:'snapshot'},confirm)).entries.length,0);
  const history=reopened.technicalDiagnostics.read();assert.equal(history.status,'ok');
  assert.equal(history.records.filter(r=>r.entry.code==='renderer_unavailable').length,1);
  assert.equal(JSON.stringify(history).includes('private fixture'),false);
  if(savedSpace){const snapshot=await space.request({kind:'snapshot'});assert.equal(snapshot.spaces[0].id,savedSpace.id);}
  if(conversation){
   const result=await chat.request({kind:'open',id:conversation.id});assert.equal(result.status,'ok');
   const generation=result.conversation.generations[0];assert.equal(generation.status,'cancelled');
   const operation=reopened.connections.operations.get(generation.operationId);assert.equal(operation.phase,'unknown');assert.equal(operation.attempts,1);
  }
  assert.equal(calls.length,requestsBefore);
  space.close();chat.close();ai.close();api.close();assert.equal((await reopened.stop()).status,'stopped');reopened=undefined;
  const report={source:process.env.GITHUB_SHA,platform:process.platform,scenario,checks:[
   scenario==='destroyed'?'actual WebContents destruction':'actual Electron forcefullyCrashRenderer',
   'failure never remains ready','fresh host recovers original root and saved facts with empty session grants',
   'renderer failure persists one code-only diagnostic','no automatic network replay',
   ...(scenario!=='destroyed'?['business IPC and cancellation controls cannot regain authority after same-window reload']:[]),
   ...(scenario==='startup'?['pending startup retains provider ownership until initialization settles']:[]),
   ...(scenario==='idle'?['incomplete release keeps root occupied until explicit retry']:[]),
   ...(scenario==='stream'?['in-flight conversation cancelled; original API Operation unknown with one attempt']:[])
  ],fixtures:['native confirmations and recovery choice supplied by trusted main test','local HTTP/SSE Provider','one permissions close failure in idle scenario'],limits:['native restart selection is exercised through the main-only supervisor contract; no automatic app relaunch in this fixture','main-process hard-crash lock reclamation is outside this test']};
  await writeFile(resolve('desktop-acceptance',process.platform+'-renderer-'+scenario+'.json'),JSON.stringify(report,null,2));
  console.log('DESKTOP_RENDERER_FAILURE '+JSON.stringify(report));heldResponse?.destroy();server.closeAllConnections();server.close();clearTimeout(timer);app.quit();
 }catch(error){releaseStartup();heldResponse?.destroy();server.closeAllConnections();server.close();clearTimeout(timer);console.error(error);app.exit(1);}
}
void verify().catch(error=>{console.error(error);app.exit(1);});
