import {app} from 'electron';
import {lstatSync,readFileSync,realpathSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startFoundations} from './foundations.js';
import {runDesktop} from './desktop-runtime.js';
// Pre-ready cache placement only. startFoundations remains the final root/lock authority.
function selectedRoot(){
 const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--data-root'||!args[1])throw Error('existing_data_root_required');
 const root=realpathSync(args[1]);if(!lstatSync(root).isDirectory())throw Error('invalid_root');
 const markerPath=join(root,'.wex-root.json'),stat=lstatSync(markerPath);
 if(stat.isSymbolicLink()||!stat.isFile())throw Error('invalid_root');
 const marker=JSON.parse(readFileSync(markerPath,'utf8')) as {format?:unknown;id?:unknown};
 if(!marker||marker.format!==1||typeof marker.id!=='string'||!marker.id)throw Error('invalid_root');
 for(const [name,folder] of [['userData','electron-user'],['sessionData','electron-session'],['crashDumps','electron-crashes']] as const){
  const path=join(root,folder);
  try{const info=lstatSync(path);if(info.isSymbolicLink()||!info.isDirectory())throw Error('unsafe_cache');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;mkdirSync(path);}
  app.setPath(name,path);
 }
 return {path:root,id:marker.id};
}
try{
 app.enableSandbox();
 const root=selectedRoot();
 const assets=new URL('../../../desktop-dist/',import.meta.url);
 void runDesktop({url:new URL('index.html',assets).href,preload:fileURLToPath(new URL('preload.cjs',assets)),spaceRootId:root.id,
  start:policy=>startFoundations({dataRoot:root.path,expectedRootId:root.id,
   trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false},
   space:{},api:{},conversations:true,ai:{bindRead:()=>undefined},localFiles:{},localDirectories:{},
   technicalDiagnostics:{},...policy})}).catch(()=>{console.error('desktop_start_failed');app.exit(1);});
}catch{console.error('desktop_start_failed: use --data-root with an existing WEX data root');app.exit(1);}
