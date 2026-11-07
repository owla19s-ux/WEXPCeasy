/** User preference, not the measured viewport layout. Version 1 was a permanently visible four-column grid. */
export interface Layout {version:2;columns:[number,number,number];collapsed:boolean;auxiliaryOpen:boolean;roleVisible:boolean;bottomOpen:boolean;bottomRatio:number}
export const layoutKey='wex.workbench.layout.v2';
const navMin=56, mainMin=280, auxClosed=36, auxMin=220;
export function defaultLayout():Layout{return {version:2,columns:[22,60,18],collapsed:false,auxiliaryOpen:false,roleVisible:true,bottomOpen:false,bottomRatio:.24};}
const valid=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=1000000;
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
/** An old four-column preference can recover navigation and content proportions without reviving the obsolete permanent third pane. */
export function restoreLayout(raw:string|null):Layout{
 const d=defaultLayout();
 try{
  const value=JSON.parse(raw??'null') as Record<string,unknown>;
  if(!value||typeof value!=='object')return d;
  const version=value.version;
  let columns:number[];
  if(version===2&&Array.isArray(value.columns)&&value.columns.length===3&&value.columns.every(valid))columns=value.columns;
  else if(version===1&&Array.isArray(value.columns)&&value.columns.length===4&&value.columns.every(valid)){
   const v=value.columns as number[];columns=[v[0]!,v[1]!+v[2]!,v[3]!];
  }else return d;
  const sum=columns.reduce((a,b)=>a+b,0);
  if(Math.abs(sum-100)>1e-10)columns=columns.map(x=>100*x/sum);
  if(!columns.every(valid))return d;
  const ratio=value.bottomRatio;
  return {version:2,columns:columns as Layout['columns'],collapsed:value.collapsed===true,
   auxiliaryOpen:version===2&&value.auxiliaryOpen===true,roleVisible:value.roleVisible!==false,
   bottomOpen:value.bottomOpen===true,bottomRatio:typeof ratio==='number'&&Number.isFinite(ratio)?clamp(ratio,.12,.5):d.bottomRatio,
   };
 }catch{return d;}
}
export function columnWidths(state:Layout,width:number):number[]{
 const available=Math.max(0,Number.isFinite(width)?width:0);
 const gaps=12, space=Math.max(0,available-gaps);
 const nav=state.collapsed?navMin:clamp(space*state.columns[0]/100,112,Math.max(112,space-mainMin-auxClosed));
 const aux=state.auxiliaryOpen?clamp(space*state.columns[2]/100,auxMin,Math.max(auxMin,space-nav-mainMin)):auxClosed;
 // When the host is extremely narrow, prefer preserving the main view rather than overflowing the entire workbench.
 if(space<nav+aux+mainMin){
  const reducedNav=Math.min(nav,space*.22);
  const reducedAux=Math.min(aux,space*.09);
  return [reducedNav,Math.max(0,space-reducedNav-reducedAux),reducedAux];
 }
 return [nav,space-nav-aux,aux];
}
export function resizeColumns(state:Layout,width:number,index:number,delta:number):Layout{
 if(index!==0&&index!==1||!Number.isFinite(delta))return state;
 if((index===0&&state.collapsed)||(index===1&&!state.auxiliaryOpen))return state;
 const values=columnWidths(state,width),minima=[state.collapsed?navMin:112,mainMin,state.auxiliaryOpen?auxMin:auxClosed];
 const left=values[index]!,right=values[index+1]!;
 const change=clamp(delta,minima[index]!-left,right-minima[index+1]!);
 if(!Number.isFinite(change)||change===0)return state;
 values[index]=left+change;values[index+1]=right-change;
 if(index===0&&!state.auxiliaryOpen){
  // Keep the hidden auxiliary pane's user preference: shrinking the window must not overwrite it.
  const total=values.reduce((a,b)=>a+b,0),nav=values[0]!/total*100;
  return {...state,columns:[nav,100-state.columns[2]-nav,state.columns[2]] as Layout['columns']};
 }
 if(index===1&&state.collapsed){
  const combined=100-state.columns[0],total=values[1]!+values[2]!;
  return {...state,columns:[state.columns[0],values[1]!/total*combined,values[2]!/total*combined] as Layout['columns']};
 }
 const total=values.reduce((a,b)=>a+b,0);
 return {...state,columns:values.map(v=>v/total*100) as Layout['columns']};
}
