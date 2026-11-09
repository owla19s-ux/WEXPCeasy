import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {ConversationFiles} from '../../../dist/UI/src/conversation-files.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const check=(v,m)=>{if(!v)throw Error(m);};
async function fixture(){
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container),pending=[],listeners=new Set(),added=[];
 const bridge={onAccessChanged(fn){listeners.add(fn);return ()=>listeners.delete(fn);},space(input){return new Promise(resolve=>pending.push({input,resolve}));}};
 await act(async()=>root.render(React.createElement(ConversationFiles,{bridge,disabled:false,onAdd:source=>added.push(source)})));
 return {container,pending,added,
 async click(label){const b=[...container.querySelectorAll('button')].find(b=>b.textContent===label);check(b&&!b.disabled&&!b.closest('fieldset')?.disabled,'unavailable '+label);await act(async()=>b.click());},
 async choose(index,value){await act(async()=>{const s=container.querySelectorAll('select')[index];s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}));});},
 async settle(value){const p=pending.shift();check(p,'missing request');await act(async()=>p.resolve({ok:true,value}));},
 async revoke(){await act(async()=>{for(const fn of listeners)fn();});},
 async close(){await act(async()=>root.unmount());check(listeners.size===0,'subscription leak');container.remove();}
 };
}
async function verify(){const checks=[];
 for(const scenario of ['reference','cancelled','revoked','unmount']){
  const f=await fixture();try{
   await f.click('读取附件来源');await f.settle({status:'ok',view:'snapshot',contexts:[{id:'context',name:'Source',status:'available'}]});await f.choose(0,'context');
   await f.click('读取来源文件引用');await f.settle({status:'ok',view:'context',resources:[{id:'file',name:'File',address:'file:///source.txt'},{id:'remote',name:'Remote',address:'https://example.test'}]});check(!f.container.textContent.includes('Remote'),'remote file admitted');await f.choose(1,'file');await f.click('授权读取附件预览');
   check(f.pending[0].input.kind==='resource.read'&&f.pending[0].input.contextId==='context'&&!('path'in f.pending[0].input),'preview bypassed public Local read');
   if(scenario==='revoked')await f.revoke();if(scenario==='unmount')await f.close();
   await f.settle(scenario==='cancelled'?{status:'cancelled'}:{status:'ok',view:'file',contextId:'context',addressId:'file',version:'a'.repeat(64),content:'PRIVATE BODY'});
   if(scenario==='reference'){
    check(f.container.querySelector('[aria-label="附件预览"]').textContent==='PRIVATE BODY','authorized preview missing');await f.click('加入本轮文件引用');check(f.added.length===1&&f.added[0].version==='a'.repeat(64),'source version lost');check(!JSON.stringify(f.added).includes('PRIVATE BODY'),'file content auto-imported');check(!f.container.querySelector('[aria-label="附件预览"]'),'preview content retained after adding');
   }else{check(f.added.length===0,'cancel/revocation added source');check(!f.container.textContent.includes('PRIVATE BODY'),'late or cancelled preview disclosed content');}
   checks.push(scenario);
  }finally{if(f.container.isConnected)await f.close();}
 }return {ok:true,checks,fixture:'deferred authorized Local bridge; real React and Electron DOM',remoteMutations:0};}
globalThis.conversationFilesStateResult=verify().catch(error=>({ok:false,error:String(error.stack??error)}));
