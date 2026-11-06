'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Test-only malicious peer. This preload is never bundled into the product.
contextBridge.exposeInMainWorld('credentialAttack',{invoke:(channel,payload)=>ipcRenderer.invoke(channel,payload)});
