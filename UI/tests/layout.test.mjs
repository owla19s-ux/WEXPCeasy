import {test} from 'node:test';
import assert from 'node:assert/strict';
const layout=()=>import('../../dist/UI/src/layout.js');

test('shared workspace defaults to one full view with collapsed auxiliary area',async()=>{
 const {defaultLayout,columnWidths}=await layout();
 const s=defaultLayout(),w=columnWidths(s,1440);
 assert.equal(s.version,2);assert.equal(s.auxiliaryOpen,false);assert.equal('panels'in s,false);
 assert.equal(w.length,3);assert.ok(w[1]>w[0]);assert.equal(w[2],36);
 assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1428)<.01);
});

test('narrow Windows snap sizes do not enforce old 1006px four-column overflow',async()=>{
 const {defaultLayout,columnWidths}=await layout();
 for(const n of [1200,800,640,420]){
  const w=columnWidths(defaultLayout(),n);
  assert.equal(w.length,3);assert.ok(w.every(v=>v>=0));
  assert.ok(w.reduce((a,b)=>a+b,0)<=n+.001);
  assert.ok(w[1]>=w[0]||n<=420);
 }
});

test('resizing navigation preserves total usable width and does not activate auxiliary',async()=>{
 const {defaultLayout,columnWidths,resizeColumns}=await layout();
 const before=defaultLayout(),old=columnWidths(before,1440);
 const changed=resizeColumns(before,1440,0,42),current=columnWidths(changed,1440);
 assert.equal(changed.auxiliaryOpen,false);
 assert.ok(current[0]>old[0]);assert.ok(Math.abs(current.reduce((a,b)=>a+b,0)-old.reduce((a,b)=>a+b,0))<.01);
 assert.deepEqual(resizeColumns(changed,1440,1,60),changed);
});

test('old version one layout migrates without re-enabling obsolete permanent panes',async()=>{
 const {defaultLayout,restoreLayout}=await layout();
 const old={version:1,columns:[13,18,44,25],collapsed:false,roleVisible:true,bottomOpen:false,bottomRatio:.24,
 panels:[{id:'panel-1',kind:'context',weight:25,collapsed:false}],expanded:null};
 const result=restoreLayout(JSON.stringify(old));
 assert.equal(result.version,2);assert.ok(result.columns[1]>result.columns[0]);
 assert.equal(result.auxiliaryOpen,false);assert.equal('panels'in result,false);
 for(const v of ['null','invalid','{}','{"version":999}','{"version":2,"columns":[0,1,99]}'])
  assert.deepEqual(restoreLayout(v),defaultLayout());
});

test('layout round-trip strips unknown properties and preserves optional auxiliary panel safely',async()=>{
 const {defaultLayout,restoreLayout,columnWidths}=await layout();
 const s={...defaultLayout(),auxiliaryOpen:true};
 const restored=restoreLayout(JSON.stringify({...s,secret:'do not persist'}));
 assert.deepEqual(restored,s);assert.equal('secret'in restored,false);
 const columns=columnWidths(restored,1920);assert.ok(columns[2]>=220);
});

test('navigation resize retains hidden auxiliary user-width preference',async()=>{
 const {defaultLayout,resizeColumns}=await layout();
 const before=defaultLayout(),third=before.columns[2];
 const changed=resizeColumns(before,1440,0,40);
 assert.equal(changed.columns[2],third);
 assert.equal(changed.auxiliaryOpen,false);
});
