/** UI-only view state. No filesystem contents, credentials, Context mutations or domain facts. */
export type ViewId='context'|'structure';
export type ViewTab={id:ViewId;title:string};
export type WorkspaceState={tabs:ViewTab[];active:ViewId;preview:boolean;previewPercent:number};
const contextTab:ViewTab={id:'context',title:'Context 配置'};
export const defaultWorkspaceState=():WorkspaceState=>({tabs:[{...contextTab}],active:'context',preview:false,previewPercent:48});
export const workspaceStorageKey=(contextId:string|null)=>'wex.middle-workspace.v1:'+(contextId??'unselected');
export function restoreWorkspaceState(raw:string|null):WorkspaceState{
 const fallback=defaultWorkspaceState();
 try{
  const v=JSON.parse(raw??'null') as WorkspaceState;
  if(!v||!Array.isArray(v.tabs)||v.tabs.length<1||v.tabs.length>2)return fallback;
  const allowed=new Set<ViewId>(['context','structure']),ids=new Set<ViewId>();
  const tabs:ViewTab[]=[];
  for(const tab of v.tabs){
   if(!tab||!allowed.has(tab.id)||ids.has(tab.id)||typeof tab.title!=='string')return fallback;
   ids.add(tab.id);tabs.push({id:tab.id,title:tab.title.slice(0,50).trim()||'视图'});
  }
  if(!ids.has('context')||!ids.has(v.active))return fallback;
  return {tabs,active:v.active,preview:v.preview===true,
   previewPercent:typeof v.previewPercent==='number'&&Number.isFinite(v.previewPercent)?Math.max(25,Math.min(70,v.previewPercent)):48};
 }catch{return fallback;}
}
export function addView(state:WorkspaceState):WorkspaceState{
 if(state.tabs.some(t=>t.id==='structure'))return {...state,active:'structure'};
 return {...state,active:'structure',tabs:[...state.tabs,{id:'structure',title:'资源结构'}]};
}
export function removeView(state:WorkspaceState,id:ViewId):WorkspaceState{
 if(id==='context')return state;
 return {...state,tabs:state.tabs.filter(t=>t.id!==id),active:state.active===id?'context':state.active,preview:state.active===id?false:state.preview};
}
export function moveView(state:WorkspaceState,id:ViewId,direction:-1|1):WorkspaceState{
 const index=state.tabs.findIndex(t=>t.id===id),target=index+direction;
 if(index<0||target<0||target>=state.tabs.length)return state;
 const tabs=state.tabs.slice();[tabs[index],tabs[target]]=[tabs[target]!,tabs[index]!];
 return {...state,tabs};
}
