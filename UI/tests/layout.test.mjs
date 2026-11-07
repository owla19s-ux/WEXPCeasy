import {test} from 'node:test';
import assert from 'node:assert/strict';
const layout=()=>import('../../dist/UI/src/layout.js');
test('PC workbench distributes the full viewport while preserving usable minimum widths',async()=>{
 const {defaultLayout,columnWidths}=await layout();
 const state=defaultLayout(),wide=columnWidths(state,1920);
 assert.deepEqual(state.columns,[13,18,44,25]);
 assert.ok(Math.abs(wide.reduce((a,b)=>a+b,0)-1902)<0.01);
 const narrow=columnWidths(state,800);
 assert.ok(narrow[0]>=168&&narrow[1]>=200&&narrow[2]>=360&&narrow[3]>=260);
});
test('divider drags cannot collapse adjacent content and preserve total width',async()=>{
 const {defaultLayout,columnWidths,resizeColumns}=await layout();
 const state=defaultLayout(),before=columnWidths(state,1920);
 const resized=resizeColumns(state,1920,1,100000),after=columnWidths(resized,1920);
 assert.ok(after[2]>=360);assert.ok(Math.abs(before[1]+before[2]-after[1]-after[2])<0.01);
 assert.ok(Math.abs(before[0]-after[0])<0.01);assert.ok(Math.abs(before[3]-after[3])<0.01);
});
test('collapsed navigation retains its expanded width after resizing other columns',async()=>{
 const {defaultLayout,columnWidths,resizeColumns}=await layout();
 const state={...defaultLayout(),collapsed:true};
 const resized=resizeColumns(state,1920,1,70);
 assert.equal(columnWidths(resized,1920)[0],56);assert.equal(resized.columns[0],13);
 assert.equal(columnWidths({...resized,collapsed:false},1920)[0],247.26);
});
test('layout restore rejects corrupt or foreign persisted fields and keeps only display preferences',async()=>{
 const {defaultLayout,restoreLayout}=await layout();
 for(const raw of ['invalid','null','{}','{"version":2}','{"version":1,"columns":[0,0,0,0]}'])
  assert.deepEqual(restoreLayout(raw),defaultLayout());
 const state=defaultLayout();state.columns=[15,20,40,25];state.collapsed=true;
 const restored=restoreLayout(JSON.stringify({...state,secret:'must not persist',contextId:'not layout data'}));
 assert.deepEqual(restored,state);assert.equal('secret'in restored,false);assert.equal('contextId'in restored,false);
});
test('auxiliary panel resize and restoration retain panel identity and safe sizes',async()=>{
 const {defaultLayout,panelHeights,resizePanels,restoreLayout}=await layout();
 const state=defaultLayout(),before=panelHeights(state,800);
 const resized=resizePanels(state,800,0,10000),after=panelHeights(resized,800);
 assert.ok(after[1]>=112);assert.ok(Math.abs(before.reduce((a,b)=>a+b,0)-after.reduce((a,b)=>a+b,0))<0.01);
 assert.deepEqual(restoreLayout(JSON.stringify(resized)),resized);
 assert.deepEqual(resized.panels.map(p=>p.id),['panel-1','panel-2','panel-3']);
});
