import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Workbench} from './workbench.js';
import type {DesktopBridge,DesktopStatus} from './index.js';
declare global {interface Window {wexHost:DesktopBridge}}
const labels:Record<DesktopStatus['phase'],string>={starting:'正在启动',ready:'已就绪',degraded:'部分模块不可用',failed:'启动失败',stopping:'正在释放资源','release-pending':'资源释放未确认，请重试退出'};
function Desktop(){
 const [status,setStatus]=useState<DesktopStatus>({phase:'starting',diagnostics:[]}),[error,setError]=useState('');
 async function refresh(){try{const r=await window.wexHost.readStatus();if(r.ok){setStatus(r.value);setError('');}else setError('无法读取宿主状态');}catch{setError('桌面连接不可用');}}
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>clearInterval(timer);},[]);
 async function quit(){try{const result=await window.wexHost.requestQuit();if(!result.ok)setError('退出请求被拒绝');}catch{setError('无法发送退出请求');}}
 return <Workbench bridge={window.wexHost} status={status} label={labels[status.phase]} error={error} onRefresh={()=>void refresh()} onQuit={()=>void quit()}/>;
}
createRoot(document.getElementById('root')!).render(<Desktop/>);
