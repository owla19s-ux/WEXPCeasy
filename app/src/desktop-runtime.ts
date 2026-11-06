import {app,BrowserWindow,ipcMain,session,dialog} from 'electron';
import type {FoundationHost,FoundationOptions} from './foundations.js';
import type {DesktopStatus} from '../../UI/src/index.js';
import {createDesktopLifecycle} from './desktop-lifecycle.js';
import {createDesktopGateway} from './desktop-gateway.js';
import {createDesktopSpace} from './desktop-space.js';
/** Called only by trusted main-process code. Renderer receives no module instances. */
export async function runDesktop(options:{url:string;preload:string;start:(policy?:Pick<FoundationOptions,'trust'|'local'|'space'>)=>Promise<FoundationHost>;show?:boolean;spaceRootId?:string;spacePlatform?:{confirm:(summary:string)=>Promise<boolean>;chooseDirectory:()=>Promise<string|undefined>}}){
 let access:ReturnType<typeof createDesktopSpace>|undefined;
 const lifecycle=createDesktopLifecycle(async()=>{
  const value=await options.start(access?{...access.policy,space:{deriveRequest:access.derive}}:undefined);
  access?.attach(value);return value;
 });
 let phase:DesktopStatus['phase']='starting',host:FoundationHost|undefined,exiting=false;
 let window:BrowserWindow|undefined;
 const readStatus=():DesktopStatus=>({phase,diagnostics:(host?.diagnostics??[]).map(({module,reason})=>({module,reason}))});
 app.on('before-quit',event=>{
  if(exiting)return;event.preventDefault();access?.close();phase='stopping';
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
 window=new BrowserWindow({width:1080,height:740,minWidth:720,minHeight:480,show:options.show??true,
  webPreferences:{preload:options.preload,nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false}});
 if(options.spaceRootId)access=createDesktopSpace({rootId:options.spaceRootId,
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
 // Begin ownership before awaiting page load, so a concurrent close waits for startup.
 const startup=lifecycle.start();
 void startup.then(value=>{host=value;if(phase==='starting')phase=value?.status??'failed';},()=>{phase='failed';});
 try{await window.loadURL(options.url);}catch{
  // Startup already owns providers: failure must use the same confirmed-release path.
  phase='failed';app.quit();
 }
 return Object.freeze({window,readStatus,lifecycle});
}
