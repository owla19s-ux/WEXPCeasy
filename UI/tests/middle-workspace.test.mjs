import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const component=()=>import('../../dist/UI/src/middle-workspace.js');
const parts=(id)=>({
 contextId:id,
 toolbar:React.createElement('span',null,'Toolbar from Space'),
 categories:React.createElement('span',null,'Categories from Space'),
 structure:React.createElement('div',null,'Actual Context tree'),
 content:React.createElement('div',null,'Real Context configuration'),
 summary:React.createElement('div',null,'Real Context summary')
});
test('middle workspace starts with a full Context configuration, not a reserved editor pane',async()=>{
 const {MiddleWorkspace}=await component();
 const html=renderToStaticMarkup(React.createElement(MiddleWorkspace,{parts:parts('ctx-a')}));
 assert.match(html,/Context 配置/);assert.match(html,/Real Context configuration/);
 assert.doesNotMatch(html,/middle-preview-body/);
 assert.match(html,/middle-tabs/);
});
test('restored per-Context view can show the already available summary in a separate pane',async()=>{
 const {MiddleWorkspace}=await component();
 const previous=globalThis.localStorage;
 globalThis.localStorage={getItem:key=>key.endsWith(':ctx-b')?JSON.stringify({
  tabs:[{id:'context',title:'Context 配置'},{id:'structure',title:'资源结构'}],
  active:'structure',preview:true,previewPercent:55
 }):null};
 try{
  const html=renderToStaticMarkup(React.createElement(MiddleWorkspace,{parts:parts('ctx-b')}));
  assert.match(html,/Actual Context tree/);
  assert.match(html,/Real Context summary/);
  assert.match(html,/middle-preview-body/);
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
