import {useEffect,useRef,useState} from 'react';
import type {DesktopBridge,DesktopConversationInput,ConversationView,AiEntry} from './index.js';
export function ConversationPanel({bridge}:{bridge:DesktopBridge}){
 const [conversations,setConversations]=useState<ConversationView[]>([]),[current,setCurrent]=useState<ConversationView>();
 const [agents,setAgents]=useState<AiEntry[]>([]),[agentId,setAgentId]=useState('');
 const [drafts,setDrafts]=useState<Record<string,string>>({}),[replaces,setReplaces]=useState<string>(),[text,setText]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[stream,setStream]=useState('');
 const currentId=useRef<string|undefined>(undefined),sequence=useRef(0),epoch=useRef(0),running=useRef(false);
 useEffect(()=>bridge.onConversationText(event=>{if(event.conversationId===currentId.current)setStream(s=>s+event.text);}),[bridge]);
 useEffect(()=>{const unsubscribe=bridge.onAccessChanged(()=>{epoch.current++;running.current=false;setBusy(false);sequence.current++;currentId.current=undefined;setCurrent(undefined);setConversations([]);setAgents([]);setStream('');setMessage('授权已变更，请重新读取对话；未发送输入已保留。');});return ()=>{epoch.current++;sequence.current++;currentId.current=undefined;running.current=false;unsubscribe();};},[bridge]);
 async function checked<T,>(request:()=>Promise<T>):Promise<T>{const captured=epoch.current;const reply=await request();if(captured!==epoch.current)throw Error('stale_conversation_request');return reply;}
 async function cancel(){const captured=epoch.current;try{const r=await checked(()=>bridge.cancelConversations());setMessage(r.ok?'已请求停止本轮等待；以轮次状态为准。':r.error);}catch{if(captured===epoch.current)setMessage('停止请求不可用，请核对轮次状态。');}}
 async function call(input:DesktopConversationInput){
  const r=await checked(()=>bridge.conversations(input));if(!r.ok)throw Error(r.error);
  if(r.value.status!=='ok'&&r.value.status!=='committed')throw Error(r.value.status==='unknown'?'结果未知，请核对原 Operation，勿重复发送。':r.value.status);
  return r.value;
 }
 async function run(work:()=>Promise<void>){if(running.current)return;const captured=epoch.current;running.current=true;setBusy(true);setMessage('');try{await work();}catch(e){if(captured===epoch.current){setCurrent(undefined);setConversations([]);setStream('');setMessage(e instanceof Error?e.message:'对话不可用');}}finally{if(captured===epoch.current){running.current=false;setBusy(false);}}}
 async function open(id:string,restoredText?:string){const n=++sequence.current;currentId.current=id;setCurrent(undefined);setStream('');setReplaces(undefined);const r=await call({kind:'open',id});if(n===sequence.current&&r.status==='ok'&&'conversation'in r){setCurrent(r.conversation);setText(restoredText??drafts[id]??'');}}
 const key=current?.id??currentId.current??'new';
 return <div data-conversations><h2>普通对话</h2><p role="status">{message}</p>
 <div className="actions"><button disabled={busy} onClick={()=>void run(async()=>{const r=await call({kind:'snapshot'});if(r.status==='ok'&&'conversations'in r)setConversations(r.conversations);})}>读取对话历史</button>
 <button disabled={busy} onClick={()=>void run(async()=>{const r=await call({kind:'create'});if(r.status==='committed'&&r.id)await open(r.id);})}>新建普通对话</button>
 <button disabled={busy} onClick={()=>void run(async()=>{const r=await checked(()=>bridge.ai({kind:'snapshot'}));if(!r.ok||r.value.status!=='ok')throw Error('Agent 列表不可用');setAgents(r.value.entries.filter(v=>v.kind==='agent'));})}>读取可用 Agent</button></div>
 <nav aria-label="普通对话历史">{conversations.map(c=><button key={c.id} disabled={busy} onClick={()=>void run(()=>open(c.id))}>{c.messages[0]?.segments[0]?.text.slice(0,40)??'空对话'}<small>{c.id}</small></button>)}</nav>
 <label>本轮 Agent<select disabled={busy} value={agentId} onChange={e=>setAgentId(e.target.value)}><option value="">请选择已配置 Agent</option>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
 {current&&<><small>对话 {current.id} · 修订 {current.revision}</small><div aria-live="polite">
 {current.messages.map(m=><article key={m.id}><strong>{m.role==='user'?'你':'AI'}</strong>{m.replaces&&<small>修改重发自 {m.replaces}</small>}{m.segments.map(s=><div key={s.id}><p style={{whiteSpace:'pre-wrap'}}>{s.text}</p><button disabled={busy} onClick={()=>void run(async()=>{await call({kind:'select',id:current.id,expectedRevision:current.revision,messageId:m.id,segmentIds:[s.id]});await open(current.id);const quoted=text+(text?'\n':'')+'> '+s.text;setText(quoted);setDrafts(d=>({...d,[key]:quoted}));})}>引用此段</button></div>)}
 {m.role==='user'&&<button disabled={busy} onClick={()=>{setReplaces(m.id);setText(m.segments.map(s=>s.text).join('\n'));}}>编辑并重发</button>}</article>)}
 {current.generations.map(g=><p key={g.id}>轮次：{g.status}{g.operationId&&<small>Operation {g.operationId}</small>}{['running','unknown'].includes(g.status)&&<button disabled={busy} onClick={()=>void run(async()=>{await call({kind:'recover',id:current.id,generationId:g.id});await open(current.id);})}>核对原结果</button>}</p>)}
 {stream&&<article aria-label="生成中"><strong>生成中（未定稿）</strong><p style={{whiteSpace:'pre-wrap'}}>{stream}</p></article>}</div></>}
 <form aria-label="普通对话输入" onSubmit={e=>{e.preventDefault();if(!current)return;const id=current.id,input=text,n=sequence.current;setStream('');void run(async()=>{
  await call({kind:replaces?'resend':'send',id,expectedRevision:current.revision,agentId,text:input,...(replaces?{replaces}:{})});
  if(n===sequence.current){setDrafts(d=>({...d,[id]:''}));setText('');setReplaces(undefined);await open(id,'');}
 });}}>
 {replaces&&<p>正在修改历史输入。<button type="button" onClick={()=>setReplaces(undefined)}>返回普通发送</button></p>}
 <label>输入<textarea required maxLength={32000} disabled={busy} value={text} onChange={e=>{setText(e.target.value);setDrafts(d=>({...d,[key]:e.target.value}));}}/></label>
 <button type="submit" disabled={busy||!current||!agentId}>发送</button>
 {busy&&<button type="button" onClick={()=>void cancel()}>停止本轮等待</button>}</form></div>;
}
