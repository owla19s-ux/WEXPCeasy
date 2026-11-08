import {GitHubTools} from './github-tools.js';
import {useEffect,useRef,useState} from 'react';
import type {DesktopBridge,DesktopConnectionsReply,DesktopGitHubFile} from './index.js';
type Snapshot=Extract<DesktopConnectionsReply,{status:'ok'}>;
export function ConnectionSettings({bridge}:{bridge:DesktopBridge}){
 const [data,setData]=useState<Snapshot>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [selected,setSelected]=useState(''),[file,setFile]=useState<DesktopGitHubFile>({owner:'',repo:'',ref:'main',path:''});
 const [loaded,setLoaded]=useState<Extract<DesktopConnectionsReply,{status:'file'}>>(),[content,setContent]=useState(''),[commitMessage,setCommitMessage]=useState('');
 const epoch=useRef(0),running=useRef(false);
 function clearFile(){setLoaded(undefined);setContent('');}
 async function call(input:Parameters<DesktopBridge['connections']>[0]){
  const r=await bridge.connections(input);if(!r.ok)throw Error(r.error);return r.value;
 }
 async function refresh(sequence:number){
  const r=await call({kind:'snapshot'});if(r.status!=='ok')throw Error(r.status+('reason'in r?': '+r.reason:''));
  if(epoch.current===sequence)setData(r);
 }
 async function run(work:(sequence:number)=>Promise<void>){
  if(running.current)return;running.current=true;setBusy(true);setMessage('');const sequence=epoch.current;
  try{await work(sequence);}catch(e){if(epoch.current===sequence){setData(undefined);clearFile();setMessage(e instanceof Error?e.message:'连接不可用');}}
  finally{running.current=false;setBusy(false);}
 }
 function report(r:DesktopConnectionsReply,sequence:number){
  if(epoch.current!==sequence)return;
  setMessage(r.status+('reason'in r?': '+r.reason:'')+('operationId'in r?' · Operation '+r.operationId:'')+('notice'in r&&r.notice?' · '+r.notice:''));
 }
 async function mutate(input:Parameters<DesktopBridge['connections']>[0],sequence:number){
  const r=await call(input);report(r,sequence);
  if(r.status==='committed'&&epoch.current===sequence){clearFile();await refresh(sequence);}
 }
 useEffect(()=>bridge.onAccessChanged(()=>{epoch.current++;setData(undefined);setSelected('');clearFile();setMessage('授权已变更，请重新读取连接。');}),[bridge]);
 useEffect(()=>()=>{epoch.current++;},[]);
 function target(key:keyof DesktopGitHubFile,value:string){setFile(old=>({...old,[key]:value}));clearFile();}
 const connection=data?.connections.find(c=>c.id===selected&&c.adapter==='github');
 return <div data-connection-settings><h3>GitHub / Local 连接</h3><p>API 与模型在独立设置页管理；Local 文件地址在 Space / Context 中按次确认访问。GitHub 官方工具与文件操作复用同一连接；每次调用均需原生确认。</p>
 <button disabled={busy} onClick={()=>void run(refresh)}>读取连接与操作记录</button>
 <button disabled={busy||!data} onClick={()=>void run(n=>mutate({kind:'github.create',expectedRevision:data!.revision},n))}>登记 GitHub 连接</button>
 <p role="status">{message}</p>
 {data&&<><p>Local 文件适配器：{data.localFiles?'已装配，访问时核验平台能力与授权':'不可用'}；目录扫描：{data.localDirectories?'已装配':'此平台尚无已验证原生扫描器'}。</p>
 {!data.credentialBackend&&<p>此平台加密凭证保管不可用，无法录入 GitHub Token。</p>}
 {data.connections.length===0&&<p>当前没有已登记的 GitHub / Local 连接配置。</p>}
 <ul>{data.connections.map(c=><li key={c.id}><strong>{c.id} · {c.adapter}</strong><small>{c.endpoint}</small><p>{c.enabled?'配置启用':'配置停用'} · 远端状态未观测 · {c.hasCredential?'已引用凭证':'无凭证引用'}</p>
 <button disabled={busy} onClick={()=>void run(n=>mutate({kind:'toggle',id:c.id,expectedRevision:data.revision,enabled:!c.enabled},n))}>{c.enabled?'停用此连接':'启用此连接'}</button>
 {c.adapter==='github'&&<>
 <button disabled={busy} onClick={()=>{setSelected(c.id);clearFile();}}>操作 GitHub 文件</button>
 <button disabled={busy||!data.credentialBackend} onClick={()=>void run(n=>mutate({kind:'credential.set',id:c.id,expectedRevision:data.revision},n))}>安全录入 GitHub Token</button>
 <button disabled={busy||!c.hasCredential} onClick={()=>void run(n=>mutate({kind:'credential.revoke',id:c.id,expectedRevision:data.revision},n))}>解除 GitHub Token 并停用</button>
 </>}</li>)}</ul>
 {connection&&<section aria-label="GitHub 文件操作"><h4>GitHub 文件</h4><small>{connection.id}</small>
 <fieldset disabled={busy}><label>所有者<input name="github-owner" value={file.owner} onChange={e=>target('owner',e.target.value)} /></label>
 <label>仓库<input name="github-repo" value={file.repo} onChange={e=>target('repo',e.target.value)} /></label>
 <label>分支或提交<input name="github-ref" value={file.ref} onChange={e=>target('ref',e.target.value)} /></label>
 <label>文件路径<input name="github-path" value={file.path} onChange={e=>target('path',e.target.value)} /></label></fieldset>
 <button disabled={busy||!connection.enabled||!connection.hasCredential||Object.values(file).some(v=>!v.trim())} onClick={()=>void run(async n=>{
  clearFile();const r=await call({kind:'github.read',id:connection.id,expectedRevision:data.revision,file});report(r,n);
  if(epoch.current===n&&r.status==='file'){setLoaded(r);setContent(r.content);}
 })}>读取 GitHub 文件</button>
 {loaded&&<><p>已读取 SHA：<code>{loaded.sha}</code> · {loaded.size} 字节</p>
 <label>文件内容<textarea name="github-content" disabled={busy} value={content} onChange={e=>setContent(e.target.value)} /></label>
 <label>提交说明<input name="github-message" disabled={busy} value={commitMessage} onChange={e=>setCommitMessage(e.target.value)} /></label>
 <button disabled={busy||!commitMessage.trim()||content===loaded.content} onClick={()=>void run(async n=>{
  const r=await call({kind:'github.write',id:connection.id,expectedRevision:data.revision,file:loaded.file,expectedSha:loaded.sha,content,message:commitMessage});report(r,n);
  if(r.status==='cancelled')return;
  if(epoch.current===n){clearFile();if(r.status==='written')setMessage('已提交 '+r.commitSha+' · Operation '+r.operationId+'。重新读取可继续编辑。');await refresh(n);}
 })}>确认提交 GitHub 修改</button></>}
 <p>仅修改已读取的 UTF-8 文件。冲突或结果未知时重新读取并核对原 Operation；不会自动重发。</p></section>}
 <label>GitHub 工具连接<select name="github-tools-connection" disabled={busy} value={selected} onChange={e=>{setSelected(e.target.value);clearFile();}}><option value="">选择已登记连接</option>{data.connections.filter(c=>c.adapter==='github').map(c=><option key={c.id} value={c.id}>{c.id}</option>)}</select></label>
 {connection&&<GitHubTools key={connection.id+':'+data.revision} bridge={bridge} connectionId={connection.id} revision={data.revision} enabled={connection.enabled&&connection.hasCredential} runtimeConfigured={data.githubMcpConfigured===true}/>}
 <h4>Operation 摘要</h4><p>unknown 表示结果未知；此页不会自动重试。</p>
 <ul>{data.operations.map(o=><li key={o.id}><strong>{o.phase}</strong><small>{o.id} · {o.adapter??'API'} · 尝试 {o.attempts} 次</small></li>)}</ul></>}</div>;
}
