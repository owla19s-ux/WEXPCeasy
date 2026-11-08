import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopLifecycle} from '../../dist/app/src/desktop-lifecycle.js';
import {createDesktopGateway,createDesktopBusinessGate} from '../../dist/app/src/desktop-gateway.js';
test('desktop startup is single flight; quit waits for pending provider',async()=>{
 let resolve,calls=0,stops=0;const pending=new Promise(r=>resolve=r);
 const life=createDesktopLifecycle(()=>{calls++;return pending;});
 const first=life.start();assert.equal(life.start(),first);
 const stopping=life.stop();assert.equal(life.stop(),stopping);
 await Promise.resolve();assert.equal(calls,1);assert.equal(stops,0);
 resolve({stop:async()=>{stops++;return {status:'stopped',failed:[]};}});
 assert.equal((await stopping).status,'stopped');assert.equal(stops,1);
 assert.equal(await life.start(),undefined);
});
test('desktop incomplete release remains retryable without restarting provider',async()=>{
 let stops=0,starts=0;const life=createDesktopLifecycle(async()=>{starts++;return {stop:async()=>++stops===1?{status:'incomplete',failed:['root-lock']}:{status:'stopped',failed:[]}};});
 await life.start();assert.equal((await life.stop()).status,'incomplete');
 assert.equal((await life.stop()).status,'stopped');assert.equal(starts,1);
});
test('desktop rejected provider never reports released',async()=>{
 const life=createDesktopLifecycle(async()=>{throw Error('private path');});
 await assert.rejects(life.start());assert.deepEqual(await life.stop(),{status:'incomplete',failed:['startup-or-release']});
});
test('desktop quit before startup cannot start providers',async()=>{
 let starts=0;const life=createDesktopLifecycle(async()=>{starts++;});
 assert.equal((await life.stop()).status,'stopped');assert.equal(await life.start(),undefined);assert.equal(starts,0);
});
test('desktop IPC binds to exact live main frame and accepts empty records only',()=>{
 const frame={url:'file:///app/index.html'};let destroyed=false,reads=0;
 const sender={mainFrame:frame,isDestroyed:()=>destroyed};
 const gateway=createDesktopGateway({sender,url:frame.url,read:()=>{reads++;return {status:'ready'};}});
 const event={sender,senderFrame:frame};assert.deepEqual(gateway(event,{}),{ok:true,value:{status:'ready'}});
 for(const payload of [null,[],false,{action:'grant'},Object.create({inherited:true})])assert.equal(gateway(event,payload).error,'invalid_request');
 for(const bad of [{sender:{},senderFrame:frame},{sender,senderFrame:{url:frame.url}},{sender,senderFrame:null}])assert.equal(gateway(bad,{}).error,'untrusted_sender');
 frame.url+='?injected';assert.equal(gateway(event,{}).error,'untrusted_sender');frame.url='file:///app/index.html';
 destroyed=true;assert.equal(gateway(event,{}).error,'untrusted_sender');assert.equal(reads,1);
});
test('desktop IPC does not serialize private exceptions',()=>{
 const frame={url:'file:///app/index.html'},sender={mainFrame:frame,isDestroyed:()=>false};
 const gateway=createDesktopGateway({sender,url:frame.url,read(){throw Error('/secret/token');}});
 assert.deepEqual(gateway({sender,senderFrame:frame},{}),{ok:false,error:'host_unavailable'});
});

test('desktop IPC rejects throwing payload traps without exposing exceptions',()=>{
 const frame={url:'file:///app/index.html'},sender={mainFrame:frame,isDestroyed:()=>false};
 const gateway=createDesktopGateway({sender,url:frame.url,read:()=>({status:'ready'})});
 const event={sender,senderFrame:frame};
 for(const payload of [new Proxy({}, {getPrototypeOf(){throw Error('private payload');}}),new Proxy({}, {ownKeys(){throw Error('private keys');}})]){
  assert.deepEqual(gateway(event,payload),{ok:false,error:'invalid_request'});
 }
});

test('desktop IPC rejects malformed events before accessing host state',()=>{
 const frame={url:'file:///app/index.html'},sender={mainFrame:frame,isDestroyed:()=>false};
 let reads=0;
 const gateway=createDesktopGateway({sender,url:frame.url,read:()=>{reads++;return true;}});
 assert.deepEqual(gateway(null,{}),{ok:false,error:'untrusted_sender'});
 const hostile={get senderFrame(){throw Error('secret frame');},sender};
 assert.deepEqual(gateway(hostile,{}),{ok:false,error:'untrusted_sender'});
 assert.equal(reads,0);
});

test('business IPC admission rejects non-live phases without evaluating business payload',()=>{
 const frame={url:'file:///app/index.html'},sender={mainFrame:frame,isDestroyed:()=>false};
 let phase='starting',calls=0;
 const gate=createDesktopBusinessGate({sender,url:frame.url,isReady:()=>{calls++;return phase==='ready'||phase==='degraded';}});
 const event={sender,senderFrame:frame};
 assert.deepEqual(gate(event),{ok:false,error:'host_unavailable'});
 phase='ready';assert.deepEqual(gate(event),{ok:true,value:true});
 phase='degraded';assert.deepEqual(gate(event),{ok:true,value:true});
 phase='stopping';assert.deepEqual(gate(event),{ok:false,error:'host_unavailable'});
 assert.deepEqual(gate({sender:{},senderFrame:frame}),{ok:false,error:'untrusted_sender'});
 assert.equal(calls,4,'untrusted sender must not reach host phase');
});
test('business IPC admission fails closed if host phase inspection fails',()=>{
 const frame={url:'file:///app/index.html'},sender={mainFrame:frame,isDestroyed:()=>false};
 const gate=createDesktopBusinessGate({sender,url:frame.url,isReady(){throw Error('private phase');}});
 assert.deepEqual(gate({sender,senderFrame:frame}),{ok:false,error:'host_unavailable'});
});
