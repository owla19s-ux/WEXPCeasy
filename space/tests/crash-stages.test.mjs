import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {fixture} from './fixture.mjs';
// The lifecycle lock is an explicit fixture so this suite isolates SQLite crash stages.
// It does not assert stale-lock cleanup, OS process ownership or Windows lock recovery.
const lock={async acquire(){return {status:'acquired',release:async()=>{}};}};
const spaceModule=new URL('../../dist/space/src/index.js',import.meta.url).href;
const sharedModule=new URL('../../dist/shared/src/index.js',import.meta.url).href;
for(const stage of ['pending','create','ready']){
 for(const moment of ['before','after']){
  test('S13 Context creation recovers after process exit '+moment+' '+stage+' commit without exposing a half-created Context',async t=>{
   const h=await fixture(t),program=`
    import {resolve} from 'node:path';
    import {openSpaceService} from ${JSON.stringify(spaceModule)};
    import {openSqliteStore} from ${JSON.stringify(sharedModule)};
    const [root,location,stage,moment]=process.argv.slice(1);
    const scope={subject:'fixture-user',entry:'fixture-local',conversation:'fixture',context:null,resource:'space',action:'context.create',target:resolve(location),relationship:'direct',relationshipGeneration:1};
    const permission={evaluate(){return {status:'allow',revision:1,generation:1,scope};},recheck(){return this.evaluate();}};
    const lock={async acquire(){return {status:'acquired',release:async()=>{}};}};
    const result=await openSpaceService({dataRoot:root,permission,lock,id:()=> 'reserved-context',openStore(path,ns){
     const db=openSqliteStore(path,ns);
     return {...db,commit(input){
      const selected=(stage==='create'?ns==='space-context':ns==='space-registry')&&input.intent.endsWith(':'+stage);
      if(selected&&moment==='before')process.exit(73);
      const committed=db.commit(input);
      if(selected&&moment==='after'&&committed.status==='committed')process.exit(73);
      return committed;
     }};
    }});
    if(result.status!=='ready')throw Error(JSON.stringify(result));
    await result.service.execute({}, {kind:'context.create',intent:'create',location,name:'工程'});
    throw Error('requested interruption stage was not reached');
   `;
   const child=spawnSync(process.execPath,['--input-type=module','-e',program,h.root,h.a,stage,moment],{encoding:'utf8',timeout:10000});
   assert.equal(child.status,73,child.stderr);
   const unregistered=stage==='pending'&&moment==='before',expectedId=unregistered?'new-context':'reserved-context';
   let allocations=0;
   const service=await h.open({lock,id(){allocations++;if(!unregistered)throw Error('reserved identity must be reused');return expectedId;}});
   const listing=()=>service.query(h.request('context.list','root:root'),{kind:'contexts'});
   const before=await listing();assert.equal(before.status,'ok');
   assert.equal(before.value.length,stage==='ready'&&moment==='after'?1:0);
   const recovered=await h.create(service);assert.equal(recovered.status,'committed');assert.equal(recovered.id,expectedId);
   assert.equal(allocations,unregistered?1:0);
   const context=await h.query(service,expectedId);assert.equal(context.status,'ok');assert.equal(context.value.name,'工程');assert.equal(context.value.revision,1);
   assert.deepEqual((await listing()).value.map(item=>item.id),[expectedId]);
   assert.deepEqual(await h.create(service),recovered);
   const body=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context');
   try{assert.equal(body.read().revision,1);}finally{body.close();}
  });
 }
}
