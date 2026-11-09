import type {PointerEventHandler} from 'react';

/** Presentation only. Agent identity and interaction permission remain with their owning modules. */
export function AvatarEntry({x,y,expanded,onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onLostPointerCapture}:{x:number;y:number;expanded:boolean;onPointerDown:PointerEventHandler<HTMLButtonElement>;onPointerMove:PointerEventHandler<HTMLButtonElement>;onPointerUp:PointerEventHandler<HTMLButtonElement>;onPointerCancel:PointerEventHandler<HTMLButtonElement>;onLostPointerCapture:PointerEventHandler<HTMLButtonElement>;}){
 return <button type="button" className="interaction-avatar" style={{left:x,top:y}}
  title={expanded?'拖动可调整栏内位置；点击收起':'拖动可调整位置；点击展开交互栏'}
  aria-label={expanded?'收起交互栏':'展开交互栏'}
  onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
  onPointerCancel={onPointerCancel} onLostPointerCapture={onLostPointerCapture}>
  <span aria-hidden="true">W</span>
 </button>;
}
