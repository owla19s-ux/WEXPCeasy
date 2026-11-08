import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'wex-app-diagnostics-')),hosts=[];
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 let failClose=false;
 const trust={current:()=>undefined,canManage:()=>false,canReadHistory:()=>false};
 const start=async(extra={})=>{
  const h=await startFoundations({dataRoot:root,trust,...extra});hosts.push(h);return h;
 };
 t.after(async()=>{failClose=false;for(const h of hosts)await h.stop();await rm(root,{recursive:true,force:true});});
 function damage(file,ns,value){const db=openSqliteStore(join(root,file),ns);db.commit({intent:'damage',expectedRevision:0,value});db.close();}
 const openStore=(path,ns)=>{
  const db=openSqliteStore(path,ns);return ns!=='technical-diagnostics'?db:{...db,close(){if(failClose)throw Error('log close uncertain');db.close();}};
 };
 return {root,start,damage,openStore,failClose(v){failClose=v;}};
}
test('App persists sanitized initialization diagnostics in the selected data root and reads them after restart',async t=>{
 const f=await fixture(t);f.damage('ai-configurations.sqlite','ai-configurations',{version:99,apiKey:'sensitive-provider-secret'});
 const h=await f.start({technicalDiagnostics:{},ai:{bindRead:()=>undefined}});
 assert.equal(h.status,'degraded');assert.ok(h.technicalDiagnostics,'technical log reader must be available');
 const before=h.technicalDiagnostics.read();assert.equal(before.status,'ok');assert.equal(before.records.length,1);
 assert.deepEqual(before.records[0].entry,{kind:'technical',module:'app',level:'error',code:'module_unavailable'});
 assert.equal(JSON.stringify(before).includes('sensitive-provider-secret'),false);
 assert.equal(existsSync(join(f.root,'technical-diagnostics.sqlite')),true);
 assert.equal((await h.stop()).status,'stopped');assert.equal(h.technicalDiagnostics.read().status,'unavailable');
 const reopened=await f.start({technicalDiagnostics:{}});assert.equal(reopened.status,'ready');assert.deepEqual(reopened.technicalDiagnostics.read(),before);
});
test('diagnostic capacity failure is observable and preserves existing log records and permissions',async t=>{
 const f=await fixture(t);
 f.damage('ai-configurations.sqlite','ai-configurations',{version:99});f.damage('conversations.sqlite','conversations',{format:99});
 const h=await f.start({technicalDiagnostics:{maxEntries:1},ai:{bindRead:()=>undefined},conversations:true});
 assert.equal(h.status,'degraded');assert.ok(h.permissions);assert.ok(h.technicalDiagnostics);
 assert.ok(h.diagnostics.some(d=>d.module==='diagnostics'&&d.reason==='diagnostic_write_failed'));
 assert.equal(h.technicalDiagnostics.read().records.length,1);
});
test('damaged technical log storage degrades only logging and is never blank reconstructed',async t=>{
 const f=await fixture(t);f.damage('technical-diagnostics.sqlite','technical-diagnostics',{format:99,domain:'technical-diagnostics',records:[]});
 const db=openSqliteStore(join(f.root,'technical-diagnostics.sqlite'),'technical-diagnostics'),before=db.read();db.close();
 const h=await f.start({technicalDiagnostics:{}});assert.equal(h.status,'degraded');assert.ok(h.permissions);assert.equal(h.technicalDiagnostics,undefined);
 assert.ok(h.diagnostics.some(d=>d.module==='diagnostics'&&d.reason==='initialization_failed'));
 assert.equal((await h.stop()).status,'stopped');
 const check=openSqliteStore(join(f.root,'technical-diagnostics.sqlite'),'technical-diagnostics');
 try{assert.deepEqual(check.read(),before);}finally{check.close();}
});
test('technical log close uncertainty keeps root ownership until stop retry succeeds',async t=>{
 const f=await fixture(t),h=await f.start({technicalDiagnostics:{},openStore:f.openStore});assert.equal(h.status,'ready');
 assert.ok(h.technicalDiagnostics);f.failClose(true);
 assert.equal((await h.stop()).status,'incomplete');assert.equal((await f.start()).status,'failed');
 f.failClose(false);assert.equal((await h.stop()).status,'stopped');assert.equal((await f.start()).status,'ready');
});
test('unsafe technical log paths are refused without altering a foreign file',async t=>{
 const f=await fixture(t),outside=await mkdtemp(join(tmpdir(),'wex-foreign-log-'));t.after(()=>rm(outside,{recursive:true,force:true}));
 const file=join(outside,'foreign');await writeFile(file,'DO NOT TOUCH');await symlink(file,join(f.root,'technical-diagnostics.sqlite'));
 const h=await f.start({technicalDiagnostics:{}});assert.equal(h.status,'degraded');assert.equal(h.technicalDiagnostics,undefined);assert.ok(h.permissions);
 assert.equal(await readFile(file,'utf8'),'DO NOT TOUCH');
});

for(const [label,namespace,file,options,damaged] of [
 ['active AI','ai-configurations','ai-configurations.sqlite',{ai:{bindRead:()=>undefined}},false],
 ['failed AI','ai-configurations','ai-configurations.sqlite',{ai:{bindRead:()=>undefined}},true],
 ['failed Conversations','conversations','conversations.sqlite',{conversations:true},true],
]){
 test(label+' close failure is persisted before root ownership is released',async t=>{
  const f=await fixture(t);
  if(damaged)f.damage(file,namespace,{version:99,format:99});
  let failures=damaged?2:1;
  const h=await f.start({...options,technicalDiagnostics:{},openStore(path,ns){
   const db=openSqliteStore(path,ns);
   return ns!==namespace?db:{...db,close(){if(failures-->0)throw Error('secret-close-path');db.close();}};
  }});
  assert.equal(h.status,damaged?'degraded':'ready');
  const result=await h.stop();assert.equal(result.status,'incomplete');
  assert.equal(h.technicalDiagnostics.read().status,'unavailable');
  assert.equal((await f.start()).status,'failed');
  assert.equal((await h.stop()).status,'stopped');
  const reopened=await f.start({technicalDiagnostics:{}});
  const history=reopened.technicalDiagnostics.read();assert.equal(history.status,'ok');
  assert.deepEqual(history.records.map(r=>r.entry.code),damaged?['module_unavailable','release_failed']:['release_failed']);
  assert.equal(JSON.stringify(history).includes('secret-close-path'),false);
 });
}
test('partial resource close failure reports diagnostic write failure when the persistent log is full',async t=>{
 const f=await fixture(t);f.damage('ai-configurations.sqlite','ai-configurations',{version:99});
 let failures=2;
 const h=await f.start({ai:{bindRead:()=>undefined},technicalDiagnostics:{maxEntries:1},openStore(path,ns){
  const db=openSqliteStore(path,ns);
  return ns!=='ai-configurations'?db:{...db,close(){if(failures-->0)throw Error('close uncertain');db.close();}};
 }});
 assert.equal((await h.stop()).status,'incomplete');
 assert.ok(h.diagnostics.some(d=>d.module==='diagnostics'&&d.reason==='diagnostic_write_failed'));
 assert.equal((await h.stop()).status,'stopped');
 const reopened=await f.start({technicalDiagnostics:{}});
 assert.deepEqual(reopened.technicalDiagnostics.read().records.map(r=>r.entry.code),['module_unavailable']);
});

test('desktop fault reporting persists one sanitized code and is closed with the host',async t=>{
 const f=await fixture(t),host=await f.start({technicalDiagnostics:{}});
 assert.equal(host.technicalDiagnostics.reportDesktopFailure().status,'written');
 const before=host.technicalDiagnostics.read();
 assert.deepEqual(before.records[0].entry,{kind:'technical',module:'app',level:'error',code:'renderer_unavailable'});
 assert.equal((await host.stop()).status,'stopped');
 assert.equal(host.technicalDiagnostics.reportDesktopFailure().status,'failed');
 const reopened=await f.start({technicalDiagnostics:{}});assert.deepEqual(reopened.technicalDiagnostics.read(),before);
});
