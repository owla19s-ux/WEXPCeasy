'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('wexHost',Object.freeze({
 readStatus:()=>ipcRenderer.invoke('wex:desktop:status',{}),
 requestQuit:()=>ipcRenderer.invoke('wex:desktop:quit',{})
}));
