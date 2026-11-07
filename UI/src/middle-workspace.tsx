import {useEffect,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import type {SpaceSections} from './space.js';
type ViewId='context'|'structure';
type View={id:ViewId;title:string};
const defaults:View[]=[{id:'context',title:'Context 配置'}];
type State={tabs:View[];active:ViewId;preview:boolean;previewPercent:number};
const key='wex.middle-workspace.v1';
const storageKey=(contextId:string|null)=>key+':'+(contextId??'unselected');
const fallback=():State=>({tabs:defaults,active:'context',preview:false,previewPercent:48});
function restore(contextId:string|null):State{
 try{
  const v=JSON.parse(localStorage.getItem(storageKey(contextId))||'null') as State;
  if(!v||!Array.isArray(v.tabs)||v.tabs.length<1||v.tabs.length>2)return fallback();
  const allowed=new Set<ViewId>(['context','structure']),ids=new Set<ViewId>();
  const tabs:View[]=[];
  for(const tab of v.tabs){
   if(!tab||!allowed.has(tab.id)||ids.has(tab.id)||typeof tab.title!=='string')return fallback();
   ids.add(tab.id);tabs.push({id:tab.id,title:tab.title.slice(0,50)||'视图'});
  }
  if(!ids.has('context')||!ids.has(v.active))return fallback();
  return {tabs,active:v.active,preview:v.preview===true,
   previewPercent:typeof v.previewPercent==='number'&&Number.isFinite(v.previewPercent)?Math.max(25,Math.min(70,v.previewPercent)):48};
 }catch{return fallback();}
}
/** View tabs belong to the UI. Actual Context, resource and edit state remain with their owning modules. */
export function MiddleWorkspace({parts}:{parts:SpaceSections}){
 const [state,setState]=useState<State>(()=>restore(parts.contextId));
 const [renaming,setRenaming]=useState<ViewId|null>(null);
 const [width,setWidth]=useState(0);
 const host=useRef<HTMLDivElement>(null);
 const drag=useRef<{x:number;percent:number;pointer:number}|null>(null);
 useEffect(()=>{try{localStorage.setItem(storageKey(parts.contextId),JSON.stringify(state));}catch{/* Layout is best-effort; business data never lives here. */}},[state,parts.contextId]);
 useEffect(()=>{if(!host.current)return;const observer=new ResizeObserver(entries=>setWidth(entries[0]?.contentRect.width??0));observer.observe(host.current);return()=>observer.disconnect();},[]);
 const active=state.tabs.find(t=>t.id===state.active)!;
 const split=state.preview&&width>=620;
 const sidebar=state.preview&&!split;
 const change=(patch:Partial<State>)=>setState(s=>({...s,...patch}));
 function finish(event:ReactPointerEvent<HTMLDivElement>,cancel:boolean){
  const d=drag.current;if(!d)return;drag.current=null;
  if(cancel)change({previewPercent:d.percent});
  if(event.currentTarget.hasPointerCapture(d.pointer))event.currentTarget.releasePointerCapture(d.pointer);
 }
 const add=()=>setState(s=>s.tabs.some(v=>v.id==='structure')?{...s,active:'structure'}:{...s,tabs:[...s.tabs,{id:'structure',title:'资源结构'}],active:'structure'});
 const remove=(id:ViewId)=>setState(s=>{if(id==='context')return s;return {...s,tabs:s.tabs.filter(v=>v.id!==id),active:s.active===id?'context':s.active,preview:s.active===id?false:s.preview};});
 const shift=(id:ViewId,delta:number)=>setState(s=>{const i=s.tabs.findIndex(t=>t.id===id),j=i+delta;if(j<0||j>=s.tabs.length)return s;const tabs=s.tabs.slice();[tabs[i],tabs[j]]=[tabs[j]!,tabs[i]!];return {...s,tabs};});
 return <div className="middle-workspace" ref={host} data-middle-workspace>
  <div className="middle-content">
   <div className="middle-current" style={split?{width:(100-state.previewPercent)+'%'}:undefined}>
    <div className="middle-view-title"><strong>{active.title}</strong><div className="middle-view-actions">
     <button type="button" onClick={()=>change({preview:!state.preview})} aria-label={state.preview?'关闭摘要预览':'预览当前 Context 摘要'}>{state.preview?'关闭预览':'摘要预览'}</button>
    </div></div>
    <div className="middle-view-scroll">
     {state.active==='context'?<><div className="surface-toolbar">{parts.toolbar}</div><div className="content-scroll">{parts.content}</div></>:<div className="structure-scroll">{parts.structure}</div>}
    </div>
   </div>
   {split&&<div className="middle-resizer" role="separator" aria-label="调整视图与摘要预览宽度" aria-orientation="vertical" tabIndex={0}
    aria-valuemin={25} aria-valuemax={70} aria-valuenow={state.previewPercent}
    onDoubleClick={()=>change({previewPercent:48})}
    onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,percent:state.previewPercent,pointer:e.pointerId};}}
    onPointerMove={e=>{const d=drag.current;if(!d||d.pointer!==e.pointerId||width<=0)return;change({previewPercent:Math.max(25,Math.min(70,d.percent-(e.clientX-d.x)/width*100))});}}
    onPointerUp={e=>finish(e,false)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>finish(e,true)}
    onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();change({previewPercent:Math.max(25,Math.min(70,state.previewPercent+(e.key==='ArrowLeft'?2:-2)*(e.shiftKey?5:1)))})}}}/>}
   {state.preview&&<aside className={'middle-preview '+(sidebar?'preview-compact':'')} style={split?{width:state.previewPercent+'%'}:undefined} aria-label="Context 摘要预览">
    <div className="middle-view-title"><strong>Context 摘要</strong><button type="button" aria-label="关闭摘要预览" onClick={()=>change({preview:false})}>×</button></div>
    <div className="middle-preview-body">{parts.summary}</div>
   </aside>}
  </div>
  <nav className="middle-tabs" aria-label="当前工作视图标签">
   <div className="middle-tabs-scroll" role="tablist" aria-label="Context 工作视图">
    {state.tabs.map((tab,i)=><div key={tab.id} className="middle-tab">
     {renaming===tab.id?<input autoFocus aria-label="编辑视图名称" maxLength={50} value={tab.title}
      onChange={e=>setState(s=>({...s,tabs:s.tabs.map(t=>t.id===tab.id?{...t,title:e.target.value}:t)}))}
      onBlur={()=>setRenaming(null)} onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')setRenaming(null)}}/>
      :<button type="button" role="tab" aria-selected={state.active===tab.id} onClick={()=>change({active:tab.id})} onDoubleClick={()=>setRenaming(tab.id)}>{tab.title}</button>}
     <button type="button" aria-label={'前移 '+tab.title} title="前移视图" disabled={i===0} onClick={()=>shift(tab.id,-1)}>‹</button>
     <button type="button" aria-label={'后移 '+tab.title} title="后移视图" disabled={i===state.tabs.length-1} onClick={()=>shift(tab.id,1)}>›</button>
     {tab.id!=='context'&&<button type="button" aria-label={'关闭 '+tab.title} onClick={()=>remove(tab.id)}>×</button>}
    </div>)}
   </div>
   <button type="button" aria-label="添加资源结构视图" title="添加当前可用视图" disabled={state.tabs.some(v=>v.id==='structure')} onClick={add}>＋</button>
  </nav>
 </div>;
}
