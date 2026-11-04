import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createPermissions} from '../../dist/permissions/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {openSpaceService} from '../../dist/space/src/index.js';

// Real permissions + real Space + real SQLite; only trusted host/OS identity binding is injected.
async function setup(t,options={}){
 const dir=mkdtempSync(join(tmpdir(),'wex-local-space-')),root=join(dir,'public'),context=join(dir,'context');
 for(const [path,id] of [[root,'public-root'],[context,'context-root']]){mkdirSync(path);writeFileSync(join(path,'.wex-root.json'),JSON.stringify({format:1,id}));}
 const db=openSqliteStore(join(root,'permissions.sqlite'),'permissions'),requests=new WeakMap(),approved=new WeakSet();
 const policy={moduleEnabled:true,globalEnabled:true,sourceAllowed:true,entryEnabled:true};let sequence=0;
 const permission=createPermissions(db,{current:r=>{const scope=requests.get(r);return scope?{...scope,kind:'local',conversationEnabled:false,...policy}:undefined;},canManage:c=>approved.has(c),canReadHistory:r=>requests.has(r)});
 function bind(action,target,contextId=null,patch={}){const r={};requests.set(r,{subject:'local-user',entry:'window-1',conversation:null,context:contextId,resource:'space',action,target,relationship:'window-session',relationshipGeneration:1,...patch});return r;}
 function change(kind,request){const c={intent:`${kind}-${++sequence}`,expectedRevision:db.read().revision,scope:requests.get(request)};approved.add(c);return permission[kind](c);}
 const opened=await openSpaceService({dataRoot:root,permission,deriveRequest(parent,scope){return requests.has(parent)?bind(scope.action,scope.target,scope.context):undefined;},...options});assert.equal(opened.status,'ready');
 const s=opened.service;t.after(async()=>{await s.close();db.close();rmSync(dir,{recursive:true,force:true});});
 return {dir,root,context,bind,change,permission,policy,s};
}
test('real local permission grants drive independent Space create/read/edit without a fake Conversation',async t=>{
 const h=await setup(t),create=h.bind('context.create',resolve(h.context)),cmd={kind:'context.create',intent:'create',location:h.context,name:'local project'};
 assert.equal((await h.s.execute(create,cmd)).reason,'no_current_grant');assert.equal(existsSync(join(h.context,'wex-context.sqlite')),false);
 assert.equal(h.change('grant',create).status,'committed');const c=await h.s.execute(create,cmd);assert.equal(c.status,'committed');
 const read=h.bind('context.read',`context:${c.id}`,c.id);assert.equal((await h.s.query(read,{kind:'context',id:c.id})).status,'rejected');h.change('grant',read);
 const q=await h.s.query(read,{kind:'context',id:c.id});assert.equal(q.status,'ok');assert.equal(q.value.id,c.id);assert.equal(q.value.name,'local project');
 const edit=h.bind('context.edit',`context:${c.id}`,c.id),editCmd={kind:'context.edit',intent:'edit',id:c.id,expectedRevision:1,name:'renamed'};
 assert.equal((await h.s.execute(edit,editCmd)).reason,'no_current_grant');h.change('grant',edit);assert.equal((await h.s.execute(edit,editCmd)).status,'committed');
 assert.equal((await h.s.query(read,{kind:'context',id:c.id})).value.name,'renamed');
 assert.equal(h.permission.evaluate(read).scope.conversation,null);assert.equal(h.permission.evaluate(edit).scope.entry,'window-1');
 h.change('revoke',edit);assert.equal((await h.s.execute(edit,editCmd)).status,'rejected','revoked subjects cannot replay prior committed results');
 assert.equal((await h.s.query(read,{kind:'context',id:c.id})).status,'ok','independent read grant remains current');
 const other=h.bind('context.read',`context:${c.id}`,c.id,{entry:'window-2'});assert.notEqual((await h.s.query(other,{kind:'context',id:c.id})).status,'ok');
});
test('disabling the trusted local entry after authorization blocks Space before any Context body commit',async t=>{
 let stopEntry;const h=await setup(t,{openStore(path,namespace){const db=openSqliteStore(path,namespace);return namespace!=='space-context'?db:{...db,read(){stopEntry?.();return db.read();}};}});
 stopEntry=()=>{h.policy.entryEnabled=false;};const request=h.bind('context.create',resolve(h.context));h.change('grant',request);
 const result=await h.s.execute(request,{kind:'context.create',intent:'create',location:h.context,name:'must not commit'});assert.notEqual(result.status,'committed');
 h.policy.entryEnabled=true;const db=openSqliteStore(join(h.context,'wex-context.sqlite'),'space-context');assert.equal(db.read().value,null);db.close();
});
test('real local permissions reject renderer self-claims and unauthorized grant management',async t=>{
 const h=await setup(t),request=h.bind('context.create',resolve(h.context));
 assert.equal(h.permission.grant({intent:'self-grant',expectedRevision:0,scope:{subject:'attacker'}}).status,'denied');
 h.change('grant',request);const result=await h.s.execute({entryEnabled:true,subject:'local-user',kind:'local'}, {kind:'context.create',intent:'forged',location:h.context,name:'forged'});
 assert.equal(result.status,'rejected');assert.equal(result.reason,'trusted_facts_missing');assert.equal(existsSync(join(h.context,'wex-context.sqlite')),false);
});
