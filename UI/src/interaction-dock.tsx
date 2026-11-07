import {useEffect,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
type Point={x:number;y:number};
type DockState={open:boolean;free:Point;withinBar:number};
type Geometry={width:number;height:number;barX:number;barY:number;barWidth:number;barHeight:number};
const key='wex.interaction-dock.v1',avatarSize=58;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const initial=():DockState=>({open:false,free:{x:.82,y:.72},withinBar:.16});
export function restoreDockState(raw:string|null):DockState{
 const fallback=initial();
 try{
  const v=JSON.parse(raw??'null') as DockState;
  if(!v||typeof v!=='object'||!v.free||!Number.isFinite(v.free.x)||!Number.isFinite(v.free.y)||!Number.isFinite(v.withinBar))return fallback;
  return {open:v.open===true,free:{x:clamp(v.free.x),y:clamp(v.free.y)},withinBar:clamp(v.withinBar)};
 }catch{return fallback;}
}
const restore=()=>{try{return restoreDockState(localStorage.getItem(key));}catch{return initial();}};
/** UI overlay only; no system-level floating BrowserWindow and no Agent/Conversation authority. */
export function InteractionDock({visible}:{visible:boolean}){
 const [state,setState]=useState<DockState>(restore);
 const host=useRef<HTMLDivElement>(null),bar=useRef<HTMLDivElement>(null);
 const [geometry,setGeometry]=useState<Geometry>({width:900,height:650,barX:180,barY:575,barWidth:540,barHeight:64});
 const pointer=useRef<{id:number;x:number;y:number;state:DockState;moved:boolean}|null>(null);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{/* UI display preference only */}},[state]);
 useEffect(()=>{
  const measure=()=>{const h=host.current?.getBoundingClientRect(),b=bar.current?.getBoundingClientRect();if(!h)return;
   setGeometry({width:h.width,height:h.height,barX:b?b.left-h.left:0,barY:b?b.top-h.top:0,barWidth:b?.width??0,barHeight:b?.height??0});};
  const observer=new ResizeObserver(measure);if(host.current)observer.observe(host.current);if(bar.current)observer.observe(bar.current);
  window.addEventListener('resize',measure);measure();return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
 },[state.open,visible]);
 if(!visible)return null;
 const x=state.open?geometry.barX+state.withinBar*Math.max(0,geometry.barWidth-avatarSize):state.free.x*Math.max(0,geometry.width-avatarSize);
 const y=state.open?geometry.barY+Math.max(0,(geometry.barHeight-avatarSize)/2):state.free.y*Math.max(0,geometry.height-avatarSize);
 function finish(e:ReactPointerEvent<HTMLButtonElement>,cancel:boolean){
  const drag=pointer.current;if(!drag||drag.id!==e.pointerId)return;pointer.current=null;
  if(cancel)setState(drag.state);
  else if(!drag.moved)setState(current=>({...current,open:!current.open}));
  if(e.currentTarget.hasPointerCapture(drag.id))e.currentTarget.releasePointerCapture(drag.id);
 }
 return <div className="interaction-overlay" ref={host} data-interaction-dock data-open={state.open}>
  {state.open&&<div className="interaction-bar" ref={bar} aria-label="WEX 交互栏">
   <strong>交互栏</strong><span>AI / 秘书 / Context 入口待接线</span>
   <button type="button" onClick={()=>setState(s=>({...s,open:false}))}>收起</button>
  </div>}
  <button type="button" className="interaction-avatar" style={{left:x,top:y}}
   title={state.open?'拖动可调整栏内位置；点击收起':'拖动可调整位置；点击展开交互栏'}
   aria-label={state.open?'收起交互栏':'展开交互栏'}
   onPointerDown={e=>{if(e.button!==0||pointer.current)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY,state,moved:false};}}
   onPointerMove={e=>{const d=pointer.current;if(!d||d.id!==e.pointerId)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>5)d.moved=true;if(!d.moved)return;
    if(d.state.open){
     const range=Math.max(1,geometry.barWidth-avatarSize);
     setState(s=>({...s,withinBar:clamp(d.state.withinBar+dx/range)}));
    }else{
     const xRange=Math.max(1,geometry.width-avatarSize),yRange=Math.max(1,geometry.height-avatarSize);
     setState(s=>({...s,free:{x:clamp(d.state.free.x+dx/xRange),y:clamp(d.state.free.y+dy/yRange)}}));
    }
   }}
   onPointerUp={e=>finish(e,false)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>finish(e,true)}>
   <span aria-hidden="true">W</span>
  </button>
 </div>;
}
