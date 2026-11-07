import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const load=()=>import('../../dist/UI/src/interaction-dock.js');
test('avatar free and bar-relative positions persist separately, with safe clamping',async()=>{
 const {restoreDockState}=await load();
 assert.deepEqual(restoreDockState('invalid'),{open:false,free:{x:.82,y:.72},withinBar:.16});
 const result=restoreDockState(JSON.stringify({open:true,free:{x:42,y:-4},withinBar:2,secret:'ignored'}));
 assert.deepEqual(result,{open:true,free:{x:1,y:0},withinBar:1});
 assert.equal('secret'in result,false);
});
test('collapsed interaction bar retains a visible avatar, without a permanent footer row',async()=>{
 const {InteractionDock}=await load();
 const html=renderToStaticMarkup(React.createElement(InteractionDock,{visible:true}));
 assert.match(html,/interaction-avatar/);assert.doesNotMatch(html,/class="interaction-bar"/);
 assert.equal(renderToStaticMarkup(React.createElement(InteractionDock,{visible:false})),'');
});
test('restored expanded interaction bar does not expose fabricated Agent actions',async()=>{
 const {InteractionDock}=await load(),previous=globalThis.localStorage;
 globalThis.localStorage={getItem:()=>JSON.stringify({open:true,free:{x:.1,y:.2},withinBar:.6})};
 try{
  const html=renderToStaticMarkup(React.createElement(InteractionDock,{visible:true}));
  assert.match(html,/class="interaction-bar"/);assert.match(html,/入口待接线/);
  assert.match(html,/收起/);
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
