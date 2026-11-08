import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
test('GitHub tool UI makes explicit invocation available without exposing host credentials',async()=>{
 const {GitHubTools}=await import('../../dist/UI/src/github-tools.js');
 const html=renderToStaticMarkup(React.createElement(GitHubTools,{bridge:{onAccessChanged:()=>()=>{}},connectionId:'gh',revision:2,enabled:true,runtimeConfigured:true}));
 assert.match(html,/读取官方工具目录/);assert.doesNotMatch(html,/Token|可执行文件|process|credentialRef/);
});
test('GitHub tool UI reports an unconfigured runtime',async()=>{
 const {GitHubTools}=await import('../../dist/UI/src/github-tools.js');
 const html=renderToStaticMarkup(React.createElement(GitHubTools,{bridge:{onAccessChanged:()=>()=>{}},connectionId:'gh',revision:2,enabled:true,runtimeConfigured:false}));
 assert.match(html,/未装配/);assert.match(html,/disabled/);
});
