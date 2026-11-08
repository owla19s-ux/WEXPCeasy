import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {ConversationPanel} from '../../../dist/UI/src/conversation.js';
import {SpacePanel} from '../../../dist/UI/src/space.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const check=(condition,message)=>{if(!condition)throw Error(message);};
const cases=[
 {name:'conversation history',Component:ConversationPanel,label:'读取对话历史',value:marker=>({status:'ok',conversations:[{id:marker,revision:1,messages:[],generations:[]}]})},
 {name:'conversation Agent list',Component:ConversationPanel,label:'读取可用 Agent',value:marker=>({status:'ok',entries:[{id:marker,name:marker,kind:'agent'}]})},
 {name:'Space snapshot',Component:SpacePanel,label:'打开工作区',value:marker=>({status:'ok',view:'snapshot',complete:true,categories:[{id:marker,name:marker}],spaces:[],groups:[],organizations:[],contexts:[]})}
];
async function verify(){
 const checks=[],failures=[];
 for(const scenario of cases)for(const reject of [false,true]){
  const container=document.createElement('div');document.body.append(container);
  const root=createRoot(container),listeners=new Set(),pending=[];
  const request=()=>new Promise((resolve,reject)=>pending.push({resolve,reject}));
  const bridge={onAccessChanged(fn){listeners.add(fn);return ()=>listeners.delete(fn);},onConversationText(){return ()=>{};},conversations:request,ai:request,space:request};
  const click=async()=>{const b=[...container.querySelectorAll('button')].find(b=>b.textContent===scenario.label);check(b&&!b.disabled,'read unavailable');await act(async()=>b.click());};
  try{
   await act(async()=>root.render(React.createElement(scenario.Component,{bridge})));
   await click();await act(async()=>{for(const fn of listeners)fn();});
   const status=container.querySelector('[role=status]').textContent;
   await act(async()=>{const p=pending.shift();if(reject)p.reject(Error('stale-private-error'));else p.resolve({ok:true,value:scenario.value('stale-private-data')});});
   check(!container.textContent.includes('stale-private'),'late '+scenario.name+' disclosed revoked data/error');
   check(container.querySelector('[role=status]').textContent===status,'late '+scenario.name+' replaced revocation notice');
   await click();await act(async()=>pending.shift().resolve({ok:true,value:scenario.value('fresh-data')}));
   check(container.textContent.includes('fresh-data'),'fresh '+scenario.name+' unavailable');
   checks.push(scenario.name+' invalidates late '+(reject?'error':'data'));
  }catch(error){failures.push(String(error));}
  finally{await act(async()=>root.unmount());check(listeners.size===0,'subscription leak');container.remove();}
 }
 if(failures.length)throw Error(failures.join('\n'));
 return {ok:true,checks,fixture:'deferred DesktopBridge; real React and browser DOM',remoteMutations:0};
}
globalThis.workspaceAccessStateResult=verify().catch(error=>({ok:false,error:String(error.stack??error)}));
