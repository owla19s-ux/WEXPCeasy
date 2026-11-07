import {test} from 'node:test';
import assert from 'node:assert/strict';
const state=()=>import('../../dist/UI/src/workspace-state.js');
test('each Context gets a separate non-sensitive view layout key',async()=>{
 const {workspaceStorageKey}=await state();
 assert.notEqual(workspaceStorageKey('context-a'),workspaceStorageKey('context-b'));
 assert.notEqual(workspaceStorageKey(null),workspaceStorageKey('context-a'));
});
test('default is Context configuration and extra navigation tab is opt-in',async()=>{
 const {defaultWorkspaceState,addView,removeView}=await state();
 const initial=defaultWorkspaceState();
 assert.equal(initial.active,'context');assert.deepEqual(initial.tabs.map(t=>t.id),['context']);
 const withStructure=addView(initial);
 assert.deepEqual(withStructure.tabs.map(t=>t.id),['context','structure']);
 assert.equal(withStructure.active,'structure');
 assert.deepEqual(addView(withStructure).tabs,withStructure.tabs);
 assert.deepEqual(removeView(withStructure,'context'),withStructure);
 assert.deepEqual(removeView(withStructure,'structure'),initial);
});
test('tab reorder changes UI order only and retains identity',async()=>{
 const {defaultWorkspaceState,addView,moveView}=await state();
 const value=addView(defaultWorkspaceState());
 const moved=moveView(value,'structure',-1);
 assert.deepEqual(moved.tabs.map(t=>t.id),['structure','context']);
 assert.equal(moved.active,'structure');
 assert.deepEqual(moveView(moved,'context',1),moved);
});
test('restore rejects corruption, rogue views and invisible active tabs',async()=>{
 const {restoreWorkspaceState,defaultWorkspaceState}=await state();
 const invalid=['not-json','{}','null','{"tabs":[],"active":"context"}',
 '{"tabs":[{"id":"context","title":"A"},{"id":"context","title":"B"}],"active":"context"}',
 '{"tabs":[{"id":"other","title":"Other"}],"active":"other"}'];
 for(const raw of invalid)assert.deepEqual(restoreWorkspaceState(raw),defaultWorkspaceState());
});
test('restore keeps only tab display metadata and clamps preview ratio',async()=>{
 const {restoreWorkspaceState,addView,defaultWorkspaceState}=await state();
 const value=addView(defaultWorkspaceState());
 const restored=restoreWorkspaceState(JSON.stringify({...value,preview:true,previewPercent:500,
  password:'should-not-be-stored',tabs:value.tabs.map(t=>({...t,secret:'hidden'}))}));
 assert.equal(restored.previewPercent,70);assert.equal(restored.preview,true);
 assert.equal('password'in restored,false);assert.equal('secret'in restored.tabs[0],false);
});
