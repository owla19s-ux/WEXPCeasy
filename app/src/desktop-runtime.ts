import {app,BrowserWindow,ipcMain,session,dialog} from 'electron';
import type {FoundationHost,FoundationOptions} from './foundations.js';
import type {DesktopStatus} from '../../UI/src/index.js';
import {createDesktopLifecycle} from './desktop-lifecycle.js';
import {createDesktopGateway} from './desktop-gateway.js';
import {fileURLToPath} from 'node:url';
import {createDesktopAuthority} from './desktop-authority.js';
import {createDesktopConnections} from './desktop-connections.js';
import {createDesktopAi} from './desktop-ai.js';
import {createDesktopConversations} from './desktop-conversations.js';
import {createDesktopApi} from './desktop-api.js';
import {createCredentialPrompt} from './credential-prompt.js';
import {createDesktopSpace} from './desktop-space.js';
/** Called only by trusted main-process code. Renderer receives no module instances. */
export async function runDesktop(options:{url:string;preload:string;start:(policy?:Pick<FoundationOptions,'trust'|'local'|'space'|'api'|'ai'>)=>Promise<FoundationHost>;show?:boolean;spaceRootId?:string;spacePlatform?:{confirm:(summary:string)=>Promise<boolean>;chooseDirectory:()=>Promise<string|undefined>}}){
 const authority=createDesktopAuthority();
 let access:ReturnType<typeof createDesktopSpace>|undefined,api:ReturnType<typeof createDesktopApi>|undefined;
 let ai:ReturnType<typeof createDesktopAi>|undefined,conversations:ReturnType<typeof createDesktopConversations>|undefined;
 let connections:ReturnType<typeof createDesktopConnections>|undefined;
 let credential:ReturnType<typeof createCredentialPrompt>|undefined;
 const lifecycle=createDesktopLifecycle(async()=>{
  const value=await options.start(access?{...authority.policy,space:{deriveRequest:access.derive},api:{deriveRequest:api!.derive},ai:{bindRead:ai!.bindRead}}:undefined);
  access?.attach(value);api?.attach(value);ai?.attach(value);conversations?.attach(value);connections?.attach(value);return value;
 });
 let phase:DesktopStatus['phase']='starting',host:FoundationHost|undefined,exiting=false;
 let window:BrowserWindow|undefined;
 const readStatus=():DesktopStatus=>({phase,diagnostics:(host?.diagnostics??[]).map(({module,reason})=>({module,reason}))});
 app.on('before-quit',event=>{
  if(exiting)return;event.preventDefault();connections?.close();conversations?.close();ai?.close();access?.close();api?.close();credential?.dispose();phase='stopping';
  void lifecycle.stop().then(result=>{
   if(result.status==='stopped'){exiting=true;app.quit();}
   else{phase='release-pending';window?.show();}
  });
 });
 await app.whenReady();
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 session.defaultSession.setPermissionCheckHandler(()=>false);
 const assets=new Set([options.url,new URL('renderer.js',options.url).href,new URL('style.css',options.url).href]);
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!assets.has(details.url)}));
 window=new BrowserWindow({width:1440,height:900,minWidth:480,minHeight:320,show:options.show??true,
  webPreferences:{preload:options.preload,nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false}});
 if(options.show!==false)window.maximize();
 const nativeConfirm=options.spacePlatform?.confirm??(async(summary:string)=>(await dialog.showMessageBox(window!,{type:'question',title:'WEXPCeasy 操作确认',message:summary,buttons:['取消','允许本次操作'],defaultId:0,cancelId:0})).response===1);
 credential=createCredentialPrompt({parent:window,pageUrl:new URL('credential.html',options.url).href,preload:fileURLToPath(new URL('credential-preload.cjs',options.url)),show:options.show??true});
 api=createDesktopApi({authority,confirm:nativeConfirm,requestCredential:target=>credential!.request(target),cancelCredential:()=>credential?.cancel()});
 connections=createDesktopConnections({authority,confirm:nativeConfirm});
 ai=createDesktopAi({authority,confirm:nativeConfirm});
 conversations=createDesktopConversations({authority,confirm:nativeConfirm,onText:event=>{if(!window!.isDestroyed())window!.webContents.send('wex:desktop:conversation-text',event);}});
 if(options.spaceRootId)access=createDesktopSpace({authority,rootId:options.spaceRootId,
  confirm:options.spacePlatform?.confirm??(async summary=>(await dialog.showMessageBox(window!,{type:'question',title:'WEXPCeasy 操作确认',message:summary,buttons:['取消','允许本次操作'],defaultId:0,cancelId:0})).response===1),
  chooseDirectory:options.spacePlatform?.chooseDirectory??(async()=>{const result=await dialog.showOpenDialog(window!,{title:'选择目录（Context 自身记录需已有 WEX 数据根）',properties:['openDirectory']});return result.canceled?undefined:result.filePaths[0];})
 });
 const contents=window.webContents;
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
 const businessSource=createDesktopGateway({sender:contents,url:options.url,read:()=>true});
 ipcMain.handle('wex:desktop:space',async(event,payload)=>{
  const check=businessSource(event,{});if(!check.ok)return check;
  if(phase!=='ready'&&phase!=='degraded')return {ok:false,error:'host_unavailable'};
  return {ok:true,value:access?await access.request(payload):{status:'unavailable',reason:'space_unavailable'}};
 });
 ipcMain.handle('wex:desktop:api',async(event,payload)=>{
  const check=businessSource(event,{});if(!check.ok)return check;
  if(phase!=='ready'&&phase!=='degraded')return {ok:false,error:'host_unavailable'};
  return {ok:true,value:await api!.request(payload)};
 });
 ipcMain.handle('wex:desktop:api-cancel',createDesktopGateway({sender:contents,url:options.url,read:()=>{api?.cancel();return {accepted:true as const};}}));
 ipcMain.handle('wex:desktop:ai',async(event,payload)=>{
  const check=businessSource(event,{});if(!check.ok)return check;
  if(phase!=='ready'&&phase!=='degraded')return {ok:false,error:'host_unavailable'};
  return {ok:true,value:await ai!.request(payload)};
 });
 ipcMain.handle('wex:desktop:conversations',async(event,payload)=>{
  const check=businessSource(event,{});if(!check.ok)return check;
  if(phase!=='ready'&&phase!=='degraded')return {ok:false,error:'host_unavailable'};
  return {ok:true,value:await conversations!.request(payload)};
 });
 ipcMain.handle('wex:desktop:conversation-cancel',createDesktopGateway({sender:contents,url:options.url,read:()=>conversations!.cancel()}));
 ipcMain.handle('wex:desktop:permissions',async(event,payload)=>{
  const check=businessSource(event,{});if(!check.ok)return check;
  if(phase!=='ready'&&phase!=='degraded')return {ok:false,error:'host_unavailable'};
  try{const value=await authority.settings(payload,nativeConfirm);if(value.status==='committed'&&!contents.isDestroyed())contents.send('wex:desktop:access-changed');return {ok:true,value};}catch{return {ok:false,error:'permission_settings_unavailable'};}
 });
 ipcMain.handle('wex:desktop:connections',async(event,payload)=>{
  const check=businessSource(event,{});if(!check.ok)return check;
  if(phase!=='ready'&&phase!=='degraded')return {ok:false,error:'host_unavailable'};
  return {ok:true,value:await connections!.request(payload)};
 });
 // Begin ownership before awaiting page load, so a concurrent close waits for startup.
 const startup=lifecycle.start();
 void startup.then(value=>{host=value;if(phase==='starting')phase=value?.status??'failed';},()=>{phase='failed';});
 try{await window.loadURL(options.url);}catch{
  // Startup already owns providers: failure must use the same confirmed-release path.
  phase='failed';app.quit();
 }
 return Object.freeze({window,readStatus,lifecycle});
}
