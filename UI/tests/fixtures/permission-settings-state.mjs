import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {PermissionSettings} from '../../../dist/UI/src/permission-settings.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const check=(condition,message)=>{if(!condition)throw Error(message);};
const snapshot=target=>({status:'ok',revision:1,entries:[{id:'grant',resource:'local',action:'read',target,context:null}]});
async function verify(){
 const checks=[];
 for(const phase of ['snapshot','error','own-revoke']){
  const container=document.createElement('div');document.body.append(container);
  const root=createRoot(container),listeners=new Set(),pending=[];
  const bridge={onAccessChanged(fn){listeners.add(fn);return ()=>listeners.delete(fn);},permissions(){return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
  const click=async()=>{const button=[...container.querySelectorAll('button')].find(b=>b.textContent==='读取当前窗口授权');check(button&&!button.disabled,'read unavailable');await act(async()=>button.click());};
  try{
   await act(async()=>root.render(React.createElement(PermissionSettings,{bridge})));
   await click();
   if(phase==='own-revoke'){
    await act(async()=>pending.shift().resolve({ok:true,value:snapshot('old-target')}));
    await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='撤销此授权').click());
   }
   await act(async()=>{for(const fn of listeners)fn();});
   const status=container.querySelector('[role=status]').textContent;
   await act(async()=>{const p=pending.shift();if(phase==='error')p.reject(Error('stale-private-error'));else p.resolve({ok:true,value:phase==='own-revoke'?{status:'committed'}:snapshot('stale-private-target')});});
   check(!container.textContent.includes('stale-private'),'late permission response disclosed revoked target or error');
   if(phase==='own-revoke'){
    check(container.querySelector('[role=status]').textContent.includes('已撤销'),'own committed revoke receipt was lost');
    check(!container.textContent.includes('old-target'),'own revoke restored old grant');
    check(pending.length===0,'own revoke automatically reread after access invalidation');
   }else check(container.querySelector('[role=status]').textContent===status,'late response replaced invalidation notice');
   await click();await act(async()=>pending.shift().resolve({ok:true,value:snapshot('fresh-target')}));
   check(container.textContent.includes('fresh-target'),'fresh permission read unavailable');
   checks.push(phase==='own-revoke'?'own revoke receipt survives access notification without restoring grants':'revocation invalidates late '+phase);
  }finally{await act(async()=>root.unmount());check(listeners.size===0,'subscription leak');container.remove();}
 }
 return {ok:true,checks,fixture:'deferred DesktopBridge; real React and browser DOM',remoteMutations:0};
}
globalThis.permissionSettingsStateResult=verify().catch(error=>({ok:false,error:String(error.stack??error)}));
