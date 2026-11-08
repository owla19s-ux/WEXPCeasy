export interface DesktopSender {isDestroyed():boolean;readonly mainFrame:unknown}
export interface DesktopEvent {readonly sender:unknown;readonly senderFrame:unknown}
export type DesktopReply<T>={ok:true;value:T}|{ok:false;error:'untrusted_sender'|'invalid_request'|'host_unavailable'};
/** Identity is supplied by Electron, never taken from Renderer data. No business authorization. */
export function createDesktopGateway<T>(options:{sender:DesktopSender;url:string;read:()=>T}){
 return (event:DesktopEvent,payload:unknown):DesktopReply<T>=>{
  const frame=event.senderFrame as {url?:unknown}|null;
  try{
   if(options.sender.isDestroyed()||event.sender!==options.sender||!frame||frame!==options.sender.mainFrame||frame.url!==options.url)return {ok:false,error:'untrusted_sender'};
  }catch{return {ok:false,error:'untrusted_sender'};}
  try{
   if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.getPrototypeOf(payload)!==Object.prototype||Reflect.ownKeys(payload).length)return {ok:false,error:'invalid_request'};
  }catch{return {ok:false,error:'invalid_request'};}
  try{return {ok:true,value:options.read()};}catch{return {ok:false,error:'host_unavailable'};}
 };
}
