import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopFailure} from '../../dist/app/src/desktop-failure.js';
test('renderer failure seals immediately, owns pending release and cannot restart before confirmed stop',async()=>{
 const events=[];let release;const pending=new Promise(r=>release=r);
 const f=createDesktopFailure({seal:()=>events.push('seal'),record:()=>events.push('record'),publish:s=>events.push(s.release),
  stop:()=>pending,choose:async()=>{events.push('choose');return 'restart';},exit:restart=>events.push(restart?'restart':'exit')});
 const first=f.fail('renderer-process-gone');assert.equal(f.fail('web-contents-destroyed'),first);
 assert.ok(events.includes('seal'));assert.ok(events.includes('record'));assert.equal(events.includes('choose'),false);
 release({status:'stopped',failed:[]});assert.equal((await first).release,'stopped');
 assert.equal(events.filter(e=>e==='seal').length,1);assert.equal(events.filter(e=>e==='record').length,1);
 assert.ok(events.indexOf('stopped')<events.indexOf('restart'));
});
test('incomplete release never permits restart or implicit retries',async()=>{
 let calls=0,exits=0;
 const f=createDesktopFailure({seal(){},record(){},publish(){},stop:async()=>{calls++;return {status:'incomplete',failed:['root-lock']};},
  choose:async()=> 'restart',exit(){exits++;}});
 const result=await f.fail('renderer-process-gone');assert.equal(result.release,'incomplete');assert.equal(calls,1);assert.equal(exits,0);
 await f.fail('renderer-process-gone');assert.equal(calls,1);
});
test('only an explicit retry repeats release; a fresh provider is never started',async()=>{
 let calls=0;const exits=[];
 const f=createDesktopFailure({seal(){},record(){},publish(){},stop:async()=>++calls===1?{status:'incomplete',failed:['sqlite']}:{status:'stopped',failed:[]},
  choose:async s=>s.release==='incomplete'?'retry-release':'quit',exit:restart=>exits.push(restart)});
 assert.equal((await f.fail('web-contents-destroyed')).release,'stopped');assert.equal(calls,2);assert.deepEqual(exits,[false]);
});
test('diagnostic or native-dialog failures cannot bypass sealing and ownership',async()=>{
 let sealed=0,stops=0,exits=0;
 const f=createDesktopFailure({seal(){sealed++;},record(){throw Error('private token');},publish(){},stop:async()=>{stops++;return {status:'stopped',failed:[]};},
  choose:async()=>{throw Error('private path');},exit(){exits++;}});
 const result=await f.fail('bridge-setup-failed');
 assert.equal(sealed,1);assert.equal(stops,1);assert.equal(exits,0);assert.equal(result.release,'stopped');assert.equal(JSON.stringify(result).includes('private'),false);
});
