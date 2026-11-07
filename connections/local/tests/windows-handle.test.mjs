import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rename,rm,symlink,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openWindowsSelection} from '../../../dist/connections/local/src/windows-handle.js';
test('Windows native selected file pins identity and supports bounded descriptor IO', {skip:process.platform!=='win32'},async t=>{
 const root=await mkdtemp(join(tmpdir(),'wex-native-file-')),path=join(root,'中文 file.txt');
 await writeFile(path,'original');
 let handle;
 try{
  const expected=await stat(path,{bigint:true});handle=await openWindowsSelection(path,'file','write');
  const actual=await handle.stat({bigint:true});assert.equal(actual.dev,expected.dev);assert.equal(actual.ino,expected.ino);assert.equal(actual.isFile(),true);
  const bytes=Buffer.alloc(8);assert.equal((await handle.read(bytes,0,8,0)).bytesRead,8);assert.equal(bytes.toString(),'original');
  await assert.rejects(rename(path,path+'.moved'));
  assert.equal((await handle.write(Buffer.from('new'),0,3,0)).bytesWritten,3);await handle.truncate(3);await handle.sync();
  await handle.close();handle=undefined;assert.equal(await readFile(path,'utf8'),'new');
 }finally{await handle?.close();await rm(root,{recursive:true,force:true});}
});
test('Windows native directory enumerates the selected handle and never follows a junction', {skip:process.platform!=='win32'},async()=>{
 const root=await mkdtemp(join(tmpdir(),'wex-native-dir-')),path=join(root,'selected'),outside=join(root,'outside');
 await mkdir(path);await mkdir(outside);await writeFile(join(path,'中文.txt'),'selected');await writeFile(join(outside,'private.txt'),'outside');
 await symlink(outside,join(path,'junction'),'junction');
 let handle;
 try{
  const expected=await stat(path,{bigint:true});handle=await openWindowsSelection(path,'directory','read');
  const actual=await handle.stat({bigint:true});assert.equal(actual.dev,expected.dev);assert.equal(actual.ino,expected.ino);assert.equal(actual.isDirectory(),true);
  const entries=[];for(let n=0;n<10;n++){const entry=await handle.readDirectory();if(entry===null)break;entries.push(entry);}
  assert.deepEqual(entries.sort((a,b)=>a.name<b.name?-1:1),[{name:'junction',kind:'symlink'},{name:'中文.txt',kind:'file'}]);
  await assert.rejects(openWindowsSelection(join(path,'junction'),'directory','read'));
  await assert.rejects(rename(path,path+'.moved'));
 }finally{await handle?.close();await rm(root,{recursive:true,force:true});}
});
