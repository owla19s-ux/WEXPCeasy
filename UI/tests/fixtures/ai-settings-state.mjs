import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {AiSettings} from '../../../dist/UI/src/ai-settings.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const check=(condition,message)=>{if(!condition)throw Error(message);};
const snapshot=name=>({status:'ok',entries:[{id:'agent',revision:1,kind:'agent',name,roleId:'role',positionId:'position',model:{connectionId:'connection',modelId:'model'}}]});
async function fixture(){
 const container=document.createElement('div');document.body.append(container);
 const root=createRoot(container),listeners=new Set(),pending=[];
 const request=input=>new Promise((resolve,reject)=>pending.push({resolve,reject,input}));
 const bridge={onAccessChanged(fn){listeners.add(fn);return ()=>listeners.delete(fn);},ai:request,api:request};
 await act(async()=>root.render(React.createElement(AiSettings,{bridge})));
 return {container,pending,
  async click(label){const b=[...container.querySelectorAll('button')].find(b=>b.textContent===label);check(b&&!b.disabled,'unavailable: '+label);await act(async()=>b.click());},
  async settle(value,reject=false){const p=pending.shift();check(p,'missing request');await act(async()=>{if(reject)p.reject(Error(value));else p.resolve({ok:true,value});});},
  async revoke(){await act(async()=>{for(const fn of listeners)fn();});},
  async close(){check(pending.length===0,'late response started another privileged read');await act(async()=>root.unmount());check(listeners.size===0,'subscription leak');container.remove();}
 };
}
async function verify(){
 const checks=[];
 for(const phase of ['snapshot','model-connections','model-list','error']){
  const f=await fixture();
  try{
   await f.click('读取 AI 配置');
   if(phase.startsWith('model-')){
    await f.settle(snapshot('Private Agent'));await f.click('Private Agent');await f.click('读取可选模型');
    if(phase==='model-list')await f.settle({status:'ok',view:'connections',connections:[{id:'connection',name:'Provider'}]});
   }
   await f.revoke();const status=f.container.querySelector('[role=status]').textContent;
   await f.settle(phase==='snapshot'?snapshot('stale-private-agent'):phase==='model-connections'?{status:'ok',view:'connections',connections:[{id:'connection',name:'stale-private-provider'}]}:phase==='model-list'?{status:'ok',view:'models',models:[{id:'model',connectionId:'connection',name:'stale-private-model'}]}:'stale-private-error',phase==='error');
   check(!f.container.textContent.includes('stale-private'),'late '+phase+' disclosed revoked data');
   check(f.pending.length===0,'late connection list started a new model request after revocation');
   check(f.container.querySelector('[role=status]').textContent===status,'late error replaced revocation notice');
   await f.click('读取 AI 配置');await f.settle(snapshot('Fresh Agent'));
   check(f.container.textContent.includes('Fresh Agent'),'fresh read unavailable');
   checks.push('revocation invalidates late '+phase);
  }finally{await f.close();}
 }
 return {ok:true,checks,fixture:'deferred DesktopBridge; real React and browser DOM',remoteMutations:0};
}
globalThis.aiSettingsStateResult=verify().catch(error=>({ok:false,error:String(error.stack??error)}));
