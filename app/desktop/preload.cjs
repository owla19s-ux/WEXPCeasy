'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('wexHost',Object.freeze({
 space:input=>ipcRenderer.invoke('wex:desktop:space',input),
 readStatus:()=>ipcRenderer.invoke('wex:desktop:status',{}),
 requestQuit:()=>ipcRenderer.invoke('wex:desktop:quit',{})
}));
