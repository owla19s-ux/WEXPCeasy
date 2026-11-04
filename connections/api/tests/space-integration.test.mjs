import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createApiService} from '../../../dist/connections/api/src/index.js';
import {createPermissions} from '../../../dist/permissions/src/index.js';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {openSpaceService} from '../../../dist/space/src/index.js';

test('real API identity owner and real permissions support Space model references without a live Provider call',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'wex-api-space-')),root=join(dir,'public'),location=join(dir,'context');
 for(const [path,id] of [[root,'public'],[location,'context']]){mkdirSync(path);writeFileSync(join(path,'.wex-root.json'),JSON.stringify({format:1,id}));}
 const pm=openSqliteStore(join(root,'permissions.sqlite'),'permissions'),db=openSqliteStore(join(root,'api.sqlite'),'api-configurations'),requests=new WeakMap();let seq=0;
 // Only source identity and management approvals are host fixtures; all domain services and Stores are real.
 const permission=createPermissions(pm,{current:r=>{const scope=requests.get(r);return scope?{...scope,kind:'local',moduleEnabled:true,globalEnabled:true,entryEnabled:true,conversationEnabled:false,sourceAllowed:true}:undefined;},canManage:()=>true,canReadHistory:()=>true});
 function bind(resource,action,target,context=null){const r={};requests.set(r,{subject:'user',entry:'window',conversation:null,context,resource,action,target,relationship:'session',relationshipGeneration:1});return r;}
 function grant(request,kind='grant'){assert.equal(permission[kind]({intent:`${kind}-${++seq}`,expectedRevision:pm.read().revision,scope:requests.get(request)}).status,'committed');}
 const api=createApiService(db,permission,{deriveRequest(parent,s){if(requests.has(parent))return bind('connections/api',s.action,s.target,s.context);}});
 const space=await openSpaceService({dataRoot:root,permission,owner:api});assert.equal(space.status,'ready');
 t.after(async()=>{await space.service.close();api.stop();db.close();pm.close();rmSync(dir,{recursive:true,force:true});});
 const create=bind('connections/api','connection.create','api:connections'),cmd={kind:'connection.create',intent:'c',name:'DeepSeek',provider:'deepseek',protocol:'openai-chat',endpoint:'https://example.org/v1',endpointMode:'base',credentialRef:{id:'cred-1',revision:1},enabled:true,parameters:{}};
 assert.equal(api.execute(create,cmd).status,'rejected');grant(create);const c=api.execute(create,cmd);assert.equal(c.status,'committed');
 const modelCreate=bind('connections/api','model.create',`connection:${c.id}`);grant(modelCreate);const m=api.execute(modelCreate,{kind:'model.create',intent:'model',connectionId:c.id,name:'Chat',modelId:'chat',parameters:{}});assert.equal(m.status,'committed');
 const contextCreate=bind('space','context.create',resolve(location));grant(contextCreate);const context=await space.service.execute(contextCreate,{kind:'context.create',intent:'ctx',location,name:'project'});assert.equal(context.status,'committed');
 const attach=bind('space','association.add',`context:${context.id}`,context.id),association={kind:'association.add',intent:'model-reference',contextId:context.id,owner:'connections/api',targetType:'model',targetId:m.id,purpose:'selected'};grant(attach);
 assert.equal((await space.service.execute(attach,association)).status,'unavailable','owner metadata has an independent exact read grant');
 const modelRead=bind('connections/api','model.read',`model:${m.id}`);grant(modelRead);const ref=await space.service.execute(attach,association);assert.equal(ref.status,'committed');
 const contextRead=bind('space','context.read',`context:${context.id}`,context.id);grant(contextRead);
 const q=await space.service.query(contextRead,{kind:'context',id:context.id});assert.equal(q.status,'ok');assert.equal(q.value.associations[0].targetId,m.id);assert.equal(JSON.stringify(q).includes('cred-1'),false);
 grant(modelRead,'revoke');assert.deepEqual((await space.service.query(contextRead,{kind:'context',id:context.id})).value.associations,[]);
 grant(modelRead);assert.equal((await space.service.query(contextRead,{kind:'context',id:context.id})).value.associations[0].id,ref.id);
});
