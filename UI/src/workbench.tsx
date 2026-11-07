import {useEffect,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {SpacePanel} from './space.js';
import {MiddleWorkspace} from './middle-workspace.js';
import {InteractionDock} from './interaction-dock.js';
import {columnWidths,defaultLayout,layoutKey,resizeColumns,restoreLayout} from './layout.js';
import type {Layout} from './layout.js';
import type {DesktopBridge,DesktopStatus} from './index.js';
type DividerProps={id:string;axis:'x'|'y';layout:Layout;value:number;disabled?:boolean;onDelta:(delta:number,initial:Layout)=>void;onRestore:(initial:Layout)=>void;onDragging:(value:boolean)=>void;onReset?:()=>void};
function Divider(p:DividerProps){
 const drag=useRef<{start:number;initial:Layout;pointer:number}|null>(null);
 function finish(event:ReactPointerEvent<HTMLDivElement>,cancel:boolean){
  const value=drag.current;if(!value)return;drag.current=null;
  if(cancel)p.onRestore(value.initial);p.onDragging(false);
  if(event.currentTarget.hasPointerCapture(value.pointer))event.currentTarget.releasePointerCapture(value.pointer);
 }
 return <div role="separator" aria-label={p.axis==='x'?'调整列宽':'调整面板高度'} aria-orientation={p.axis==='x'?'vertical':'horizontal'}
  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.value)} aria-disabled={p.disabled??false}
  style={p.axis==='x'?{gridColumn:2+Number(p.id.slice(7))*2,gridRow:1}:undefined} tabIndex={p.disabled?-1:0} data-divider={p.id} className={'workbench-divider '+p.axis} onDoubleClick={()=>p.onReset?.()}
  onPointerDown={event=>{if(p.disabled||event.button!==0||drag.current)return;event.preventDefault();
   event.currentTarget.setPointerCapture(event.pointerId);drag.current={start:p.axis==='x'?event.clientX:event.clientY,initial:p.layout,pointer:event.pointerId};p.onDragging(true);}}
  onPointerMove={event=>{const d=drag.current;if(d&&d.pointer===event.pointerId)p.onDelta((p.axis==='x'?event.clientX:event.clientY)-d.start,d.initial);}}
  onPointerUp={event=>finish(event,false)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)}
  onKeyDown={event=>{if(p.disabled)return;const keys=p.axis==='x'?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];
   if(keys.includes(event.key)){event.preventDefault();p.onDelta((event.key===keys[0]?-1:1)*(event.shiftKey?40:16),p.layout);}}}/>;
}
export function Workbench({bridge,status,label,error,onRefresh,onQuit}:{bridge:DesktopBridge;status:DesktopStatus;label:string;error:string;onRefresh:()=>void;onQuit:()=>void}){
 const [layout,setLayout]=useState<Layout>(()=>{try{return restoreLayout(localStorage.getItem(layoutKey)??localStorage.getItem('wex.workbench.layout.v1'));}catch{return defaultLayout();}});
 const [layoutSaved,setLayoutSaved]=useState(true);
 const [dragging,setDragging]=useState(false),[settings,setSettings]=useState(false),[setting,setSetting]=useState('display');
 const grid=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:window.innerWidth,height:window.innerHeight-76});
 useEffect(()=>{const element=grid.current;if(!element)return;const observer=new ResizeObserver(entries=>{
  const r=entries[0]?.contentRect;if(r)setSize({width:r.width,height:r.height});
 });observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(dragging)return;try{localStorage.setItem(layoutKey,JSON.stringify(layout));setLayoutSaved(true);}catch{setLayoutSaved(false);}},[layout,dragging]);
 const widths=columnWidths(layout,size.width),mainHeight=layout.bottomOpen?Math.max(320,size.height*(1-layout.bottomRatio)-6):size.height;
 const restore=(value:Layout)=>setLayout(value);
 return <SpacePanel bridge={bridge} render={parts=><main className="workbench" data-workbench data-dragging={dragging}>
  <header className="workbench-top"><div><strong>WEX</strong><span>个人工作台</span></div><div className="top-actions"><span className={'phase '+status.phase} role="status">{label}</span><button aria-pressed={layout.bottomOpen} onClick={()=>setLayout({...layout,bottomOpen:!layout.bottomOpen})}>输出</button><button onClick={onQuit}>{status.phase==='release-pending'?'重试退出':'退出应用'}</button></div></header>
  <div className="workbench-body"><div ref={grid} className="workbench-grid" style={{gridTemplateColumns:widths.map(v=>v+'px').join(' 6px '),gridTemplateRows:layout.bottomOpen?'minmax(320px,1fr) 6px '+Math.max(100,size.height*layout.bottomRatio)+'px':'minmax(0,1fr)'}}>
   <aside data-column="navigation" className={'workbench-navigation '+(layout.collapsed?'is-collapsed':'')} style={{gridColumn:1,gridRow:'1 / -1'}}>
    <div className="navigation-top"><strong>{layout.collapsed?'W':'工作空间'}</strong><button aria-label={layout.collapsed?'展开导航':'折叠导航'} onClick={()=>setLayout({...layout,collapsed:!layout.collapsed})}>{layout.collapsed?'›':'‹'}</button></div>
    <div className="navigation-scroll"><button className="nav-primary" aria-pressed={!settings} onClick={()=>setSettings(false)}>{layout.collapsed?'◫':'Space / Context'}</button>
     {!layout.collapsed&&<><button disabled title="对话入口尚不可用">普通对话</button>{parts.categories}{parts.structure}</>}
    </div>
    <div className="navigation-bottom"><button aria-label="设置" title="设置" aria-pressed={settings} onClick={()=>setSettings(true)}>{layout.collapsed?'⚙':'设置'}</button></div>
   </aside>
   {[0,1].map(i=><Divider key={i} id={'column-'+i} axis="x" layout={layout} value={widths[i]!/(widths[i]!+widths[i+1]!)*100} disabled={(layout.collapsed&&i===0)||(i===1&&!layout.auxiliaryOpen)} onDelta={(delta,s)=>setLayout(resizeColumns(s,size.width,i,delta))} onRestore={restore} onDragging={setDragging} onReset={()=>setLayout(s=>({...s,columns:defaultLayout().columns}))}/>)}
   <section data-column="main" className="workbench-main" style={{gridColumn:3,gridRow:1}}>
    <div hidden={settings} className="middle-surface"><MiddleWorkspace key={parts.contextId??"unselected"} parts={parts}/></div>
    <div data-settings hidden={!settings} className="settings-surface"><div className="settings-title"><h2>设置</h2><button onClick={()=>setSettings(false)}>返回工作区</button></div>
     <div className="settings-grid"><div className="settings-navigation">
      <details><summary>连接与服务</summary><button disabled>API 与模型</button><button disabled>Agent 与角色</button><button disabled>GitHub / Local</button></details>
      <details><summary>权限</summary><p>操作前显示实际授权确认。</p></details>
      <details><summary>验证</summary><button onClick={()=>setSetting('diagnostics')}>运行状态</button></details>
      <details open><summary>系统</summary><button aria-pressed={setting==='display'} onClick={()=>setSetting('display')}>显示与布局</button><button aria-pressed={setting==='voice'} onClick={()=>setSetting('voice')}>语音</button><button aria-pressed={setting==='diagnostics'} onClick={()=>setSetting('diagnostics')}>运行诊断</button></details>
     </div><div className="settings-detail">
      {setting==='display'&&<><h3>显示与布局</h3><p>拖动分隔线调整尺寸；聚焦分隔线后可用方向键调节，Shift 加快。</p>
       <label className="check-label"><input type="checkbox" checked={layout.roleVisible} onChange={e=>setLayout({...layout,roleVisible:e.target.checked})}/>显示窗口内虚拟形象</label>
       <label className="check-label"><input type="checkbox" checked={layout.collapsed} onChange={e=>setLayout({...layout,collapsed:e.target.checked})}/>收起第一列</label>
       <label className="check-label"><input type="checkbox" checked={layout.bottomOpen} onChange={e=>setLayout({...layout,bottomOpen:e.target.checked})}/>显示底部输出</label>
       <p>当前列宽：{widths.map(w=>Math.round(w)).join(' / ')} px</p><button onClick={()=>setLayout(defaultLayout())}>恢复默认布局</button></>}
      {setting==='voice'&&<><h3>语音与朗读</h3><p>开源离线方案：sherpa-onnx。</p><p>尚未配置语音模型，朗读当前不可用。麦克风语音输入暂不可用。</p><button disabled>试听</button></>}
      {setting==='diagnostics'&&<><h3>运行诊断</h3><p>{label}</p><button onClick={onRefresh}>刷新状态</button>{status.diagnostics.length?<ul>{status.diagnostics.map((d,i)=><li key={i}>{d.module}：{d.reason}</li>)}</ul>:<p>当前没有模块故障记录。</p>}</>}
     </div></div>
    </div>
   </section>
   <aside data-column="auxiliary" className="workbench-auxiliary" style={{gridColumn:5,gridRow:1}}>
    {layout.auxiliaryOpen?<div className="auxiliary-placeholder">
     <div className="auxiliary-heading"><button aria-label="收起辅助区" onClick={()=>setLayout({...layout,auxiliaryOpen:false})}>‹</button><h2>辅助区域</h2></div>
     <p>辅助视图功能尚未接入。此区域目前只验证展开、收起及布局。</p>
    </div>:<button className="auxiliary-toggle" aria-label="展开辅助区" title="展开辅助区" onClick={()=>setLayout({...layout,auxiliaryOpen:true})}>›</button>}
   </aside>
   {layout.bottomOpen&&<><div style={{gridColumn:'3 / -1',gridRow:2}}><Divider id="bottom" axis="y" layout={layout} value={layout.bottomRatio*100} onDelta={(delta,s)=>setLayout({...s,bottomRatio:Math.max(.12,Math.min(.5,s.bottomRatio-delta/size.height))})} onRestore={restore} onDragging={setDragging} onReset={()=>setLayout(s=>({...s,bottomRatio:defaultLayout().bottomRatio}))}/></div><section className="bottom-output" style={{gridColumn:'3 / -1',gridRow:3}}><strong>运行输出</strong><p>{label}</p>{status.diagnostics.map((d,i)=><p key={i}>{d.module}：{d.reason}</p>)}{error&&<p role="alert">{error}</p>}</section></>}
  </div><InteractionDock visible={layout.roleVisible}/></div>
  <footer className="workbench-footer"><span>{error||(layoutSaved?'业务访问需确认授权；布局自动保存。':'布局保存不可用；本次窗口内仍可调整。')}</span><span>WEXPCeasy · 0.1.1</span></footer>
 </main>}/>;
}
