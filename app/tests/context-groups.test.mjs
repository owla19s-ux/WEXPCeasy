import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
// Only platform source identity is a fixture; App, Permissions, Space and SQLite are real.
test('App authorizes Context ID group movement through exact grants and restores organization under a fresh entry generation',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'wex-app-context-group-')),root=join(dir,'public'),location=join(dir,'context'),hosts=[];
 for(const [path,id] of [[root,'public-root'],[location,'context-root']]){await mkdir(path);await writeFile(join(path,'.wex-root.json'),JSON.stringify({format:1,id}));}
 const approved=new WeakSet(),sources=new WeakMap();let source={},generation=1,revision=0,sequence=0,host;
 const identity=()=>({subject:'user',entry:'window',relationship:'session',relationshipGeneration:generation,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,entryEnabled:true});
 const options={dataRoot:root,trust:{current:()=>undefined,canManage:c=>approved.has(c),canReadHistory:()=>false},local:{current:sender=>sources.get(sender)},space:{}};
 sources.set(source,identity());host=await startFoundations(options);hosts.push(host);
 t.after(async()=>{for(const h of hosts)await h.stop();await rm(dir,{recursive:true,force:true});});
 const op=(action,target,context=null)=>({resource:'space',action,target,context});
 function grant(operation){
  const f=identity(),scope={subject:f.subject,entry:f.entry,conversation:null,relationship:f.relationship,relationshipGeneration:f.relationshipGeneration,...operation};
  const change={intent:'grant-'+(++sequence),expectedRevision:revision,scope};approved.add(change);
  const result=host.permissions.grant(change);assert.equal(result.status,'committed');revision=result.revision;
 }
 const bind=operation=>host.local.bind(source,operation);
 async function execute(command,operation){grant(operation);return host.space.execute(bind(operation),command);}
 const created=await execute({kind:'context.create',intent:'context',location,name:'Project'},op('context.create',resolve(location)));
 const space=await execute({kind:'space.create',intent:'space',name:'Space'},op('space.create','root:public-root'));
 const a=await execute({kind:'group.create',intent:'a',spaceId:space.id,name:'A'},op('group.create','space:'+space.id));
 const b=await execute({kind:'group.create',intent:'b',spaceId:space.id,name:'B'},op('group.create','space:'+space.id));
 const moveOp=op('context.group','context:'+created.id,created.id),readOp=op('context.organization.read','context:'+created.id,created.id);
 grant(moveOp);
 const command={kind:'context.group',contextId:created.id,spaceId:space.id,groupId:a.id,expectedRevision:0,intent:'assign'};
 assert.equal((await host.space.execute(bind(moveOp),command)).reason,'reference_unavailable');
 grant(op('space.read','space:'+space.id));grant(op('group.read','group:'+a.id));
 assert.equal((await host.space.execute(bind(moveOp),command)).status,'committed');
 assert.equal((await host.space.query(bind(readOp),{kind:'context.organization',id:created.id})).status,'rejected');
 grant(readOp);assert.equal((await host.space.query(bind(readOp),{kind:'context.organization',id:created.id})).value.groupId,a.id);
 grant(op('group.read','group:'+b.id));
 assert.equal((await host.space.execute(bind(moveOp),{...command,intent:'move',groupId:b.id,expectedRevision:1})).revision,2);
 const oldRead=bind(readOp);await host.stop();
 source={};generation=2;sources.set(source,identity());host=await startFoundations(options);hosts.push(host);assert.equal(host.status,'ready');
 assert.equal((await host.space.query(oldRead,{kind:'context.organization',id:created.id})).status,'rejected');
 assert.equal((await host.space.query(bind(readOp),{kind:'context.organization',id:created.id})).status,'rejected','old entry grants must not authorize a replacement source generation');
 for(const operation of [readOp,op('space.read','space:'+space.id),op('group.read','group:'+b.id)])grant(operation);
 assert.deepEqual((await host.space.query(bind(readOp),{kind:'context.organization',id:created.id})).value,{contextId:created.id,revision:2,spaceId:space.id,groupId:b.id});
});
