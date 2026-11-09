import type {Ref} from 'react';

/** UI-only interaction container: object navigation awaits a separately approved real bridge. */
export function InteractionBar({onCollapse,barRef}:{onCollapse:()=>void;barRef:Ref<HTMLDivElement>}){
 return <div ref={barRef} className="interaction-bar" aria-label="WEX 交互栏">
  <strong>交互栏</strong><span>AI / 秘书 / Context 入口待接线</span>
  <button type="button" onClick={onCollapse}>收起</button>
 </div>;
}
