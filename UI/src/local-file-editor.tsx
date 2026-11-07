import {useEffect,useRef,useState} from 'react';
import type {DesktopBridge,DesktopSpaceReply} from './index.js';
type FileView=Extract<DesktopSpaceReply,{view:'file'}>;
export type LocalDrafts=Map<string,{text:string;version:string}>;
export function LocalFileEditor({file,bridge,drafts,onRead}:{file:FileView;bridge:DesktopBridge;drafts:LocalDrafts;onRead:(file:FileView)=>void}){
 const key=file.contextId+':'+file.addressId,savedDraft=drafts.get(key);
 const [text,setText]=useState(savedDraft?.text??file.content),[busy,setBusy]=useState(false),[message,setMessage]=useState(savedDraft&&savedDraft.version!==file.version?'磁盘版本已变更，保留了未保存草稿；请比较当前磁盘内容。':''),[needsRead,setNeedsRead]=useState(false);
 const alive=useRef(true),running=useRef(false),version=useRef(file.version);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(version.current!==file.version){version.current=file.version;setNeedsRead(false);setMessage('已重新读取磁盘版本；未保存草稿仍保留，请比较内容。');}
 },[file.version]);
 async function run(work:()=>Promise<void>){
  if(running.current)return;running.current=true;setBusy(true);setMessage('');
  try{await work();}catch{if(alive.current)setMessage('文件操作不可用；草稿已保留，请核对原 Operation。');}
  finally{running.current=false;if(alive.current)setBusy(false);}
 }
 async function read(){
  const r=await bridge.space({kind:'resource.read',contextId:file.contextId,id:file.addressId,mode:'file'});
  if(!alive.current)return;
  if(r.ok&&r.value.status==='ok'&&r.value.view==='file'){
   onRead(r.value);setNeedsRead(false);
   if(!drafts.has(key))setText(r.value.content);
   setMessage('已重新读取磁盘内容；保存前请比较版本与草稿。');
  }else setMessage(r.ok?'读取'+r.value.status+('reason'in r.value?'：'+r.value.reason:''):r.error);
 }
 async function save(){
  if(!file.editToken)return;
  const r=await bridge.space({kind:'resource.save',contextId:file.contextId,id:file.addressId,editToken:file.editToken,content:text});
  if(!alive.current)return;
  if(!r.ok){setMessage(r.error);return;}
  const value=r.value;
  if(value.status==='saved'){drafts.delete(key);setNeedsRead(true);setMessage('已保存 · 版本 '+value.version+' · Operation '+value.operationId+'。继续编辑前请重新读取。');return;}
  if(value.status==='cancelled'){setMessage('保存已取消；草稿已保留。');return;}
  if(value.status==='unknown'){setNeedsRead(true);setMessage('结果未知 · Operation '+value.intent+'。草稿已保留；请核对原记录，不会自动重试。');return;}
  if('reason'in value){if(value.reason==='version_conflict'||value.reason==='file_observation_required'||value.reason==='resource_changed')setNeedsRead(true);
   setMessage(value.reason==='version_conflict'?'磁盘版本冲突，未覆盖外部修改。草稿已保留，请重新读取并比较。':value.reason+('operationId'in value?' · Operation '+value.operationId:''));}
 }
 const dirty=text!==file.content;
 return <section data-local-editor aria-label="本地文件编辑器">
  <p role="status">{message}</p><p>当前读取版本：<code>{file.version}</code></p>
  <label>编辑文件内容<textarea name="local-file-content" disabled={busy} value={text} onChange={e=>{
   const value=e.target.value;setText(value);drafts.set(key,{text:value,version:file.version});
  }}/></label>
  <div className="actions"><button disabled={busy||!file.editToken||!dirty||needsRead} onClick={()=>void run(save)}>保存本地文件</button>
  <button disabled={busy} onClick={()=>void run(read)}>重新读取文件</button>
  <button disabled={busy||!drafts.has(key)} onClick={()=>{drafts.delete(key);setText(file.content);setMessage('已放弃草稿，恢复当前读取内容。');}}>放弃文件草稿</button></div>
  <p>草稿仅在本窗口内存保留。保存前再次确认；撤权后清除编辑内容。外部进程仍可能修改文件。</p>
  <details open={needsRead}><summary>比较当前磁盘内容</summary><pre>{file.content}</pre></details>
 </section>;
}
