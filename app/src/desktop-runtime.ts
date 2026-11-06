import {app,BrowserWindow,ipcMain,session} from 'electron';
import type {FoundationHost} from './foundations.js';
import type {DesktopStatus} from '../../UI/src/index.js';
import {createDesktopLifecycle} from './desktop-lifecycle.js';
import {createDesktopGateway} from './desktop-gateway.js';
/** Called only by trusted main-process code. Renderer receives no module instances. */
export async function runDesktop(options:{url:string;preload:string;start:()=>Promise<FoundationHost>;show?:boolean}){
 const lifecycle=createDesktopLifecycle(options.start);
 let phase:DesktopStatus['phase']='starting',host:FoundationHost|undefined,exiting=false;
 let window:BrowserWindow|undefined;
 const readStatus=():DesktopStatus=>({phase,diagnostics:(host?.diagnostics??[]).map(({module,reason})=>({module,reason}))});
 app.on('before-quit',event=>{
  if(exiting)return;event.preventDefault();phase='stopping';
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
 // Begin ownership before awaiting page load, so a concurrent close waits for startup.
 const startup=lifecycle.start();
 void startup.then(value=>{host=value;if(phase==='starting')phase=value?.status??'failed';},()=>{phase='failed';});
 await window.loadURL(options.url);
 return Object.freeze({window,readStatus,lifecycle});
}
