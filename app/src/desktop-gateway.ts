export interface DesktopSender {isDestroyed():boolean;readonly mainFrame:unknown}
export interface DesktopEvent {readonly sender:unknown;readonly senderFrame:unknown}
export type DesktopReply<T>={ok:true;value:T}|{ok:false;error:'untrusted_sender'|'invalid_request'|'host_unavailable'};
/** Identity is supplied by Electron, never taken from Renderer data. No business authorization. */
export function createDesktopGateway<T>(options:{sender:DesktopSender;url:string;read:()=>T}){
 return (event:DesktopEvent,payload:unknown):DesktopReply<T>=>{
  try{
   const frame=event.senderFrame as {url?:unknown}|null;
   if(options.sender.isDestroyed()||event.sender!==options.sender||!frame||frame!==options.sender.mainFrame||frame.url!==options.url)return {ok:false,error:'untrusted_sender'};
  }catch{return {ok:false,error:'untrusted_sender'};}
  try{
   if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.getPrototypeOf(payload)!==Object.prototype||Reflect.ownKeys(payload).length)return {ok:false,error:'invalid_request'};
  }catch{return {ok:false,error:'invalid_request'};}
  try{return {ok:true,value:options.read()};}catch{return {ok:false,error:'host_unavailable'};}
 };
}

/** Admission only: trusted main-frame identity and a live host phase. Business validation stays with each owner. */
export function createDesktopBusinessGate(options:{sender:DesktopSender;url:string;isReady:()=>boolean}){
 const source=createDesktopGateway({sender:options.sender,url:options.url,read:()=>true as const});
 return (event:DesktopEvent):DesktopReply<true>=>{
  const checked=source(event,{});
  if(!checked.ok)return checked;
  try{return options.isReady()?checked:{ok:false,error:'host_unavailable'};}
  catch{return {ok:false,error:'host_unavailable'};}
 };
}
