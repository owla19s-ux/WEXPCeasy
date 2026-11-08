import {useEffect,useRef,useState} from 'react';
import type {DesktopBridge,DesktopGitHubTool,DesktopConnectionsReply,ApiJson} from './index.js';
export function parseGitHubToolArguments(text:string):Record<string,ApiJson>{
 if(new TextEncoder().encode(text).length>1024*1024)throw Error('参数超过允许大小');
 const value:unknown=JSON.parse(text);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('参数必须是 JSON 对象');
 function check(v:unknown):void{
  if(typeof v==='number'&&!Number.isFinite(v))throw Error('参数中的数值无效');
  if(v&&typeof v==='object')for(const child of Object.values(v))check(child);
 }
 check(value);return value as Record<string,ApiJson>;
}
export function GitHubTools({bridge,connectionId,revision,enabled,runtimeConfigured}:{
 bridge:Pick<DesktopBridge,'connections'|'onAccessChanged'>;connectionId:string;revision:number;enabled:boolean;runtimeConfigured:boolean;
}){
 const [tools,setTools]=useState<DesktopGitHubTool[]>([]),[selected,setSelected]=useState(''),[args,setArgs]=useState('{}');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState<Extract<DesktopConnectionsReply,{status:'tool-result'}>>();
 const epoch=useRef(0),running=useRef(false),live=useRef(true);
 useEffect(()=>{
  live.current=true;epoch.current++;setTools([]);setSelected('');setArgs('{}');setResult(undefined);setMessage('');
  const off=bridge.onAccessChanged(()=>{epoch.current++;setTools([]);setSelected('');setResult(undefined);setMessage('授权已变更，请重新读取工具目录。');});
  return ()=>{live.current=false;epoch.current++;off();};
 },[bridge,connectionId,revision]);
 const chosen=tools.find(t=>t.name===selected);
 async function run(work:(sequence:number)=>Promise<void>){
  if(running.current)return;running.current=true;setBusy(true);setMessage('');const sequence=epoch.current;
  try{await work(sequence);}catch(error){if(live.current&&epoch.current===sequence)setMessage(error instanceof Error?error.message:'工具不可用');}
  finally{running.current=false;if(live.current)setBusy(false);}
 }
 async function call(input:Parameters<DesktopBridge['connections']>[0]){
  const reply=await bridge.connections(input);if(!reply.ok)throw Error(reply.error);return reply.value;
 }
 function report(reply:DesktopConnectionsReply){
  if(reply.status==='unknown')return '结果未知，请先核对原 Operation 和远端状态。'+(reply.operationId?' Operation '+reply.operationId:'');
  if(reply.status==='cancelled')return '已取消';
  return reply.status+('reason'in reply?': '+reply.reason:'');
 }
 const failed=result?.result&&typeof result.result==='object'&&!Array.isArray(result.result)&&result.result.isError===true;
 return <section data-github-tools aria-label="GitHub 官方工具"><h4>GitHub 官方工具</h4>
 {!runtimeConfigured&&<p>此宿主尚未装配 GitHub MCP 运行时，工具调用不可用。</p>}
 <button disabled={busy||!enabled||!runtimeConfigured} onClick={()=>void run(async sequence=>{
  setResult(undefined);const reply=await call({kind:'github.tools',id:connectionId,expectedRevision:revision});
  if(!live.current||epoch.current!==sequence)return;
  if(reply.status==='tools'){setTools(reply.tools);setSelected(reply.tools[0]?.name??'');setMessage('已发现 '+reply.tools.length+' 个官方工具。');}
  else{setTools([]);setSelected('');setMessage(report(reply));}
 })}>读取官方工具目录</button><p role="status">{message}</p>
 {tools.length>0&&<><label>选择工具<select name="github-tool" disabled={busy} value={selected} onChange={e=>{setSelected(e.target.value);setArgs('{}');setResult(undefined);}}>
 {tools.map(tool=><option key={tool.name} value={tool.name}>{tool.name}</option>)}</select></label>
 {chosen&&<><p>{chosen.description}</p><details><summary>参数说明</summary><pre>{JSON.stringify(chosen.inputSchema,null,2)}</pre></details></>}
 <label>工具参数（JSON 对象）<textarea name="github-tool-arguments" disabled={busy} spellCheck={false} value={args} onChange={e=>{setArgs(e.target.value);setResult(undefined);}}/></label>
 <button disabled={busy||!chosen||!enabled} onClick={()=>void run(async sequence=>{
  const argumentsValue=parseGitHubToolArguments(args);setResult(undefined);
  const reply=await call({kind:'github.invoke',id:connectionId,expectedRevision:revision,toolName:selected,arguments:argumentsValue});
  if(!live.current||epoch.current!==sequence)return;
  if(reply.status==='tool-result')setResult(reply);else setMessage(report(reply));
 })}>确认调用所选工具</button><p>工具可能修改远端资源；每次调用都需要原生确认，不会自动重发。</p></>}
 {result&&<article data-tool-result><strong>{failed?'工具返回错误':'已收到工具结果'}</strong><p>Operation {result.operationId}</p><pre>{JSON.stringify(result.result,null,2)}</pre></article>}
 </section>;
}
