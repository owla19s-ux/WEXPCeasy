import type {StopResult} from './assembly.js';
/** Owns pending startup and retryable release; never abandons a provider on window close. */
export function createDesktopLifecycle<T extends {stop():Promise<StopResult>}>(startProvider:()=>Promise<T>){
 let pending:Promise<T>|undefined,stopping:Promise<StopResult>|undefined,quitting=false;
 return Object.freeze({
  start():Promise<T|undefined>{if(quitting)return Promise.resolve(undefined);return pending??=Promise.resolve().then(startProvider);},
  stop():Promise<StopResult>{
   quitting=true;if(stopping)return stopping;
   const job=(async():Promise<StopResult>=>{
    try{const host=await pending;return host?await host.stop():{status:'stopped',failed:[]};}
    catch{return {status:'incomplete',failed:['startup-or-release']};}
   })();
   stopping=job;void job.then(result=>{if(result.status==='incomplete')stopping=undefined;});return job;
  }
 });
}
