import {Fragment,useEffect,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {SpacePanel} from './space.js';
import {columnWidths,defaultLayout,layoutKey,panelHeights,resizeColumns,resizePanels,restoreLayout} from './layout.js';
import type {Layout,PanelKind} from './layout.js';
import type {DesktopBridge,DesktopStatus} from './index.js';
type DividerProps={id:string;axis:'x'|'y';layout:Layout;value:number;disabled?:boolean;onDelta:(delta:number,initial:Layout)=>void;onRestore:(initial:Layout)=>void;onDragging:(value:boolean)=>void};
function Divider(p:DividerProps){
 const drag=useRef<{start:number;initial:Layout;pointer:number}|null>(null);
 function finish(event:ReactPointerEvent<HTMLDivElement>,cancel:boolean){
  const value=drag.current;if(!value)return;drag.current=null;
  if(cancel)p.onRestore(value.initial);p.onDragging(false);
  if(event.currentTarget.hasPointerCapture(value.pointer))event.currentTarget.releasePointerCapture(value.pointer);
 }
 return <div role="separator" aria-label={p.axis==='x'?'调整列宽':'调整面板高度'} aria-orientation={p.axis==='x'?'vertical':'horizontal'}
  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.value)} aria-disabled={p.disabled??false}
  style={p.axis==='x'?{gridColumn:2+Number(p.id.slice(7))*2,gridRow:1}:undefined} tabIndex={p.disabled?-1:0} data-divider={p.id} className={'workbench-divider '+p.axis}
  onPointerDown={event=>{if(p.disabled||event.button!==0||drag.current)return;event.preventDefault();
   event.currentTarget.setPointerCapture(event.pointerId);drag.current={start:p.axis==='x'?event.clientX:event.clientY,initial:p.layout,pointer:event.pointerId};p.onDragging(true);}}
  onPointerMove={event=>{const d=drag.current;if(d&&d.pointer===event.pointerId)p.onDelta((p.axis==='x'?event.clientX:event.clientY)-d.start,d.initial);}}
  onPointerUp={event=>finish(event,false)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)}
  onKeyDown={event=>{if(p.disabled)return;const keys=p.axis==='x'?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];
   if(keys.includes(event.key)){event.preventDefault();p.onDelta((event.key===keys[0]?-1:1)*(event.shiftKey?40:16),p.layout);}}}/>;
}
const panelNames:Record<PanelKind,string>={context:'对象信息',diagnostics:'运行状态',conversation:'对话'};
export function Workbench({bridge,status,label,error,onRefresh,onQuit}:{bridge:DesktopBridge;status:DesktopStatus;label:string;error:string;onRefresh:()=>void;onQuit:()=>void}){
 const [layout,setLayout]=useState<Layout>(()=>{try{return restoreLayout(localStorage.getItem(layoutKey));}catch{return defaultLayout();}});
 const [layoutSaved,setLayoutSaved]=useState(true);
 const [dragging,setDragging]=useState(false),[settings,setSettings]=useState(false),[setting,setSetting]=useState('display');
 const grid=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:window.innerWidth,height:window.innerHeight-76});
 useEffect(()=>{const element=grid.current;if(!element)return;const observer=new ResizeObserver(entries=>{
  const r=entries[0]?.contentRect;if(r)setSize({width:r.width,height:r.height});
 });observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(dragging)return;try{localStorage.setItem(layoutKey,JSON.stringify(layout));setLayoutSaved(true);}catch{setLayoutSaved(false);}},[layout,dragging]);
 const widths=columnWidths(layout,size.width),mainHeight=layout.bottomOpen?Math.max(320,size.height*(1-layout.bottomRatio)-6):size.height;
 const stackHeight=Math.max(112,mainHeight-40),heights=panelHeights(layout,stackHeight);
 const rows=layout.panels.flatMap((p,i)=>i===layout.panels.length-1?[heights[i]+'px']:[heights[i]+'px','6px']).join(' ');
 const restore=(value:Layout)=>setLayout(value);
 function addPanel(){setLayout(s=>{if(s.panels.length>=6)return s;let n=1;while(s.panels.some(p=>p.id==='panel-'+n))n++;
  return {...s,expanded:null,panels:[...s.panels,{id:'panel-'+n,kind:'context',weight:25,collapsed:false}]};});}
 const role=<div className="role-empty" aria-label="角色展示"><span aria-hidden="true">W</span><small>尚未添加角色素材</small></div>;
 return <SpacePanel bridge={bridge} render={parts=><main className="workbench" data-workbench data-dragging={dragging}>
  <header className="workbench-top"><div><strong>WEX</strong><span>个人工作台</span></div><div className="top-actions"><span className={'phase '+status.phase} role="status">{label}</span><button aria-pressed={layout.bottomOpen} onClick={()=>setLayout({...layout,bottomOpen:!layout.bottomOpen})}>输出</button><button onClick={onQuit}>{status.phase==='release-pending'?'重试退出':'退出应用'}</button></div></header>
  <div className="workbench-body"><div ref={grid} className="workbench-grid" style={{gridTemplateColumns:widths.map(v=>v+'px').join(' 6px '),gridTemplateRows:layout.bottomOpen?'minmax(320px,1fr) 6px '+Math.max(100,size.height*layout.bottomRatio)+'px':'minmax(0,1fr)'}}>
   <aside data-column="navigation" className={'workbench-navigation '+(layout.collapsed?'is-collapsed':'')} style={{gridColumn:1,gridRow:'1 / -1'}}>
    <div className="navigation-top"><strong>{layout.collapsed?'W':'工作空间'}</strong><button aria-label={layout.collapsed?'展开导航':'折叠导航'} onClick={()=>setLayout({...layout,collapsed:!layout.collapsed})}>{layout.collapsed?'›':'‹'}</button></div>
    <div className="navigation-scroll"><button className="nav-primary" aria-pressed={!settings} onClick={()=>setSettings(false)}>{layout.collapsed?'◫':'Space / Context'}</button>
     {!layout.collapsed&&<><button disabled title="对话入口尚不可用">普通对话</button>{parts.categories}</>}
    </div>
    <div className="navigation-bottom"><button aria-label="设置" title="设置" aria-pressed={settings} onClick={()=>setSettings(true)}>{layout.collapsed?'⚙':'设置'}</button>{layout.roleVisible&&!layout.collapsed&&role}</div>
   </aside>
   {[0,1,2].map(i=><Divider key={i} id={'column-'+i} axis="x" layout={layout} value={widths[i]!/(widths[i]!+widths[i+1]!)*100} disabled={layout.collapsed&&i===0} onDelta={(delta,s)=>setLayout(resizeColumns(s,size.width,i,delta))} onRestore={restore} onDragging={setDragging}/>)}
   <section data-column="structure" className="workbench-structure" style={{gridColumn:3,gridRow:1}}>
    <h2 className="column-heading">结构与对象</h2><div className="structure-scroll">{parts.structure}</div>
    {layout.roleVisible&&layout.collapsed&&role}<div className="view-switch"><button aria-pressed>工作区</button><button disabled title="文件视图尚不可用">文件</button><button disabled title="对话视图尚不可用">对话</button></div>
   </section>
   <section data-column="main" className="workbench-main" style={{gridColumn:5,gridRow:1}}>
    <div className="content-tabs"><button aria-pressed={!settings} onClick={()=>setSettings(false)}>Space / Context</button>{settings&&<button aria-pressed onClick={()=>setSettings(true)}>设置</button>}</div>
    <div hidden={settings} className="space-surface"><div className="surface-toolbar">{parts.toolbar}</div><div className="content-scroll">{parts.content}</div></div>
    <div data-settings hidden={!settings} className="settings-surface"><div className="settings-title"><h2>设置</h2><button onClick={()=>setSettings(false)}>返回工作区</button></div>
     <div className="settings-grid"><div className="settings-navigation">
      <details><summary>连接与服务</summary><button disabled>API 与模型</button><button disabled>Agent 与角色</button><button disabled>GitHub / Local</button></details>
      <details><summary>权限</summary><p>操作前显示实际授权确认。</p></details>
      <details><summary>验证</summary><button onClick={()=>setSetting('diagnostics')}>运行状态</button></details>
      <details open><summary>系统</summary><button aria-pressed={setting==='display'} onClick={()=>setSetting('display')}>显示与布局</button><button aria-pressed={setting==='voice'} onClick={()=>setSetting('voice')}>语音</button><button aria-pressed={setting==='diagnostics'} onClick={()=>setSetting('diagnostics')}>运行诊断</button></details>
     </div><div className="settings-detail">
      {setting==='display'&&<><h3>显示与布局</h3><p>拖动分隔线调整尺寸；聚焦分隔线后可用方向键调节，Shift 加快。</p>
       <label className="check-label"><input type="checkbox" checked={layout.roleVisible} onChange={e=>setLayout({...layout,roleVisible:e.target.checked})}/>显示角色区域</label>
       <label className="check-label"><input type="checkbox" checked={layout.collapsed} onChange={e=>setLayout({...layout,collapsed:e.target.checked})}/>收起第一列</label>
       <label className="check-label"><input type="checkbox" checked={layout.bottomOpen} onChange={e=>setLayout({...layout,bottomOpen:e.target.checked})}/>显示底部输出</label>
       <p>当前列宽：{widths.map(w=>Math.round(w)).join(' / ')} px</p><button onClick={()=>setLayout(defaultLayout())}>恢复默认布局</button></>}
      {setting==='voice'&&<><h3>语音与朗读</h3><p>开源离线方案：sherpa-onnx。</p><p>尚未配置语音模型，朗读当前不可用。麦克风语音输入暂不可用。</p><button disabled>试听</button></>}
      {setting==='diagnostics'&&<><h3>运行诊断</h3><p>{label}</p><button onClick={onRefresh}>刷新状态</button>{status.diagnostics.length?<ul>{status.diagnostics.map((d,i)=><li key={i}>{d.module}：{d.reason}</li>)}</ul>:<p>当前没有模块故障记录。</p>}</>}
     </div></div>
    </div>
   </section>
   <aside data-column="auxiliary" className="workbench-auxiliary" style={{gridColumn:7,gridRow:1}}>
    <div className="auxiliary-heading"><h2>辅助视图</h2><button aria-label="添加辅助面板" disabled={layout.panels.length>=6} onClick={addPanel}>＋</button></div>
    <div className="auxiliary-stack" style={{gridTemplateRows:layout.expanded||!layout.panels.length?'minmax(0,1fr)':rows}}>
     {!layout.panels.length&&<div className="empty-panel"><p>未打开辅助面板</p><button onClick={addPanel}>添加面板</button></div>}
     {layout.panels.map((p,i)=><Fragment key={p.id}><section className="aux-panel" hidden={layout.expanded!==null&&layout.expanded!==p.id}>
      <div className="panel-heading"><button aria-label={p.collapsed?'展开面板':'折叠面板'} onClick={()=>setLayout({...layout,expanded:null,panels:layout.panels.map(x=>x.id===p.id?{...x,collapsed:!x.collapsed}:x)})}>{p.collapsed?'▸':'▾'}</button>
       <select aria-label="辅助面板内容" value={p.kind} onChange={e=>setLayout({...layout,panels:layout.panels.map(x=>x.id===p.id?{...x,kind:e.target.value as PanelKind}:x)})}>{Object.entries(panelNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select>
       <button aria-label="上移面板" disabled={!i} onClick={()=>{const panels=[...layout.panels];[panels[i-1],panels[i]]=[panels[i]!,panels[i-1]!];setLayout({...layout,panels});}}>↑</button>
       <button aria-label="下移面板" disabled={i===layout.panels.length-1} onClick={()=>{const panels=[...layout.panels];[panels[i],panels[i+1]]=[panels[i+1]!,panels[i]!];setLayout({...layout,panels});}}>↓</button>
       <button aria-label={layout.expanded===p.id?'还原面板':'占满辅助列'} onClick={()=>setLayout({...layout,expanded:layout.expanded===p.id?null:p.id,panels:layout.panels.map(x=>x.id===p.id?{...x,collapsed:false}:x)})}>{layout.expanded===p.id?'↙':'↗'}</button>
       <button aria-label="移除辅助面板" onClick={()=>setLayout({...layout,expanded:null,panels:layout.panels.filter(x=>x.id!==p.id)})}>×</button>
      </div><div className="panel-body" hidden={p.collapsed}>
       {p.kind==='context'?parts.summary:p.kind==='diagnostics'?<><p className="phase">{label}</p>{status.diagnostics.length?<ul>{status.diagnostics.map((d,j)=><li key={j}>{d.module}：{d.reason}</li>)}</ul>:<p>当前没有模块故障记录。</p>}<small>此处显示宿主运行状态。</small></>:<div className="conversation-unavailable"><h3>对话</h3><p>对话功能当前不可用。</p><p>语音模型未配置。</p></div>}
      </div></section>
      {i<layout.panels.length-1&&<div hidden={layout.expanded!==null}><Divider id={'panel-'+i} axis="y" layout={layout} value={heights[i]!/(heights[i]!+heights[i+1]!)*100} disabled={p.collapsed||layout.panels[i+1]!.collapsed} onDelta={(delta,s)=>setLayout(resizePanels(s,stackHeight,i,delta))} onRestore={restore} onDragging={setDragging}/></div>}
     </Fragment>)}
    </div>
   </aside>
   {layout.bottomOpen&&<><div style={{gridColumn:'3 / -1',gridRow:2}}><Divider id="bottom" axis="y" layout={layout} value={layout.bottomRatio*100} onDelta={(delta,s)=>setLayout({...s,bottomRatio:Math.max(.12,Math.min(.5,s.bottomRatio-delta/size.height))})} onRestore={restore} onDragging={setDragging}/></div><section className="bottom-output" style={{gridColumn:'3 / -1',gridRow:3}}><strong>运行输出</strong><p>{label}</p>{status.diagnostics.map((d,i)=><p key={i}>{d.module}：{d.reason}</p>)}{error&&<p role="alert">{error}</p>}</section></>}
  </div></div>
  <footer className="workbench-footer"><span>{error||(layoutSaved?'业务访问需确认授权；布局自动保存。':'布局保存不可用；本次窗口内仍可调整。')}</span><span>WEXPCeasy · 0.1.1</span></footer>
 </main>}/>;
}
