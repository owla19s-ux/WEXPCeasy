import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalWriteCoordinator} from '../../dist/app/src/local-write-coordination.js';
test('Local OS lease covers different coordinators, aliases and the entire receipt interval; unknown survives restart',async t=>{
 const base=await mkdtemp(join(tmpdir(),'wex-write-coordination-'));t.after(()=>rm(base,{recursive:true,force:true}));
 const root=join(base,'coordination'),first=createLocalWriteCoordinator(root),second=createLocalWriteCoordinator(root);
 const request={},other={},identity={device:'1',inode:'2'},access={request,check:()=>true};
 let enter,release;const entered=new Promise(r=>enter=r),waiting=new Promise(r=>release=r);
 const pending=first.dispatch(request,'op',()=>false,async()=>{
  const lease=await first.acquire(identity,access);assert.equal(lease.status,'acquired');await lease.release();
  enter();await waiting;return {status:'observed',reason:'result_recorded',operationId:'op'};
 });
 await entered;
 assert.equal((await second.dispatch(other,'other',()=>false,async()=>assert.fail('conflicting writer executed'))).status,'blocked');
 release();assert.equal((await pending).status,'observed');
 assert.equal((await second.dispatch(other,'unknown',()=>false,async()=>({status:'unknown',reason:'persistence_unconfirmed',operationId:'unknown'}))).status,'unknown');
 const restarted=createLocalWriteCoordinator(root);
 assert.equal((await restarted.dispatch({},'after',()=>false,async()=>assert.fail('unknown was retried'))).status,'blocked');
});
test('unresolved public Local Operation blocks a new save before acquiring a capability',async()=>{
 const c=createLocalWriteCoordinator();const r=await c.dispatch({},'next',()=>true,async()=>assert.fail('unresolved write bypassed'));
 assert.equal(r.status,'blocked');assert.equal(r.reason,'local_write_requires_recovery');
 assert.notEqual((await c.acquire({device:'1',inode:'2'},{request:{},check:()=>true})).status,'acquired');
});
