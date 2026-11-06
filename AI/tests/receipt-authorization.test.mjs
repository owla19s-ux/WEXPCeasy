import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createAiConfigurations} from '../../dist/AI/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
// Authorization/model observations are injected ports; SQLite persistence and restart are real.
const values={
 role:{kind:'role',name:'Reviewer',prompt:'Review'},
 position:{kind:'position',name:'Engineer',responsibility:'Implement'},
 agent:{kind:'agent',name:'Worker',roleId:'role',positionId:'position',model:{connectionId:'connection',modelId:'model'}},
};
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'wex-ai-receipt-auth-')),file=join(dir,'ai.sqlite');
 let db=openSqliteStore(file,'ai-configurations'),ai=createAiConfigurations(db,()=>true,()=>true);
 for(const [id,value] of Object.entries(values))assert.equal(ai.save({}, {id,intent:id+'-create',expectedRevision:0,value}).status,'committed');
 db.close();db=openSqliteStore(file,'ai-configurations');
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 return db;
}
for(const kind of ['role','position','agent']){
 for(const conflict of [false,true]){
  test(kind+' '+(conflict?'conflicting':'matching')+' receipt cannot be disclosed after write permission is revoked during storage read',t=>{
   const db=fixture(t),before=db.read();let allowed=true,commits=0;
   const ai=createAiConfigurations({...db,read(){allowed=false;return db.read();},commit(input){commits++;return db.commit(input);}},
    (_request,access)=>access.action!=='write'||allowed,()=>true);
   const result=ai.save({}, {id:kind,intent:kind+'-create',expectedRevision:0,value:{...values[kind],...(conflict?{name:'Changed'}:{})}});
   assert.deepEqual(result,{status:'denied'});
   assert.equal(commits,0);assert.deepEqual(db.read(),before);
  });
 }
}
test('agent receipt rechecks write access after its referenced role and position authorization',t=>{
 const db=fixture(t),before=db.read();let allowed=true;
 const ai=createAiConfigurations(db,(_request,access)=>{
  if(access.action==='read'){allowed=false;return true;}return allowed;
 },()=>true);
 assert.deepEqual(ai.save({}, {id:'agent',intent:'agent-create',expectedRevision:0,value:values.agent}),{status:'denied'});
 assert.deepEqual(db.read(),before);
});
test('authorized agent receipt replay after restart observes the old result without revalidating or rewriting the model',t=>{
 const db=fixture(t),before=db.read();let models=0,commits=0;
 const ai=createAiConfigurations({...db,commit(input){commits++;return db.commit(input);}},()=>true,()=>{models++;return false;});
 assert.deepEqual(ai.save({}, {id:'agent',intent:'agent-create',expectedRevision:0,value:values.agent}),{status:'committed',revision:1});
 assert.equal(models,0);assert.equal(commits,0);assert.deepEqual(db.read(),before);
});
