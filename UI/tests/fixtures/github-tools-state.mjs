import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {GitHubTools} from '../../../dist/UI/src/github-tools.js';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const check=(condition,message)=>{if(!condition)throw Error(message);};
const catalog=name=>({status:'tools',tools:[{name,description:name,inputSchema:{type:'object'}}]});
const result=marker=>({status:'tool-result',toolName:'tool',operationId:marker,result:{content:[{type:'text',text:marker}],isError:true}});

async function fixture(){
 const container=document.createElement('div');document.body.append(container);
 const root=createRoot(container),listeners=new Set(),pending=[],requests=[];
 const bridge={onAccessChanged(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  connections(input){requests.push(input);return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
 let props={bridge,connectionId:'original',revision:1,enabled:true,runtimeConfigured:true};
 const render=async()=>act(async()=>root.render(React.createElement(GitHubTools,props)));
 await render();
 return {container,requests,
  async click(label,twice=false){
   const button=[...container.querySelectorAll('button')].find(b=>b.textContent===label);
   check(button&&!button.disabled,'action unavailable: '+label);
   await act(async()=>{button.click();if(twice)button.click();});
  },
  async settle(value,reject=false){
   const task=pending.shift();check(task,'no pending bridge request');
   await act(async()=>{if(reject)task.reject(Error(value));else task.resolve({ok:true,value});});
  },
  async transition(kind){
   if(kind==='revoke')await act(async()=>{for(const listener of listeners)listener();});
   else if(kind==='remount'){await act(async()=>root.render(null));props={...props,connectionId:'replacement'};await render();}
   else{props={...props,...(kind==='connection'?{connectionId:'replacement'}:{revision:2})};await render();}
  },
  async close(){
   check(pending.length===0,'test left an unresolved bridge request');
   await act(async()=>root.unmount());check(listeners.size===0,'access subscription leaked');container.remove();
  },
 };
}

export async function verifyGitHubToolState(){
 const checks=[];
 for(const kind of ['connection','revision','revoke','remount']){
  for(const phase of ['catalog','result']){
   const f=await fixture();
   try{
    await f.click('读取官方工具目录',true);
    check(f.requests.length===1,'concurrent clicks sent duplicate catalog requests');
    if(phase==='result'){
     await f.settle(catalog('tool'));
     await f.click('确认调用所选工具',true);
     check(f.requests.length===2,'concurrent clicks sent duplicate invocations');
     check(f.requests[1].kind==='github.invoke'&&f.requests[1].id==='original'&&f.requests[1].expectedRevision===1&&f.requests[1].toolName==='tool','invocation intent changed');
    }
    await f.transition(kind);
    // Resolve the OLD request only after React has committed the new identity/access state.
    await f.settle(phase==='catalog'?catalog('stale-private-tool'):result('stale-private-result'));
    check(!f.container.textContent.includes('stale-private'),'late data entered a newer UI state');
    check(!f.container.querySelector('select[name=github-tool]'),'stale tool selection survived invalidation');
    await f.click('读取官方工具目录');await f.settle(catalog('fresh-tool'));
    check(f.container.querySelector('select[name=github-tool]')?.value==='fresh-tool','new catalog cannot replace invalidated data');
    const last=f.requests.at(-1);
    check(last.kind==='github.tools'&&last.id===(kind==='connection'||kind==='remount'?'replacement':'original')&&last.expectedRevision===(kind==='revision'?2:1),'new catalog uses an old connection/revision');
    await f.click('确认调用所选工具');await f.settle(result('fresh-operation'));
    check(f.container.querySelector('[data-tool-result]')?.textContent.includes('fresh-operation'),'fresh result missing');
    check(f.container.querySelector('[data-tool-result] strong')?.textContent==='工具返回错误','isError displayed as business success');
    checks.push(kind+' invalidates late '+phase);
   }finally{await f.close();}
  }
 }
 const f=await fixture();
 try{
  await f.click('读取官方工具目录');await f.transition('revoke');
  const message=f.container.querySelector('[role=status]').textContent;
  await f.settle('stale-private-error',true);
  check(f.container.querySelector('[role=status]').textContent===message,'late rejection overwrote revocation state');
  check(!f.container.textContent.includes('stale-private-error'),'late private error disclosed');
  checks.push('revocation discards late bridge rejection');
 }finally{await f.close();}
 return {checks,remoteMutations:0,fixture:'deferred DesktopBridge; real React component and browser DOM'};
}

globalThis.githubToolsStateResult=verifyGitHubToolState().then(value=>({ok:true,...value}),error=>({ok:false,error:String(error?.stack??error)}));
