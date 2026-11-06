'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const arg=process.argv.find(value=>value.startsWith('--wex-credential-session='));
const nonce=arg&&arg.slice('--wex-credential-session='.length);
if(nonce&&/^[a-f0-9-]{36}$/.test(nonce)){
 const prefix='wex:credential:'+nonce+':';
 contextBridge.exposeInMainWorld('wexCredential',Object.freeze({
  target:()=>ipcRenderer.invoke(prefix+'target',{}),
  submit:secret=>ipcRenderer.invoke(prefix+'submit',secret),
  cancel:()=>ipcRenderer.invoke(prefix+'cancel',{})
 }));
}
