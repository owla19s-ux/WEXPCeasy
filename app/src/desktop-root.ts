import {lstatSync,realpathSync,readFileSync,readdirSync,mkdirSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
import {join,relative,isAbsolute,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
export interface DesktopRoot {path:string;id:string}
export interface RootChoice {path:string;create:boolean}
const locatorName='.wex-launch.json',markerName='.wex-root.json';
function readRecord(path:string):Record<string,unknown>{
 const info=lstatSync(path);if(info.isSymbolicLink()||!info.isFile()||info.size>16384)throw Error('invalid_root_record');
 const value:unknown=JSON.parse(readFileSync(path,'utf8'));
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_root_record');return value as Record<string,unknown>;
}
function id(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=4096;}
function directory(path:string):string{
 if(typeof path!=='string'||!isAbsolute(path))throw Error('absolute_directory_required');
 const info=lstatSync(path);if(info.isSymbolicLink()||!info.isDirectory())throw Error('regular_directory_required');return realpathSync(path);
}
function contained(parent:string,child:string){const rel=relative(parent,child);return rel===''||rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);}
function rootAt(path:string,installation:string,create:boolean):DesktopRoot{
 const actual=directory(path),install=directory(installation);
 if(contained(install,actual)||contained(actual,install))throw Error('installation_and_data_must_be_separate');
 if(create){
  if(readdirSync(actual).length!==0)throw Error('new_root_requires_empty_directory');
  const file=openSync(join(actual,markerName),'wx',0o600);
  try{writeFileSync(file,JSON.stringify({format:1,id:randomUUID()}));fsyncSync(file);}finally{closeSync(file);}
 }
 const record=readRecord(join(actual,markerName));
 if(record.format!==1)throw Error('unsupported_root_format');if(!id(record.id))throw Error('invalid_root_identity');
 return {path:actual,id:record.id};
}
function saveLocator(installation:string,root:DesktopRoot){
 const path=join(installation,locatorName);
 try{const info=lstatSync(path);if(info.isSymbolicLink()||!info.isFile())throw Error('unsafe_root_locator');}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const temp=join(installation,'.wex-launch-'+randomUUID()+'.tmp');
 const fd=openSync(temp,'wx',0o600);
 try{writeFileSync(fd,JSON.stringify({format:1,...root}));fsyncSync(fd);}finally{closeSync(fd);}
 try{renameSync(temp,path);}finally{try{unlinkSync(temp);}catch{/* own temporary file was renamed */}}
}
/** Pre-ready bootstrap only. Domain stores and authorization are opened by startFoundations later.
 * Losing this removable locator never loses root identity; existing directories are never initialized.
 */
export function selectDesktopRoot(options:{args:readonly string[];installationRoot:string;choose:(reason:'first-run'|'recovery')=>RootChoice|undefined}):DesktopRoot|undefined{
 const install=directory(options.installationRoot),args=[...options.args];
 if(args.length){
  if(args.length!==2||args[0]!=='--data-root'||!args[1])throw Error('invalid_startup_arguments');
  return rootAt(args[1],install,false);
 }
 let reason:'first-run'|'recovery'='first-run';
 try{
  const saved=readRecord(join(install,locatorName));reason='recovery';
  if(saved.format!==1||typeof saved.path!=='string'||!id(saved.id))throw Error('invalid_root_locator');
  const root=rootAt(saved.path,install,false);if(root.id!==saved.id)throw Error('root_identity_conflict');return root;
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT'||reason==='recovery')reason='recovery';}
 const choice=options.choose(reason);if(!choice)return;
 if(typeof choice.create!=='boolean')throw Error('invalid_root_choice');
 const root=rootAt(choice.path,install,choice.create);saveLocator(install,root);return root;
}
export function desktopCachePaths(root:DesktopRoot){
 const path=directory(root.path);
 const marker=readRecord(join(path,markerName));if(marker.format!==1||marker.id!==root.id)throw Error('root_identity_conflict');
 return (['userData','sessionData','crashDumps'] as const).map((name,i)=>{
  const folder=['electron-user','electron-session','electron-crashes'][i]!,target=join(path,folder);
  try{mkdirSync(target);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  const actual=directory(target);if(!contained(path,actual))throw Error('unsafe_cache_location');
  return {name,path:actual};
 });
}
