import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {ApiSettings} from '../../../dist/UI/src/api-settings.js';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const check=(condition,message)=>{if(!condition)throw Error(message);};
const connection={id:'connection',revision:1,name:'Private Provider',provider:'Custom',protocol:'openai-chat',endpoint:'https://example.test/v1',enabled:true,credentialRef:null,parameters:{}};
const snapshot=name=>({status:'ok',view:'connections',credentialBackend:false,connections:[{...connection,name}]});
async function fixture(){
 const container=document.createElement('div');document.body.append(container);
 const root=createRoot(container),listeners=new Set(),pending=[];
 const bridge={onAccessChanged(fn){listeners.add(fn);return ()=>listeners.delete(fn);},api(){return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
 await act(async()=>root.render(React.createElement(ApiSettings,{bridge})));
 return {container,
  async click(label){const b=[...container.querySelectorAll('button')].find(b=>b.textContent===label);check(b&&!b.disabled,'unavailable: '+label);await act(async()=>b.click());},
  async settle(value,reject=false){const p=pending.shift();check(p,'missing request');await act(async()=>{if(reject)p.reject(Error(value));else p.resolve({ok:true,value});});},
  async revoke(){await act(async()=>{for(const fn of listeners)fn();});},
  async close(){check(pending.length===0,'unresolved request');await act(async()=>root.unmount());check(listeners.size===0,'subscription leak');container.remove();}
 };
}
async function verify(){
 const checks=[];
 for(const phase of ['snapshot','models','error']){
  const f=await fixture();
  try{
   await f.click('读取 API 配置');
   if(phase==='models'){await f.settle(snapshot(connection.name));await f.click(connection.name);await f.click('读取已配置模型');}
   await f.revoke();
   const status=f.container.querySelector('[role=status]').textContent;
   await f.settle(phase==='snapshot'?snapshot('stale-private-provider'):phase==='models'?{status:'ok',view:'models',models:[{id:'stale-model',revision:1,name:'stale-private-model',modelId:'old',parameters:{}}]}:'stale-private-error',phase==='error');
   check(!f.container.textContent.includes('stale-private'),'late '+phase+' disclosed revoked data');
   check(f.container.querySelector('[role=status]').textContent===status,'late result replaced revocation notice');
   await f.click('读取 API 配置');await f.settle(snapshot('Fresh Provider'));
   check(f.container.textContent.includes('Fresh Provider'),'fresh authorized read unavailable');
   checks.push('revocation invalidates late '+phase);
  }finally{await f.close();}
 }
 return {ok:true,checks,fixture:'deferred DesktopBridge; real React and browser DOM',remoteMutations:0};
}
globalThis.apiSettingsStateResult=verify().catch(error=>({ok:false,error:String(error.stack??error)}));
