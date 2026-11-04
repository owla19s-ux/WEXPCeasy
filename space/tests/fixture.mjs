import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import * as api from '../../dist/space/src/index.js';
// Fixture permission port is injected by a trusted test host, never a product local grant.
export async function fixture(t,options={}){
 assert.equal(typeof api.openSpaceService,'function','Space public service must exist');
 const dir=mkdtempSync(join(tmpdir(),'wex-space-'));const root=join(dir,'public'),a=join(dir,'context-a'),b=join(dir,'context-b');
 for(const [p,id] of [[root,'root'],[a,'a-root'],[b,'b-root']]){mkdirSync(p);writeFileSync(join(p,'.wex-root.json'),JSON.stringify({format:1,id}));}
 let allowed=true,sequence=0;const facts=new WeakMap();
 const permission={evaluate(r){const scope=facts.get(r);return allowed&&scope?{status:'allow',revision:1,generation:1,scope}:{status:'deny',reason:'fixture_denied'};},recheck(r){return this.evaluate(r);}};
 function request(action,target,context=null){const r={};facts.set(r,{subject:'fixture-user',entry:'fixture-local',conversation:'fixture',context,resource:'space',action,target,relationship:'direct',relationshipGeneration:1});return r;}
 const handles=[];
 const config={dataRoot:root,permission,deriveRequest(parent,scope){if(!facts.has(parent))return;return request(scope.action,scope.target,scope.context);},id:()=>`id-${++sequence}`,...options};
 async function open(extra={}){const result=await api.openSpaceService({...config,...extra});assert.equal(result.status,'ready',JSON.stringify(result));handles.push(result.service);return result.service;}
 t.after(async()=>{for(const s of handles)await s.close();rmSync(dir,{recursive:true,force:true});});
 function req(c){const ctx=c.contextId??(c.kind==='context.edit'?c.id:null);const target=['context.create','context.attach'].includes(c.kind)?resolve(c.location):ctx?`context:${ctx}`:c.id?`${c.kind.split('.')[0]}:${c.id}`:c.kind.startsWith('group.')?`space:${c.spaceId}`:'root:root';return request(c.kind,target,ctx);}
 const exec=(s,c,r=req(c))=>s.execute(r,c);
 const query=(s,id)=>s.query(request('context.read',`context:${id}`,id),{kind:'context',id});
 const create=async(s,location=a,intent='create',name='工程')=>exec(s,{kind:'context.create',intent,location,name});
 return {dir,root,a,b,open,exec,query,create,request,req,permission,revoke(){allowed=false;},allow(){allowed=true;}};
}
