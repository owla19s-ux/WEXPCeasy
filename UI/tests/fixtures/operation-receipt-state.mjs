import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {ConnectionSettings} from '../../../dist/UI/src/connection-settings.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const check=(v,m)=>{if(!v)throw Error(m);};
async function verify(){const checks=[];
 for(const scenario of ['tool-error','unknown','revoked','unmount']){
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container),pending=[],listeners=new Set();
  const bridge={onAccessChanged(fn){listeners.add(fn);return ()=>listeners.delete(fn);},connections(input){return new Promise(resolve=>pending.push({input,resolve}));}};
  const click=async label=>{const b=[...container.querySelectorAll('button')].find(b=>b.textContent===label);check(b&&!b.disabled,'unavailable '+label);await act(async()=>b.click());};
  const settle=async value=>{const p=pending.shift();check(p,'missing request');await act(async()=>p.resolve({ok:true,value}));};
  try{
   await act(async()=>root.render(React.createElement(ConnectionSettings,{bridge})));await click('读取连接与操作记录');await settle({status:'ok',revision:1,connections:[],operations:[{id:'original',phase:'unknown',attempts:1,connectionId:'connection',adapter:'fixture'}],localFiles:false,localDirectories:false});
   await click('读取原 Operation 回执');check(pending[0].input.kind==='operation.read'&&pending[0].input.id==='original','receipt read retargeted or replayed');
   if(scenario==='revoked')await act(async()=>{for(const fn of [...listeners])fn();});if(scenario==='unmount')await act(async()=>root.unmount());
   await settle({status:'operation',operation:{id:'original',phase:scenario==='unknown'?'unknown':'observed',createdAt:'2026-11-09T00:00:00Z',attempts:1,connectionId:'connection',adapter:'fixture',observations:[{id:'result',phase:'observed',recordedAt:'2026-11-09T00:00:01Z',value:{isError:true,content:[{type:'text',text:'PRIVATE-RESULT'}]}}]}});
   if(scenario==='revoked'||scenario==='unmount')check(!container.textContent.includes('PRIVATE-RESULT'),'late receipt disclosed revoked data');
   else{check(container.textContent.includes('PRIVATE-RESULT'),'real receipt body missing');check(container.textContent.includes(scenario==='unknown'?'结果未知':'工具返回错误'),'outcome misclassified as success');check(container.textContent.includes('2026-11-09T00:00:01Z'),'durable observation time hidden');}
   check(pending.length===0,'receipt started more work');checks.push(scenario);
  }finally{if(scenario!=='unmount')await act(async()=>root.unmount());check(listeners.size===0,'subscription leak');container.remove();}
 }return {ok:true,checks,fixture:'deferred receipt bridge; real React/Electron DOM; no tool invocation',remoteMutations:0};}
globalThis.operationReceiptStateResult=verify().catch(error=>({ok:false,error:String(error.stack??error)}));
