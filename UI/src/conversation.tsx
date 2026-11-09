import {useEffect,useRef,useState} from 'react';
import {ConversationFiles} from './conversation-files.js';
import type {ConversationFileReference,DesktopBridge,DesktopConversationInput,ConversationView,AiEntry,ApiConnectionView,ApiModelView,AssociationItem} from './index.js';
export function ConversationPanel({bridge,contextId,initialId,startNew,associations=[]}:{bridge:DesktopBridge;contextId?:string;initialId?:string;startNew?:boolean;associations?:AssociationItem[]}){
 const [conversations,setConversations]=useState<ConversationView[]>([]),[current,setCurrent]=useState<ConversationView>();
 const [agents,setAgents]=useState<AiEntry[]>([]),[agentId,setAgentId]=useState('');
 const [roleId,setRoleId]=useState(''),[positionId,setPositionId]=useState(''),[connectionId,setConnectionId]=useState(''),[modelId,setModelId]=useState('');
 const [connections,setConnections]=useState<ApiConnectionView[]>([]),[models,setModels]=useState<ApiModelView[]>([]);
 const [drafts,setDrafts]=useState<Record<string,string>>({}),[replaces,setReplaces]=useState<string>(),[text,setText]=useState('');
 const [files,setFiles]=useState<Record<string,ConversationFileReference[]>>({});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[stream,setStream]=useState('');
 const currentId=useRef<string|undefined>(undefined),sequence=useRef(0),epoch=useRef(0),running=useRef(false);
 const streaming=useRef<{conversationId:string;known:Set<string>;generationId?:string}|undefined>(undefined);
 useEffect(()=>bridge.onConversationText(event=>{const round=streaming.current;if((event.contextId??undefined)!==contextId||!round||event.conversationId!==round.conversationId||round.known.has(event.generationId))return;if(round.generationId&&round.generationId!==event.generationId)return;round.generationId=event.generationId;setStream(s=>s+event.text);}),[bridge,contextId]);
 useEffect(()=>{const unsubscribe=bridge.onAccessChanged(()=>{epoch.current++;streaming.current=undefined;running.current=false;setBusy(false);sequence.current++;currentId.current=undefined;setCurrent(undefined);setConversations([]);setAgents([]);setConnections([]);setModels([]);setAgentId('');setRoleId('');setPositionId('');setConnectionId('');setModelId('');setFiles({});setStream('');setMessage('授权已变更，请重新读取对话；未发送输入已保留。');});return ()=>{if(streaming.current)void bridge.cancelConversations();epoch.current++;streaming.current=undefined;sequence.current++;currentId.current=undefined;running.current=false;unsubscribe();};},[bridge]);
 async function conversationRequest(input:DesktopConversationInput){return bridge.conversations({...input,...(contextId?{contextId}:{})});}
 function settings(entries:AiEntry[]){return contextId?entries.filter(e=>associations.some(r=>r.owner==='AI'&&r.targetType===e.kind&&r.targetId===e.id)):entries;}
 useEffect(()=>{if(initialId)void run(()=>open(initialId));else if(startNew)void run(async()=>{const r=await call({kind:'create'});if(r.status==='committed'&&r.id)await open(r.id);});},[bridge,contextId,initialId,startNew]);
 async function checked<T,>(request:()=>Promise<T>):Promise<T>{const captured=epoch.current;const reply=await request();if(captured!==epoch.current)throw Error('stale_conversation_request');return reply;}
 async function cancel(){const captured=epoch.current;try{const r=await checked(()=>bridge.cancelConversations());setMessage(r.ok?'已请求停止本轮等待；以轮次状态为准。':r.error);}catch{if(captured===epoch.current)setMessage('停止请求不可用，请核对轮次状态。');}}
 async function call(input:DesktopConversationInput){
  const r=await checked(()=>conversationRequest(input));if(!r.ok)throw Error(r.error);
  if(r.value.status!=='ok'&&r.value.status!=='committed')throw Error(r.value.status==='unknown'?'结果未知，请核对原 Operation，勿重复发送。'+(r.value.id?' 已创建会话 '+r.value.id:'')+(r.value.intent?'；关联 intent '+r.value.intent:''):r.value.status+('reason'in r.value?'：'+r.value.reason:''));
  return r.value;
 }
 async function run(work:()=>Promise<void>){if(running.current)return;const captured=epoch.current;running.current=true;setBusy(true);setMessage('');try{await work();}catch(e){if(captured===epoch.current){setCurrent(undefined);setConversations([]);setStream('');setMessage(e instanceof Error?e.message:'对话不可用');}}finally{if(captured===epoch.current){running.current=false;setBusy(false);}}}
 async function open(id:string,restoredText?:string){const n=++sequence.current;streaming.current=undefined;currentId.current=id;setCurrent(undefined);setStream('');setReplaces(undefined);const r=await call({kind:'open',id});if(n===sequence.current&&r.status==='ok'&&'conversation'in r){setCurrent(r.conversation);setText(restoredText??drafts[id]??'');}}
 const key=current?.id??currentId.current??'new';
 return <div data-conversations><h2>{contextId?'Context 对话':'普通对话'}</h2>{contextId&&<small>Context {contextId}</small>}<p role="status">{message}</p>
 <div className="actions"><button disabled={busy} onClick={()=>void run(async()=>{const r=await call({kind:'snapshot'});if(r.status==='ok'&&'conversations'in r)setConversations(r.conversations);})}>{contextId?'读取关联会话':'读取对话历史'}</button>
 <button disabled={busy} onClick={()=>void run(async()=>{const r=await call({kind:'create'});if(r.status==='committed'&&r.id)await open(r.id);})}>{contextId?'新建 Context 会话':'新建普通对话'}</button>
 <button disabled={busy} onClick={()=>void run(async()=>{const r=await checked(()=>bridge.ai({kind:'snapshot'}));if(!r.ok||r.value.status!=='ok')throw Error('Agent 列表不可用');setAgents(settings(r.value.entries));})}>读取可用 Agent</button>
 <button disabled={busy} onClick={()=>void run(async()=>{const r=await checked(()=>bridge.ai({kind:'snapshot'}));if(!r.ok||r.value.status!=='ok')throw Error('设定列表不可用');setAgents(settings(r.value.entries));})}>读取角色与岗位</button>
 <button disabled={busy} onClick={()=>void run(async()=>{const r=await checked(()=>bridge.api({kind:'snapshot'}));if(!r.ok||r.value.status!=='ok'||r.value.view!=='connections')throw Error('连接列表不可用');setConnections(r.value.connections);setModels([]);setConnectionId('');setModelId('');})}>读取模型连接</button></div>
 <nav aria-label="普通对话历史">{conversations.map(c=><button key={c.id} disabled={busy} onClick={()=>void run(()=>open(c.id))}>{c.messages[0]?.segments[0]?.text.slice(0,40)??'空对话'}<small>{c.id}</small></button>)}</nav>
 <label>本轮 Agent<select disabled={busy} value={agentId} onChange={e=>{setAgentId(e.target.value);setRoleId('');setPositionId('');}}><option value="">请选择已配置 Agent</option>{agents.filter(a=>a.kind==='agent').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
 <label>本轮角色<select disabled={busy} value={roleId} onChange={e=>{setRoleId(e.target.value);setAgentId('');}}><option value="">不选角色</option>{agents.filter(a=>a.kind==='role').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
 <label>本轮岗位<select disabled={busy} value={positionId} onChange={e=>{setPositionId(e.target.value);setAgentId('');}}><option value="">不选岗位</option>{agents.filter(a=>a.kind==='position').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
 {agentId&&<p>旧 Agent 使用其已绑定模型；直接选择角色或岗位可独立选择模型。</p>}
 <label>模型连接<select disabled={busy||!!agentId} value={connectionId} onChange={e=>{setConnectionId(e.target.value);setModelId('');setModels([]);}}><option value="">显式选择连接</option>{connections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <button disabled={busy||!!agentId||!connectionId} onClick={()=>void run(async()=>{const r=await checked(()=>bridge.api({kind:'models',connectionId}));if(!r.ok||r.value.status!=='ok'||r.value.view!=='models')throw Error('模型列表不可用');setModels(r.value.models);})}>读取连接模型</button>
 <label>本轮模型<select disabled={busy||!!agentId} value={modelId} onChange={e=>setModelId(e.target.value)}><option value="">显式选择模型</option>{models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
 {current&&<><small>对话 {current.id} · 修订 {current.revision}</small><div aria-live="polite">
 {current.messages.map(m=><article key={m.id}><strong>{m.role==='user'?'你':'AI'}</strong>{m.replaces&&<small>修改重发自 {m.replaces}</small>}{m.segments.map(s=><div key={s.id}>{s.source&&<small>文件来源 {s.source.contextId} / {s.source.addressId} · {s.source.mime} · 版本 {s.source.version}（引用不是当前读取授权）</small>}<p style={{whiteSpace:'pre-wrap'}}>{s.text}</p><button disabled={busy} aria-pressed={current.selections?.some(selection=>selection.messageId===m.id&&selection.segmentIds.includes(s.id))??false} onClick={()=>void run(async()=>{const selected=current.selections?.find(selection=>selection.messageId===m.id)?.segmentIds??[];await call({kind:'select',id:current.id,expectedRevision:current.revision,messageId:m.id,segmentIds:selected.includes(s.id)?selected.filter(id=>id!==s.id):[...selected,s.id]});await open(current.id);})}>{current.selections?.some(selection=>selection.messageId===m.id&&selection.segmentIds.includes(s.id))?'取消选择此段':'选择此段'}</button><button disabled={busy} onClick={()=>void run(async()=>{await call({kind:'select',id:current.id,expectedRevision:current.revision,messageId:m.id,segmentIds:[s.id]});await open(current.id);const quoted=text+(text?'\n':'')+'> '+s.text;setText(quoted);setDrafts(d=>({...d,[key]:quoted}));})}>引用此段</button></div>)}
 {m.role==='user'&&<button disabled={busy} onClick={()=>{setReplaces(m.id);setText(m.segments.filter(s=>!s.source).map(s=>s.text).join('\n'));setFiles(d=>({...d,[current.id]:m.segments.flatMap(s=>s.source?[s.source]:[])}));}}>编辑并重发</button>}</article>)}
 {current.generations.map(g=><p key={g.id}>轮次：{g.status}{g.operationId&&<small>Operation {g.operationId}</small>}{['running','unknown'].includes(g.status)&&<button disabled={busy} onClick={()=>void run(async()=>{await call({kind:'recover',id:current.id,generationId:g.id});await open(current.id);})}>核对原结果</button>}</p>)}
 {stream&&<article aria-label="生成中"><strong>生成中（未定稿）</strong><p style={{whiteSpace:'pre-wrap'}}>{stream}</p></article>}</div></>}
 <form aria-label="普通对话输入" onSubmit={e=>{e.preventDefault();if(!current)return;const id=current.id,input=text,n=sequence.current,captured=epoch.current;setStream('');void run(async()=>{
  streaming.current={conversationId:id,known:new Set(current.generations.map(g=>g.id))};
  let result;
  try{const reply=await checked(()=>conversationRequest({kind:replaces?'resend':'send',id,expectedRevision:current.revision,...(agentId?{agentId}:{selection:{...(roleId?{roleId}:{}),...(positionId?{positionId}:{}),connectionId,modelId}}),text:input,...(replaces?{replaces}:{}),...(files[id]?.length?{attachments:files[id]}:{})}));if(!reply.ok)throw Error(reply.error);result=reply.value;}finally{if(captured===epoch.current){streaming.current=undefined;setStream('');}}
  if(n===sequence.current){
   if(result.status==='committed'){setFiles(d=>({...d,[id]:[]}));setDrafts(d=>({...d,[id]:''}));setText('');setReplaces(undefined);await open(id,'');}
   else{await open(id,input);setMessage(result.status==='unknown'?'结果未知，请核对原 Operation，勿重复发送。'+('operationId'in result?result.operationId??'':''):result.status);}
  }
 });}}>
 {replaces&&<p>正在修改历史输入。<button type="button" onClick={()=>setReplaces(undefined)}>返回普通发送</button></p>}
 {current&&<><ConversationFiles key={current.id} bridge={bridge} disabled={busy} onAdd={source=>setFiles(d=>({...d,[current.id]:[...(d[current.id]??[]).filter(s=>s.contextId!==source.contextId||s.addressId!==source.addressId),source].slice(-8)}))}/>{(files[current.id]??[]).map((source,index)=><p key={source.contextId+source.addressId}>本轮文件引用 {source.contextId} / {source.addressId}<button type="button" disabled={busy} onClick={()=>setFiles(d=>({...d,[current.id]:d[current.id]!.filter((_,i)=>i!==index)}))}>移除此文件引用</button></p>)}</>}
 <label>输入<textarea required maxLength={32000} disabled={busy} value={text} onChange={e=>{setText(e.target.value);setDrafts(d=>({...d,[key]:e.target.value}));}}/></label>
 <button type="submit" disabled={busy||!current||(!agentId&&(!(roleId||positionId)||!connectionId||!modelId))}>发送</button>
 <button type="button" disabled={busy||!current||!text.trim()||!!replaces} onClick={()=>{if(!current)return;const id=current.id,input=text;void run(async()=>{await call({kind:'append',id,expectedRevision:current.revision,text:input,...(files[id]?.length?{attachments:files[id]}:{})});setFiles(d=>({...d,[id]:[]}));setDrafts(d=>({...d,[id]:''}));await open(id,'');setMessage('已追加到历史，未发起生成。');});}}>仅追加到历史</button>
 {busy&&<button type="button" onClick={()=>void cancel()}>停止本轮等待</button>}</form></div>;
}
