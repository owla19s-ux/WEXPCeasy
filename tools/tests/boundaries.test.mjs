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
