import {app,BrowserWindow,ipcMain,session,dialog} from 'electron';
import type {FoundationHost,FoundationOptions} from './foundations.js';
import type {DesktopStatus} from '../../UI/src/index.js';
import {createDesktopFailure} from './desktop-failure.js';
import type {DesktopFailureAction,DesktopFailureState} from './desktop-failure.js';
import {createDesktopLifecycle} from './desktop-lifecycle.js';
import {createDesktopGateway,createDesktopBusinessGate} from './desktop-gateway.js';
import {fileURLToPath} from 'node:url';
import {createDesktopAuthority} from './desktop-authority.js';
import {createDesktopConnections} from './desktop-connections.js';
import {createDesktopAi} from './desktop-ai.js';
import {createDesktopConversations} from './desktop-conversations.js';
import {createDesktopApi} from './desktop-api.js';
import {createCredentialPrompt} from './credential-prompt.js';
import {createDesktopSpace} from './desktop-space.js';
/** Called only by trusted main-process code. Renderer receives no module instances. */
export async function runDesktop(options:{url:string;preload:string;start:(policy?:Pick<FoundationOptions,'trust'|'local'|'space'|'api'|'ai'>)=>Promise<FoundationHost>;show?:boolean;spaceRootId?:string;failureAction?:(state:DesktopFailureState)=>Promise<DesktopFailureAction>;spacePlatform?:{confirm:(summary:string)=>Promise<boolean>;chooseDirectory:()=>Promise<string|undefined>}}){
 const authority=createDesktopAuthority();
 let access:ReturnType<typeof createDesktopSpace>|undefined,api:ReturnType<typeof createDesktopApi>|undefined;
 let ai:ReturnType<typeof createDesktopAi>|undefined,conversations:ReturnType<typeof createDesktopConversations>|undefined;
 let connections:ReturnType<typeof createDesktopConnections>|undefined;
 let credential:ReturnType<typeof createCredentialPrompt>|undefined;
 let phase:DesktopStatus['phase']='starting',host:FoundationHost|undefined,exiting=false,sealed=false,faultRecorded=false;
 let window:BrowserWindow|undefined,fault:DesktopFailureState|undefined;
 const localDiagnostics:{module:string;reason:string}[]=[];
 const readStatus=():DesktopStatus=>({phase,diagnostics:[...(host?.diagnostics??[]).map(({module,reason})=>({module,reason})),...localDiagnostics]});
 const confirmations=new AbortController();
 function seal(){
  if(sealed)return;sealed=true;confirmations.abort();
  // Persist the admitted conversation cancellation while its exact authority is still valid.
  // Then invalidate the whole window identity, cancel provider work and destroy secret-entry UI.
  for(const close of [()=>conversations?.close(),()=>api?.close(),()=>authority.close(),()=>ai?.close(),()=>access?.close(),()=>connections?.close(),()=>credential?.dispose()]){
   try{close();}catch{localDiagnostics.push({module:'desktop',reason:'entry_seal_failed'});}
  }
 }
 function recordFault(){
  if(faultRecorded||!host)return;faultRecorded=true;
  try{if(host.technicalDiagnostics?.reportDesktopFailure().status==='failed')localDiagnostics.push({module:'diagnostics',reason:'diagnostic_write_failed'});}
  catch{localDiagnostics.push({module:'diagnostics',reason:'diagnostic_write_failed'});}
 }
 const lifecycle=createDesktopLifecycle(async()=>{
  const value=await options.start(access?{...authority.policy,space:{deriveRequest:access.derive},api:{deriveRequest:api!.derive},ai:{bindRead:ai!.bindRead}}:undefined);
  // Lifecycle receives the provider before client attachment can fail, so shutdown never loses ownership.
  host=value;if(fault)recordFault();return value;
 });
 const failure=createDesktopFailure({seal,record:recordFault,stop:()=>lifecycle.stop(),
  publish(state){fault=state;phase=state.release==='incomplete'?'release-pending':'failed';
   if(!localDiagnostics.some(d=>d.module==='desktop'))localDiagnostics.push({module:'desktop',reason:state.kind});},
  async choose(state){
   if(exiting)return 'hold';
   if(options.failureAction)return options.failureAction(state);
   const released=state.release==='stopped';
   const prompt={type:'error' as const,title:'WEXPCeasy 界面不可用',
    message:released?'本次窗口授权已关闭，资源已确认释放。可退出或重新启动应用。':'本次窗口授权已关闭，但尚未确认所有资源释放，原数据目录继续保持占用。',
    detail:'已有数据保留。远端动作是否完成以原 Operation 为准，不会自动重发。重新启动后需要重新确认业务操作。',
    buttons:released?['退出应用','重新启动应用']:['保持现场','重试释放'],defaultId:0,cancelId:0};
   const answer=window&&!window.isDestroyed()?await dialog.showMessageBox(window,prompt):await dialog.showMessageBox(prompt);
   return released?(answer.response===1?'restart':'quit'):(answer.response===1?'retry-release':'hold');
  },
  exit(restart){if(exiting)return;if(restart)app.relaunch();exiting=true;app.quit();}
 });
 app.on('before-quit',event=>{
  if(exiting)return;event.preventDefault();seal();phase='stopping';
  void lifecycle.stop().then(result=>{
   if(result.status==='stopped'){exiting=true;app.quit();}
   else{phase='release-pending';if(window&&!window.isDestroyed())window.show();}
  });
 });
 // An unexpected WebContents destruction must use the same confirmed-release path, not implicit quit.
 app.on('window-all-closed',()=>{});
 await app.whenReady();
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 session.defaultSession.setPermissionCheckHandler(()=>false);
 const assets=new Set([options.url,new URL('renderer.js',options.url).href,new URL('style.css',options.url).href]);
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!assets.has(details.url)}));
 window=new BrowserWindow({width:1440,height:900,minWidth:480,minHeight:320,show:options.show??true,
  webPreferences:{preload:options.preload,nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false}});
 if(options.show!==false)window.maximize();
 const nativeConfirm=options.spacePlatform?.confirm??(async(summary:string)=>(await dialog.showMessageBox(window!,{type:'question',title:'WEXPCeasy 操作确认',message:summary,buttons:['取消','允许本次操作'],defaultId:0,cancelId:0,signal:confirmations.signal})).response===1);
 credential=createCredentialPrompt({parent:window,pageUrl:new URL('credential.html',options.url).href,preload:fileURLToPath(new URL('credential-preload.cjs',options.url)),show:options.show??true});
 api=createDesktopApi({authority,confirm:nativeConfirm,requestCredential:target=>credential!.request(target),cancelCredential:()=>credential?.cancel()});
 connections=createDesktopConnections({authority,confirm:nativeConfirm,requestCredential:target=>credential!.request(target),cancelCredential:()=>credential?.cancel()});
 ai=createDesktopAi({authority,confirm:nativeConfirm});
 conversations=createDesktopConversations({authority,confirm:nativeConfirm,onText:event=>{if(!window!.isDestroyed())window!.webContents.send('wex:desktop:conversation-text',event);}});
 if(options.spaceRootId)access=createDesktopSpace({authority,rootId:options.spaceRootId,
  confirm:nativeConfirm,
  chooseDirectory:options.spacePlatform?.chooseDirectory??(async()=>{const result=await dialog.showOpenDialog(window!,{title:'选择目录（Context 自身记录需已有 WEX 数据根）',properties:['openDirectory']});return result.canceled?undefined:result.filePaths[0];})
 });
 const contents=window.webContents;
 contents.on('render-process-gone',()=>{if(!exiting)void failure.fail('renderer-process-gone');});
 contents.on('destroyed',()=>{if(!exiting)void failure.fail('web-contents-destroyed');});
 contents.setWindowOpenHandler(()=>({action:'deny'}));
 contents.on('will-attach-webview',event=>event.preventDefault());
 contents.on('will-navigate',(event,url)=>{if(url!==options.url)event.preventDefault();});
 contents.on('will-redirect',(event,url)=>{if(url!==options.url)event.preventDefault();});
 contents.on('will-frame-navigate',details=>{if(details.url!==options.url)details.preventDefault();});
 window.on('close',event=>{if(!exiting){event.preventDefault();app.quit();}});
 ipcMain.handle('wex:desktop:status',createDesktopGateway({sender:contents,url:options.url,read:readStatus}));
 ipcMain.handle('wex:desktop:quit',createDesktopGateway({sender:contents,url:options.url,read:()=>{
  setImmediate(()=>app.quit());return {accepted:true as const};
 }}));
 const businessGate=createDesktopBusinessGate({sender:contents,url:options.url,isReady:()=>phase==='ready'||phase==='degraded'});
 function liveControl<T>(read:()=>T){
  const gate=createDesktopGateway({sender:contents,url:options.url,read});
  return (event:Parameters<typeof businessGate>[0],payload:unknown)=>{
   const check=businessGate(event);if(!check.ok)return check;
   return gate(event,payload);
  };
 }
 ipcMain.handle('wex:desktop:space',async(event,payload)=>{
  const check=businessGate(event);if(!check.ok)return check;
  return {ok:true,value:access?await access.request(payload):{status:'unavailable',reason:'space_unavailable'}};
 });
 ipcMain.handle('wex:desktop:api',async(event,payload)=>{
  const check=businessGate(event);if(!check.ok)return check;
  return {ok:true,value:await api!.request(payload)};
 });
 ipcMain.handle('wex:desktop:api-cancel',liveControl(()=>{api?.cancel();return {accepted:true as const};}));
 ipcMain.handle('wex:desktop:ai',async(event,payload)=>{
  const check=businessGate(event);if(!check.ok)return check;
  return {ok:true,value:await ai!.request(payload)};
 });
 ipcMain.handle('wex:desktop:conversations',async(event,payload)=>{
  const check=businessGate(event);if(!check.ok)return check;
  return {ok:true,value:await conversations!.request(payload)};
 });
 ipcMain.handle('wex:desktop:conversation-cancel',liveControl(()=>conversations!.cancel()));
 ipcMain.handle('wex:desktop:permissions',async(event,payload)=>{
  const check=businessGate(event);if(!check.ok)return check;
  try{const value=await authority.settings(payload,nativeConfirm);if(value.status==='committed'&&!contents.isDestroyed())contents.send('wex:desktop:access-changed');return {ok:true,value};}catch{return {ok:false,error:'permission_settings_unavailable'};}
 });
 ipcMain.handle('wex:desktop:connections',async(event,payload)=>{
  const check=businessGate(event);if(!check.ok)return check;
  return {ok:true,value:await connections!.request(payload)};
 });
 // Begin ownership before awaiting page load, so a concurrent close waits for startup.
 const startup=lifecycle.start();
 void startup.then(value=>{
  if(phase!=='starting')return;
  if(!value){phase='failed';return;}
  try{access?.attach(value);api?.attach(value);ai?.attach(value);conversations?.attach(value);connections?.attach(value);}
  catch{void failure.fail('bridge-setup-failed');return;}
  phase=value.status;
 },()=>{phase='failed';seal();});
 try{await window.loadURL(options.url);}catch{
  // Startup already owns providers: failure must use the same confirmed-release path.
  phase='failed';app.quit();
 }
 return Object.freeze({window,readStatus,lifecycle});
}
