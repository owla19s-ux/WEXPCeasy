export type DiagnosticCode='storage_unavailable'|'root_unavailable'|'module_unavailable'|'release_failed';
export interface Diagnostic {readonly kind:'technical';readonly module:'app'|'shared'|'permissions';readonly level:'info'|'error';readonly code:DiagnosticCode}
/** Internal capture shared by the sink and persistent-log validator. No free text or business fields survive. */
export function captureTechnicalDiagnostic(input:unknown):Diagnostic|undefined{
 try{
  if(!input||typeof input!=='object'||Array.isArray(input))return;
  const value=input as Diagnostic;
  const module=value.module,level=value.level,code=value.code;
  if(!['app','shared','permissions'].includes(module)||!['info','error'].includes(level)||
   !['storage_unavailable','root_unavailable','module_unavailable','release_failed'].includes(code))return;
  return Object.freeze({kind:'technical',module,level,code});
 }catch{return;}
}
export function createDiagnostics(sink:(entry:Diagnostic)=>void){
 return Object.freeze({emit(input:Omit<Diagnostic,'kind'>):{status:'written'|'failed'}{
  const entry=captureTechnicalDiagnostic(input);if(!entry)return {status:'failed'};
  try{sink(entry);return {status:'written'};}catch{return {status:'failed'};}
 }});
}
