import type {StopResult} from './assembly.js';
export type DesktopFailureKind='renderer-process-gone'|'web-contents-destroyed'|'bridge-setup-failed';
export interface DesktopFailureState {readonly kind:DesktopFailureKind;readonly release:'pending'|'incomplete'|'stopped'}
export type DesktopFailureAction='quit'|'restart'|'retry-release'|'hold';
/** Main-only failure ownership. No provider creation, automatic retry or business replay.
 * Every fault fences the entry synchronously; restart is possible only after confirmed release.
 */
export function createDesktopFailure(options:{
 seal():void;record():void;publish(state:DesktopFailureState):void;stop():Promise<StopResult>;
 choose(state:DesktopFailureState):Promise<DesktopFailureAction>;exit(restart:boolean):void;
}){
 let handling:Promise<DesktopFailureState>|undefined,state:DesktopFailureState|undefined;
 const publish=()=>{try{options.publish(Object.freeze({...state!}));}catch{/* reporting cannot bypass ownership */}};
 return Object.freeze({
  fail(kind:DesktopFailureKind):Promise<DesktopFailureState>{
   if(handling)return handling;
   let complete!:(state:DesktopFailureState)=>void;
   handling=new Promise(resolve=>{complete=resolve;});
   state={kind,release:'pending'};publish();
   try{options.seal();}catch{/* still attempt provider shutdown */ }
   try{options.record();}catch{/* never serialize raw errors or let logging keep the entry open */ }
   const work=async()=>{
    while(true){
     let result:StopResult;
     try{result=await options.stop();}catch{result={status:'incomplete',failed:['release']};}
     state={kind,release:result.status};publish();
     let action:DesktopFailureAction;
     try{action=await options.choose(Object.freeze({...state}));}catch{return state;}
     if(state.release==='incomplete'&&action==='retry-release')continue;
     if(state.release==='stopped'&&(action==='quit'||action==='restart')){
      try{options.exit(action==='restart');}catch{/* released but failed to exit/relaunch; explicit close remains available */ }
     }
     return state;
    }
   };
   void Promise.resolve().then(work).then(value=>complete(Object.freeze({...value})),()=>complete(Object.freeze({...state!})));
   return handling;
  }
 });
}
