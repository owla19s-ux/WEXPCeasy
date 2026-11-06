import {BrowserWindow,ipcMain,session} from 'electron';
import {randomUUID} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {createDesktopGateway} from './desktop-gateway.js';
export interface CredentialTarget {connectionName:string;provider:string;endpoint:string}
/** Trusted main-only prompt. Plaintext resolves only to its caller, never to the parent Renderer. */
export function createCredentialPrompt(options:{parent:BrowserWindow;pageUrl:string;preload:string;show?:boolean}){
 let activeCancel:(()=>void)|undefined,disposed=false;
 return Object.freeze({
  request(input:CredentialTarget):Promise<string|undefined>{
   if(disposed||activeCancel||options.parent.isDestroyed())return Promise.resolve(undefined);
   let target:CredentialTarget;
   try{
    target=Object.freeze({connectionName:input.connectionName,provider:input.provider,endpoint:input.endpoint});
    if(Object.values(target).some(value=>typeof value!=='string'||!value||value.length>4096)||new URL(options.pageUrl).protocol!=='file:'||!isAbsolute(options.preload))return Promise.resolve(undefined);
   }catch{return Promise.resolve(undefined);}
   return new Promise(resolve=>{
    const nonce=randomUUID(),prefix='wex:credential:'+nonce+':',channels=['target','submit','cancel'].map(key=>prefix+key);
    const isolated=session.fromPartition('wex-credential-'+nonce,{cache:false});
    isolated.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
    isolated.setPermissionCheckHandler(()=>false);isolated.setSpellCheckerEnabled(false);
    const assets=new Set([options.pageUrl,new URL('credential.js',options.pageUrl).href,new URL('style.css',options.pageUrl).href]);
    isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!assets.has(details.url)}));
    const window=new BrowserWindow({parent:options.parent,modal:true,width:600,height:520,show:options.show??true,autoHideMenuBar:true,
     webPreferences:{session:isolated,preload:options.preload,additionalArguments:['--wex-credential-session='+nonce],nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false,devTools:false}});
    window.setMenu(null);const contents=window.webContents;
    contents.setWindowOpenHandler(()=>({action:'deny'}));contents.on('will-attach-webview',event=>event.preventDefault());
    contents.on('will-navigate',(event,url)=>{if(url!==options.pageUrl)event.preventDefault();});
    contents.on('will-redirect',(event,url)=>{if(url!==options.pageUrl)event.preventDefault();});
    contents.on('will-frame-navigate',event=>{if(event.url!==options.pageUrl)event.preventDefault();});
    let settled=false;
    const finish=(value?:string)=>{
     if(settled)return;settled=true;for(const channel of channels)ipcMain.removeHandler(channel);activeCancel=undefined;
     if(!window.isDestroyed())window.destroy();resolve(value);
    };
    activeCancel=()=>finish();
    const source=createDesktopGateway({sender:contents,url:options.pageUrl,read:()=>true});
    ipcMain.handle(prefix+'target',createDesktopGateway({sender:contents,url:options.pageUrl,read:()=>target}));
    ipcMain.handle(prefix+'submit',(event,payload:unknown)=>{
     const check=source(event,{});if(!check.ok)return check;
     if(settled||disposed||typeof payload!=='string'||payload.length>8192||!/^[-a-zA-Z0-9._~+/]+=*$/.test(payload))return {ok:false,error:'invalid_secret'};
     setImmediate(()=>finish(payload));return {ok:true,value:{accepted:true}};
    });
    ipcMain.handle(prefix+'cancel',createDesktopGateway({sender:contents,url:options.pageUrl,read:()=>{setImmediate(()=>finish());return {accepted:true};}}));
    window.once('closed',()=>finish());void window.loadURL(options.pageUrl).catch(()=>finish());
   });
  },
  cancel(){activeCancel?.();},
  dispose(){disposed=true;activeCancel?.();}
 });
}
