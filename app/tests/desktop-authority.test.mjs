import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
import {createDesktopAuthority} from '../../dist/app/src/desktop-authority.js';
test('one trusted window shares an actor across concrete modules but scopes require native consent',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wex-authority-'));await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const authority=createDesktopAuthority(),host=await startFoundations({dataRoot:root,...authority.policy});authority.attach(host);
 t.after(async()=>{authority.close();await host.stop();await rm(root,{recursive:true,force:true});});
 const a={resource:'space',action:'context.list',target:'root:root',context:null},b={resource:'connections/api',action:'connection.list',target:'api:connections',context:null};
 assert.throws(()=>authority.permit(a));assert.equal(authority.bind(a),undefined);
 await authority.run(async()=>{assert.equal(await authority.confirm(async()=>false,'decline'),false);assert.throws(()=>authority.permit(a));});
 await authority.run(async()=>{assert.equal(await authority.confirm(async()=>true,'fixture native consent'),true);authority.permit(a);authority.permit(b);});
 const ra=authority.bind(a),rb=authority.bind(b),da=host.permissions.evaluate(ra),db=host.permissions.evaluate(rb);
 assert.equal(da.status,'allow');assert.equal(db.status,'allow');assert.equal(da.scope.entry,db.scope.entry);assert.equal(da.scope.relationship,db.scope.relationship);
 assert.equal(authority.owns(ra,'space'),true);assert.equal(authority.owns(ra,'connections/api'),false);
 authority.close();assert.notEqual(host.permissions.evaluate(ra).status,'allow');
});
test('window operation admission and late consent fail closed on shutdown',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wex-authority-close-'));await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const authority=createDesktopAuthority(),host=await startFoundations({dataRoot:root,...authority.policy});authority.attach(host);
 let resolveConsent,entered;const entering=new Promise(r=>entered=r);
 try{
  const first=authority.run(async()=>authority.confirm(()=>{entered();return new Promise(r=>resolveConsent=r);},'pending'));
  await entering;assert.equal(await authority.run(async()=>true),undefined);authority.close();resolveConsent(true);assert.equal(await first,false);
  assert.throws(()=>authority.permit({resource:'space',action:'context.list',target:'root:root',context:null}));
 }finally{await host.stop();await rm(root,{recursive:true,force:true});}
});
