'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('wexHost',Object.freeze({
 ai:input=>ipcRenderer.invoke('wex:desktop:ai',input),
 conversations:input=>ipcRenderer.invoke('wex:desktop:conversations',input),
 cancelConversations:()=>ipcRenderer.invoke('wex:desktop:conversation-cancel',{}),
 permissions:input=>ipcRenderer.invoke('wex:desktop:permissions',input),
 onConversationText:listener=>{
  if(typeof listener!=='function')throw Error('invalid_listener');
  const receive=(_event,value)=>{if(value&&typeof value.conversationId==='string'&&typeof value.generationId==='string'&&typeof value.text==='string')listener(value);};
  ipcRenderer.on('wex:desktop:conversation-text',receive);
  return ()=>ipcRenderer.removeListener('wex:desktop:conversation-text',receive);
 },
 api:input=>ipcRenderer.invoke('wex:desktop:api',input),
 cancelApi:()=>ipcRenderer.invoke('wex:desktop:api-cancel',{}),
 space:input=>ipcRenderer.invoke('wex:desktop:space',input),
 readStatus:()=>ipcRenderer.invoke('wex:desktop:status',{}),
 requestQuit:()=>ipcRenderer.invoke('wex:desktop:quit',{})
}));
