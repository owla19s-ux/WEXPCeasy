export type PanelKind='context'|'diagnostics'|'conversation';
export interface Panel {id:string;kind:PanelKind;weight:number;collapsed:boolean}
export interface Layout {version:1;columns:[number,number,number,number];collapsed:boolean;roleVisible:boolean;bottomOpen:boolean;bottomRatio:number;panels:Panel[];expanded:string|null}
export const layoutKey='wex.workbench.layout.v1';
export function defaultLayout():Layout{return {version:1,columns:[13,18,44,25],collapsed:false,roleVisible:true,bottomOpen:false,bottomRatio:.24,panels:[
 {id:'panel-1',kind:'context',weight:25,collapsed:false},{id:'panel-2',kind:'diagnostics',weight:25,collapsed:false},{id:'panel-3',kind:'conversation',weight:50,collapsed:false}],expanded:null};}
const positive=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=1000000;
export function restoreLayout(raw:string|null):Layout{
 try{
  const x=JSON.parse(raw??'null') as Layout,d=defaultLayout();
  if(!x||x.version!==1||!Array.isArray(x.columns)||x.columns.length!==4||!x.columns.every(positive)||
   !Array.isArray(x.panels)||x.panels.length>6) return d;
  const ids=new Set<string>();const panels:Panel[]=[];
  for(const p of x.panels){
   if(!p||typeof p.id!=='string'||!/^panel-[0-9]{1,16}$/.test(p.id)||ids.has(p.id)||
    !['context','diagnostics','conversation'].includes(p.kind)||!positive(p.weight)||typeof p.collapsed!=='boolean')return d;
   ids.add(p.id);panels.push({id:p.id,kind:p.kind,weight:p.weight,collapsed:p.collapsed});
  }
  const sum=x.columns.reduce((a,b)=>a+b,0);
  const columns=(Math.abs(sum-100)<.000001?[...x.columns]:x.columns.map(v=>v/sum*100)) as Layout['columns'];
  return {version:1,columns,collapsed:x.collapsed===true,roleVisible:x.roleVisible!==false,bottomOpen:x.bottomOpen===true,
   bottomRatio:typeof x.bottomRatio==='number'&&Number.isFinite(x.bottomRatio)?Math.max(.12,Math.min(.5,x.bottomRatio)):d.bottomRatio,
   panels,expanded:typeof x.expanded==='string'&&panels.some(p=>p.id===x.expanded&&!p.collapsed)?x.expanded:null};
 }catch{return defaultLayout();}
}
function fit(weights:number[],minimum:number[],available:number):number[]{
 const total=Math.max(Number.isFinite(available)?available:1200,minimum.reduce((a,b)=>a+b,0));
 const result=minimum.map(()=>0),open=new Set(weights.map((_v,i)=>i));let rest=total;
 for(;;){
  const sum=[...open].reduce((s,i)=>s+weights[i]!,0);
  const small=[...open].filter(i=>rest*weights[i]!/sum<minimum[i]!);
  if(!small.length){for(const i of open)result[i]=rest*weights[i]!/sum;break;}
  for(const i of small){result[i]=minimum[i]!;rest-=minimum[i]!;open.delete(i);}
  if(!open.size)break;
 }
 return result;
}
export function columnWidths(state:Layout,width:number):number[]{
 if(state.collapsed)return [56,...fit(state.columns.slice(1),[200,360,260],Math.max(width-18-56,820))];
 return fit(state.columns,[168,200,360,260],width-18);
}
export function resizeColumns(state:Layout,width:number,index:number,delta:number):Layout{
 if(index<0||index>2||!Number.isFinite(delta)||(state.collapsed&&index===0))return state;
 const values=columnWidths(state,width),mins=[state.collapsed?56:168,200,360,260];
 const change=Math.max(mins[index]!-values[index]!,Math.min(delta,values[index+1]!-mins[index+1]!));
 values[index]=values[index]!+change;values[index+1]=values[index+1]!-change;
 const total=values.reduce((a,b)=>a+b,0);
 const columns=(state.collapsed?[state.columns[0],...values.slice(1).map(v=>v/(total-56)*(100-state.columns[0]))]:values.map(v=>v/total*100)) as Layout['columns'];
 return {...state,columns};
}
export function panelHeights(state:Layout,height:number):number[]{
 const expanded=state.panels.filter(p=>!p.collapsed),fixed=state.panels.filter(p=>p.collapsed).length*36;
 const heights=fit(expanded.map(p=>p.weight),expanded.map(()=>112),height-Math.max(0,state.panels.length-1)*6-fixed);
 let i=0;return state.panels.map(p=>p.collapsed?36:heights[i++]!);
}
export function resizePanels(state:Layout,height:number,index:number,delta:number):Layout{
 if(index<0||index>=state.panels.length-1||!Number.isFinite(delta)||state.panels[index]!.collapsed||state.panels[index+1]!.collapsed)return state;
 const heights=panelHeights(state,height),change=Math.max(112-heights[index]!,Math.min(delta,heights[index+1]!-112));
 heights[index]=heights[index]!+change;heights[index+1]=heights[index+1]!-change;
 const total=heights.reduce((sum,h,i)=>sum+(state.panels[i]!.collapsed?0:h),0);
 return {...state,panels:state.panels.map((p,i)=>({...p,weight:p.collapsed?p.weight:heights[i]!/total*100}))};
}
