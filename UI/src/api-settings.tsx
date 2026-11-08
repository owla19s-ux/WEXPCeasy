import {useEffect,useRef,useState} from 'react';
import type {DesktopBridge,DesktopApiInput,ApiConnectionView,ApiModelView,ApiCommonParameters} from './index.js';
export function ApiSettings({bridge}:{bridge:DesktopBridge}){
 const [connections,setConnections]=useState<ApiConnectionView[]>([]),[models,setModels]=useState<ApiModelView[]>([]);
 const [selected,setSelected]=useState<ApiConnectionView>(),[model,setModel]=useState<ApiModelView>();
 const [name,setName]=useState(''),[provider,setProvider]=useState('Custom'),[protocol,setProtocol]=useState('openai-chat'),[endpoint,setEndpoint]=useState('https://api.openai.com/v1');
 const [modelName,setModelName]=useState(''),[modelId,setModelId]=useState(''),[temperature,setTemperature]=useState(''),[maxTokens,setMaxTokens]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[backend,setBackend]=useState(false);
 const epoch=useRef(0),running=useRef(false);
 async function call(input:DesktopApiInput){
  const captured=epoch.current;
  const reply=await bridge.api(input);
  if(captured!==epoch.current)throw Error('stale_api_settings_request');
  if(!reply.ok)throw Error(reply.error);
  const r=reply.value;
  if(r.status==='cancelled')throw Error('操作已取消');
  if(r.status==='unknown')throw Error('结果未知，请刷新核对；Operation：'+(r.operationId??r.intent));
  if(r.status!=='ok'&&r.status!=='committed')throw Error(r.reason);
  return r;
 }
 async function refresh(){const r=await call({kind:'snapshot'});if(r.status==='ok'&&r.view==='connections'){setConnections(r.connections);setBackend(r.credentialBackend);if(selected)setSelected(r.connections.find(c=>c.id===selected.id));}}
 async function listModels(id:string){const r=await call({kind:'models',connectionId:id});if(r.status==='ok'&&r.view==='models')setModels(r.models);}
 async function run(work:()=>Promise<void>){if(running.current)return;const captured=epoch.current;running.current=true;setBusy(true);setMessage('');try{await work();}catch(e){if(captured===epoch.current){setConnections([]);setModels([]);setMessage(e instanceof Error?e.message:'操作不可用');}}finally{if(captured===epoch.current){running.current=false;setBusy(false);}}}
 function choose(c:ApiConnectionView){setSelected(c);setName(c.name);setProvider(c.provider);setProtocol(c.protocol);setEndpoint(c.endpoint);setModels([]);setModel(undefined);}
 useEffect(()=>{
  const unsubscribe=bridge.onAccessChanged(()=>{epoch.current++;running.current=false;setBusy(false);setBackend(false);setConnections([]);setModels([]);setSelected(undefined);setModel(undefined);setName('');setProvider('Custom');setProtocol('openai-chat');setEndpoint('https://api.openai.com/v1');setModelName('');setModelId('');setTemperature('');setMaxTokens('');setMessage('授权已变更，请重新读取配置。');});
  return ()=>{epoch.current++;running.current=false;unsubscribe();};
 },[bridge]);
 const params=():ApiCommonParameters=>({temperature:temperature.trim()?{mode:'value',value:Number(temperature)}:{mode:'provider-default'},...(maxTokens.trim()?{max_tokens:{mode:'value' as const,value:Number(maxTokens)}}:{})});
 return <div data-api-settings><h3>API 与模型</h3><p>配置保存在 API 模块。凭证仅在独立安全窗口中录入；测试会发送真实请求。</p>
 <button disabled={busy} onClick={()=>void run(refresh)}>读取 API 配置</button>
 <p role="status">{message}</p>
 <ul>{connections.map(c=><li key={c.id}><button disabled={busy} aria-pressed={selected?.id===c.id} onClick={()=>choose(c)}>{c.name}</button> {c.enabled?'启用':'停用'} · {c.credentialRef?'已绑定凭证':'无凭证'}<small>{c.endpoint}</small></li>)}</ul>
 <button disabled={busy} onClick={()=>{setSelected(undefined);setName('');setProvider('Custom');setProtocol('openai-chat');setEndpoint('https://api.openai.com/v1');setModels([]);setModel(undefined);}}>新建 API 连接</button>
 <form aria-label="API 连接配置" onSubmit={e=>{e.preventDefault();void run(async()=>{
  const r=await call(selected?{kind:'connection.edit',id:selected.id,expectedRevision:selected.revision,name,provider,protocol,endpoint}:{kind:'connection.create',name,provider,protocol,endpoint,endpointMode:'base',enabled:true});
  if(r.status==='committed'){setMessage('连接已保存');await refresh();}
 });}}>
 <label>连接名称<input required value={name} maxLength={256} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
 <label>Provider<input required value={provider} disabled={busy} onChange={e=>setProvider(e.target.value)}/></label>
 <label>协议类型<select aria-label="协议类型" value={protocol} disabled={busy} onChange={e=>setProtocol(e.target.value)}><option value="openai-chat">OpenAI Chat 兼容协议</option><option value="anthropic-messages">Anthropic Messages 原生协议</option></select></label>
 <p>协议决定请求与响应格式，不等同于 Provider 名称。Anthropic 当前提供文本、基础目录与探针；工具、推理和多模态尚未完善。</p>
 <label>服务地址<input required type="url" value={endpoint} disabled={busy} onChange={e=>setEndpoint(e.target.value)}/></label>
 <button disabled={busy} type="submit">保存 API 连接</button></form>
 {selected&&<><button disabled={busy} onClick={()=>void run(async()=>{await call({kind:'connection.edit',id:selected.id,expectedRevision:selected.revision,enabled:!selected.enabled});await refresh();})}>{selected.enabled?'停用连接':'启用连接'}</button>
 <button disabled={busy||!backend} onClick={()=>void run(async()=>{await call({kind:'credential.set',connectionId:selected.id,expectedRevision:selected.revision});await refresh();})}>安全录入 Key</button>
 {!backend&&<p>此平台的系统加密凭证服务不可用。</p>}
 <button disabled={busy} onClick={()=>void run(async()=>{await call({kind:'credential.revoke',connectionId:selected.id,expectedRevision:selected.revision});await refresh();})}>撤销凭证并停用</button>
 <button disabled={busy} onClick={()=>void run(async()=>{const r=await call({kind:'connection.refresh',id:selected.id,expectedRevision:selected.revision});if(r.status==='ok'&&r.view==='directory')setMessage('服务端模型：'+r.modelIds.join('、'));})}>读取服务端模型目录</button>
 <button disabled={busy} onClick={()=>void run(()=>listModels(selected.id))}>读取已配置模型</button>
 <ul>{models.map(m=><li key={m.id}><button disabled={busy} onClick={()=>{setModel(m);setModelName(m.name);setModelId(m.modelId);const p=m.parameters.temperature;setTemperature(p?.mode==='value'?String(p.value):'');const limit=m.parameters.max_tokens;setMaxTokens(limit?.mode==='value'?String(limit.value):'');}}>{m.name}</button> · {m.observation?.capabilities.text??'未验证'}</li>)}</ul>
 <button disabled={busy} onClick={()=>{setModel(undefined);setModelName('');setModelId('');setTemperature('');setMaxTokens('');}}>新增模型</button>
 <form aria-label="模型配置" onSubmit={e=>{e.preventDefault();void run(async()=>{
  const r=await call(model?{kind:'model.edit',id:model.id,expectedRevision:model.revision,name:modelName,parameters:params()}:{kind:'model.create',connectionId:selected.id,name:modelName,modelId,parameters:params()});
  if(r.status==='committed'){setMessage('模型已保存');setModel(undefined);await listModels(selected.id);}
 });}}>
 <label>模型名称<input required disabled={busy} value={modelName} onChange={e=>setModelName(e.target.value)}/></label>
 <label>服务端模型 ID<input required disabled={busy||!!model} value={modelId} onChange={e=>setModelId(e.target.value)}/></label>
 <label>Temperature（留空使用服务端默认）<input type="number" step="any" disabled={busy} value={temperature} onChange={e=>setTemperature(e.target.value)}/></label>
 <label>最大输出 Tokens（Anthropic 文本调用必须配置）<input type="number" min={1} step={1} disabled={busy} value={maxTokens} onChange={e=>setMaxTokens(e.target.value)}/></label>
 <button disabled={busy} type="submit">保存模型</button></form>
 {model&&<button disabled={busy} onClick={()=>void run(async()=>{const r=await call({kind:'model.probe',id:model.id,expectedRevision:model.revision,stream:true});setMessage('模型测试：'+r.status);setModel(undefined);await listModels(selected.id);})}>测试并保存模型观测</button>}
 </>}
 {busy&&<button onClick={()=>void bridge.cancelApi()}>取消等待</button>}
 </div>;
}
