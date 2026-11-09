import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {ConversationPanel} from '../../../dist/UI/src/conversation.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const check=(value,message)=>{if(!value)throw Error(message);};
const conversation=(status='completed')=>({id:'chat',revision:5,messages:[{id:'user',role:'user',segments:[{id:'text',text:'original'}]}],generations:[{id:'old',inputMessageId:'user',status,operationId:'operation-old'}]});
async function fixture(props={}){
 const container=document.createElement('div');document.body.append(container);
 const root=createRoot(container),access=new Set(),texts=new Set(),pending=[];
 let cancellations=0;
 const bridge={cancelConversations:async()=>{cancellations++;return {ok:true,value:{status:'committed',revision:6}};},onAccessChanged(fn){access.add(fn);return ()=>access.delete(fn);},onConversationText(fn){texts.add(fn);return ()=>texts.delete(fn);},conversations(input){return new Promise(resolve=>pending.push({input,resolve}));},ai:async()=>({ok:true,value:{status:'ok',entries:[{id:'agent',kind:'agent',name:'Agent'},{id:'role',kind:'role',name:'Role'},{id:'position',kind:'position',name:'Position'}]}}),api:async input=>({ok:true,value:input.kind==='snapshot'?{status:'ok',view:'connections',connections:[{id:'connection',name:'Connection'}]}:{status:'ok',view:'models',models:[{id:'model',name:'Model',connectionId:'connection'}]}})};
 await act(async()=>root.render(React.createElement(ConversationPanel,{bridge,...props})));
 const f={container,pending,
  async select(label,value){const input=[...container.querySelectorAll('label')].find(l=>l.textContent.startsWith(label))?.querySelector('select');check(input,'missing '+label);await act(async()=>{input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));});},
  async submit(){await act(async()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));},
  async click(label){const b=[...container.querySelectorAll('button')].find(b=>b.textContent===label);check(b&&!b.disabled,'unavailable: '+label);await act(async()=>b.click());},
  async settle(value){const p=pending.shift();check(p,'missing request');await act(async()=>p.resolve({ok:true,value}));},
  async delta(generationId,text,contextId){await act(async()=>{for(const fn of texts)fn({conversationId:'chat',generationId,text,...(contextId?{contextId}:{})});});},
  async input(text){await act(async()=>{const input=container.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));});},
  async revoke(){await act(async()=>{for(const fn of access)fn();});},
  async send(){await f.click('读取可用 Agent');const select=container.querySelector('select');await act(async()=>{select.value='agent';select.dispatchEvent(new Event('change',{bubbles:true}));});await act(async()=>{const input=container.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'draft');input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));},
  async close(){const active=pending[0]?.input.kind==='send';await act(async()=>root.unmount());if(active)check(cancellations>0,'unmounted stream was not cancelled');check(access.size===0&&texts.size===0,'subscription leak');container.remove();}
 };
 await f.click(props.contextId?'新建 Context 会话':'新建普通对话');await f.settle({status:'committed',id:'chat',revision:1});await f.settle({status:'ok',conversation:conversation()});return f;
}
async function verify(){
 const checks=[];
 for(const scenario of ['idle','old-round','unknown','revoked','unmount','append','selection']){
  const f=await fixture();
  try{
   if(scenario==='idle'){await f.delta('old','LATE-PRIVATE');check(!f.container.textContent.includes('LATE-PRIVATE'),'idle panel accepted a completed round delta');}
   else if(scenario==='selection'){
    await f.click('选择此段');check(f.pending[0]?.input.kind==='select'&&f.pending[0].input.segmentIds[0]==='text','segment selection missing');await f.settle({status:'committed',revision:6});await f.settle({status:'ok',conversation:{...conversation(),revision:6,selections:[{messageId:'user',segmentIds:['text']}]}});check(f.container.querySelector('button[aria-pressed=true]')?.textContent==='取消选择此段','selection not visible');await f.click('取消选择此段');check(f.pending[0].input.segmentIds.length===0,'selection cannot be cleared');await f.settle({status:'committed',revision:7});await f.settle({status:'ok',conversation:conversation()});
   }else if(scenario==='append'){
    await f.input('append only');await f.click('仅追加到历史');check(f.pending[0]?.input.kind==='append'&&f.pending[0].input.text==='append only','append UI did not call its public entry');await f.settle({status:'committed',revision:6});await f.settle({status:'ok',conversation:conversation()});check(f.container.querySelector('textarea').value==='','append did not clear committed draft');
   }else{
    await f.send();check(f.pending[0]?.input.kind==='send','send missing');
    if(scenario==='old-round'){
     await f.delta('old','LATE-PRIVATE');await f.delta('new','fresh');await f.delta('another','WRONG-ROUND');
     check(!f.container.textContent.includes('LATE-PRIVATE')&&!f.container.textContent.includes('WRONG-ROUND'),'old or mixed round accepted');check(f.container.textContent.includes('fresh'),'current stream missing');
    }
    if(scenario==='revoked'){await f.revoke();const status=f.container.querySelector('[role=status]').textContent;await f.delta('new','LATE-PRIVATE');await f.settle({status:'committed',revision:6});check(!f.container.textContent.includes('LATE-PRIVATE'),'revoked stream disclosed text');check(f.pending.length===0,'revoked send started a read');check(f.container.querySelector('[role=status]').textContent===status,'revoked notice overwritten');check(f.container.querySelector('textarea').value==='draft','revocation lost draft');checks.push(scenario);continue;}
    if(scenario==='unmount'){
     // The bridge notifies subscribers through the actual component lifecycle in the other cases;
     // unmount also must reject late deltas and replies without launching another read.
     await f.close();await f.delta('new','LATE-PRIVATE');await f.settle({status:'committed',revision:6});check(f.pending.length===0,'unmounted request launched a read');checks.push(scenario);continue;
    }
    await f.settle(scenario==='unknown'?{status:'unknown',operationId:'operation-new'}:{status:'committed',revision:6});
    check(f.pending[0]?.input.kind==='open','send outcome did not reload authoritative round for recovery');
    await f.settle({status:'ok',conversation:conversation(scenario==='unknown'?'unknown':'completed')});
    if(scenario==='unknown'){check([...f.container.querySelectorAll('button')].some(b=>b.textContent==='核对原结果'),'unknown recovery inaccessible');check(f.container.querySelector('textarea').value==='draft','unknown discarded draft');check(f.container.textContent.includes('operation-new'),'unknown operation identity hidden');}
    await f.delta('new','AFTER-SETTLEMENT');check(!f.container.textContent.includes('AFTER-SETTLEMENT'),'settled stream still accepting deltas');
   }
   checks.push(scenario);
  }finally{if(f.container.isConnected)await f.close();}
 }
 for(const scenario of ['direct-role','direct-position','context-isolation']){
  const scoped=scenario==='context-isolation';
  const f=await fixture(scoped?{contextId:'context-a',associations:[{owner:'AI',targetType:'role',targetId:'role'}]}:{});
  try{
   await f.click('读取角色与岗位');await f.select(scenario==='direct-position'?'本轮岗位':'本轮角色',scenario==='direct-position'?'position':'role');
   await f.click('读取模型连接');await f.select('模型连接','connection');await f.click('读取连接模型');await f.select('本轮模型','model');await f.input('direct draft');await f.submit();
   const input=f.pending[0]?.input;check(input?.kind==='send'&&!input.agentId&&input.selection.modelId==='model','direct model selection missing');
   check(input.selection[scenario==='direct-position'?'positionId':'roleId']===(scenario==='direct-position'?'position':'role'),'setting missing');
   if(scoped){
    check(input.contextId==='context-a','Context scope missing');
    await f.delta('new','WRONG-CONTEXT','context-b');await f.delta('new','NO-CONTEXT');check(!f.container.textContent.includes('WRONG-CONTEXT')&&!f.container.textContent.includes('NO-CONTEXT'),'foreign context stream leaked');
    await f.delta('new','scoped reply','context-a');check(f.container.textContent.includes('scoped reply'),'current Context stream missing');
   }
   await f.settle({status:'committed',revision:6});check(f.pending[0].input.contextId===(scoped?'context-a':undefined),'reload lost scope');await f.settle({status:'ok',conversation:conversation()});checks.push(scenario);
  }finally{await f.close();}
 }
 return {ok:true,checks,fixture:'deferred DesktopBridge; real React and Electron DOM',remoteMutations:0};
}
globalThis.conversationStateResult=verify().catch(error=>({ok:false,error:String(error.stack??error)}));
