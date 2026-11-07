import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze} from '../check-boundaries.mjs';
const good={'app/src/main.ts':"import {x} from '../../shared/src/index.js'; x();",'shared/src/index.ts':'export const x=()=>1;'};
test('nonempty real AST graph accepts public dependency',()=>{assert.equal(analyze(good).errors.length,0);assert.equal(analyze(good).edges.length,1);});
for(const [name,files,want] of [
 ['private import',{'app/src/main.ts':"import '../../shared/src/private.js';",'shared/src/private.ts':'export {};'},'private_import'],
 ['reverse app',{'permissions/src/index.ts':"import '../../app/src/index.js';",'app/src/index.ts':'export {};'},'reverse_app'],
 ['shared business',{'shared/src/index.ts':"import '../../permissions/src/index.js';",'permissions/src/index.ts':'export {};'},'shared_business'],
 ['renderer Node',{'UI/src/index.ts':"import fs from 'node:fs';"},'renderer_privileged'],
 ['renderer Electron',{'UI/src/index.ts':"const e=require('electron');"},'renderer_privileged'],
 ['renderer storage',{'UI/src/index.ts':"export * from '../../shared/src/index.js';",'shared/src/index.ts':'export {};'},'renderer_privileged'],
 ['file cycle',{'shared/src/a.ts':"import './b.js';",'shared/src/b.ts':"import './a.js';"},'file_cycle'],
 ['module cycle',{'permissions/src/index.ts':"import '../../space/src/index.js';",'space/src/index.ts':"import '../../permissions/src/index.js';"},'module_cycle'],
 ['parse failure',{'shared/src/index.ts':'import {'},'parse_error'],
 ['dynamic unresolved',{'app/src/index.ts':'import(variable);'},'unresolved_dynamic'],
 ['missing file',{'app/src/index.ts':"import './missing.js';"},'unresolved_import'],
 ['empty graph',{'shared/src/index.ts':'export const x=1;'},'empty_graph']
])test('rejects '+name,()=>assert.ok(analyze(files).errors.some(x=>x.code===want)));
test('type imports cannot bypass module and private boundaries',()=>{
 const files={'shared/src/index.ts':"import './ok.js'; type Bad = import('../../app/src/private.js').Secret;",'shared/src/ok.ts':'export {};','app/src/private.ts':'export type Secret = string;'};
 const errors=analyze(files).errors;assert.ok(errors.some(e=>e.code==='reverse_app'));assert.ok(errors.some(e=>e.code==='private_import'));assert.ok(errors.some(e=>e.code==='shared_business'));
});
test('renderer cannot import permission authority through its public barrel',()=>{
 const files={'UI/src/main.ts':"import '../../permissions/src/index.js';",'permissions/src/index.ts':'export {};'};
 assert.ok(analyze(files).errors.some(x=>x.code==='renderer_privileged'));
});

test('desktop external imports are restricted to their owning domains',()=>{
 const files={...good,'app/src/desktop.ts':"import {app} from 'electron';",'UI/src/view.tsx':"import {useState} from 'react'; import {createRoot} from 'react-dom/client';"};
 assert.equal(analyze(files).errors.length,0);
 for(const [file,name] of [['UI/src/x.ts','electron'],['space/src/x.ts','electron'],['UI/src/x.ts','some-arbitrary-package'],['app/src/x.ts','react']]){
  assert.ok(analyze({...good,[file]:"import '"+name+"';"}).errors.some(e=>e.file===file));
 }
});

test('connector owners accept public ports and internal private imports',()=>{
 const files={
  'connections/github/src/index.ts':"import '../../src/index.js'; import './internal.js';",
  'connections/github/src/internal.ts':'export {};',
  'connections/src/index.ts':'export {};',
  'app/src/main.ts':"import '../../connections/github/src/index.js';",
 };
 assert.deepEqual(analyze(files).errors,[]);
});
for(const [from,to] of [['github','api'],['api','github'],['github','local'],['local','github']]){
 for(const statement of [
  "import '../../"+to+"/src/private.js';",
  "export * from '../../"+to+"/src/private.js';",
  "type T = import('../../"+to+"/src/private.js').T;",
  "import('../../"+to+"/src/private.js');",
  "require('../../"+to+"/src/private.js');",
 ]){
  test('rejects connector private crossing '+from+' to '+to+' '+statement,()=>{
   const files={['connections/'+from+'/src/index.ts']:statement,
    ['connections/'+to+'/src/private.ts']:'export type T=string;'};
   assert.ok(analyze(files).errors.some(e=>e.code==='private_import'));
  });
 }
}
test('common connections cannot depend on a concrete connector public port',()=>{
 const files={'connections/src/index.ts':"import '../github/src/index.js';",
  'connections/github/src/index.ts':'export {};'};
 assert.ok(analyze(files).errors.some(e=>e.code==='reverse_connector'));
});
test('connector module cycle is detected even without a file cycle',()=>{
 const files={
  'connections/github/src/index.ts':'export {};',
  'connections/github/src/use.ts':"import '../../api/src/index.js';",
  'connections/api/src/index.ts':'export {};',
  'connections/api/src/use.ts':"import '../../github/src/index.js';",
 };
 assert.ok(analyze(files).errors.some(e=>e.code==='module_cycle'));
});
test('connector aliases fail closed instead of hiding private imports',()=>{
 const files={'connections/github/src/index.ts':"import '@api/private';"};
 assert.ok(analyze(files).errors.some(e=>e.code==='unresolved_import'));
});
test('source scanner includes environments and excludes its tests',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {readProductSources}=await import('../check-boundaries.mjs');
 const root=mkdtempSync(join(tmpdir(),'wex-boundaries-'));
 try{
  mkdirSync(join(root,'environments/src'),{recursive:true});
  mkdirSync(join(root,'environments/tests'),{recursive:true});
  writeFileSync(join(root,'environments/src/index.ts'),"import '../../app/src/index.js';");
  writeFileSync(join(root,'environments/tests/ignored.ts'),'export {};');
  mkdirSync(join(root,'app/src'),{recursive:true});writeFileSync(join(root,'app/src/index.ts'),'export {};');
  const files=readProductSources(root);
  assert.ok(files['environments/src/index.ts']);
  assert.equal(files['environments/tests/ignored.ts'],undefined);
  assert.ok(analyze(files).errors.some(e=>e.code==='reverse_app'));
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('connector public dependency is allowed without granting nested barrels',()=>{
 const base={
  'connections/github/src/index.ts':"import '../../api/src/index.js';",
  'connections/api/src/index.ts':'export {};',
 };
 assert.deepEqual(analyze(base).errors,[]);
 const nested={
  'connections/github/src/index.ts':"import '../../api/internal/src/index.js';",
  'connections/api/internal/src/index.ts':'export {};',
 };
 assert.ok(analyze(nested).errors.some(e=>e.code==='private_import'));
});
test('renderer cannot reach concrete connector privileges through public ports',()=>{
 const files={'UI/src/index.ts':"import '../../connections/github/src/index.js';",
  'connections/github/src/index.ts':'export {};'};
 assert.ok(analyze(files).errors.some(e=>e.code==='renderer_privileged'));
});
