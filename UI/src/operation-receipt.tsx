import {useEffect,useRef,useState} from 'react';
import type {DesktopBridge,DesktopOperation,ApiJson} from './index.js';
const record=(value:ApiJson):Record<string,ApiJson>|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value:undefined;
function outcome(operation:DesktopOperation):string{
 if(operation.phase==='unknown'||operation.observations.some(o=>o.phase==='unknown'))return '结果未知；核对原回执和资源状态，不自动重试。';
 if(operation.phase!=='observed')return '尚无完整回执；不代表操作成功。';
 if(operation.observations.some(o=>record(o.value)?.isError===true))return '工具返回错误（已观察回执）。';
 if(operation.observations.some(o=>['rejected','blocked','conflict','failed'].includes(String(record(o.value)?.status))))return '拒绝、冲突或失败回执（已观察）。';
 return '已观察回执；不等于业务成功。';
}
export function OperationReceipt({bridge,operationId}:{bridge:DesktopBridge;operationId:string}){
 const [operation,setOperation]=useState<DesktopOperation>(),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const epoch=useRef(0),running=useRef(false);
 useEffect(()=>{const off=bridge.onAccessChanged(()=>{epoch.current++;running.current=false;setBusy(false);setOperation(undefined);setMessage('授权已变更，请重新读取原回执。');});return ()=>{epoch.current++;off();};},[bridge,operationId]);
 async function read(){if(running.current)return;const captured=epoch.current;running.current=true;setBusy(true);setMessage('');setOperation(undefined);
  try{const reply=await bridge.connections({kind:'operation.read',id:operationId});if(captured!==epoch.current)return;
   if(!reply.ok)throw Error(reply.error);const r=reply.value;
   if(r.status!=='operation')throw Error(r.status+('reason'in r?': '+r.reason:''));
   if(r.operation.id!==operationId)throw Error('回执身份不匹配');setOperation(r.operation);
  }catch(error){if(captured===epoch.current)setMessage(error instanceof Error?error.message:'回执不可用');}
  finally{if(captured===epoch.current){running.current=false;setBusy(false);}}
 }
 return <div data-operation-receipt><button disabled={busy} onClick={()=>void read()}>读取原 Operation 回执</button><p role="status">{message}</p>
 {operation&&<><p>{outcome(operation)}</p><small>Operation {operation.id} · 连接 {operation.connectionId??'未记录'} · {operation.adapter??'API'} · 尝试 {operation.attempts} 次</small><p>创建时间：{operation.createdAt?<time dateTime={operation.createdAt}>{operation.createdAt}</time>:'未记录（旧回执）'}</p>
 {operation.observations.map(observation=><div key={observation.id}><strong>{observation.id} · {observation.phase}</strong><small>回执时间：{observation.recordedAt??'未记录（旧回执）'}</small><pre>{JSON.stringify(observation.value,null,2).slice(0,32000)}</pre>{JSON.stringify(observation.value,null,2).length>32000&&<p>显示已截断；原始持久回执保留。</p>}</div>)}</>}
 </div>;
}
