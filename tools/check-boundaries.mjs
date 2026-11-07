import ts from 'typescript';
import {builtinModules} from 'node:module';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {posix,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
function cycles(nodes,edges){
 const graph=new Map(nodes.map(n=>[n,[]]));for(const [a,b] of edges){if(!graph.has(a))graph.set(a,[]);graph.get(a).push(b);}
 const seen=new Set(),stack=new Set(),bad=[];
 function visit(n){if(stack.has(n)){bad.push(n);return;}if(seen.has(n))return;seen.add(n);stack.add(n);for(const b of graph.get(n)??[])visit(b);stack.delete(n);}
 for(const n of graph.keys())visit(n);return bad;
}
// Concrete connectors are separate owners; the common connections port stays independent.
function owner(file){
 const parts=file.split('/');
 return parts[0]==='connections'&&parts[1]!=='src'&&parts.length>2
  ? 'connections/'+parts[1] : parts[0];
}
export function analyze(files){
 const errors=[],edges=[],moduleEdges=[];const names=Object.keys(files);const fail=(file,code,detail)=>errors.push({file,code,detail});
 for(const [file,text] of Object.entries(files)){
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 for(const d of source.parseDiagnostics)fail(file,'parse_error',ts.flattenDiagnosticMessageText(d.messageText,' '));
 const imports=[];
 function walk(node){
 if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier)imports.push(node.moduleSpecifier);
 if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument))imports.push(node.argument.literal);
 if(ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference)&&node.moduleReference.expression)imports.push(node.moduleReference.expression);
 if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require')))imports.push(node.arguments[0]);
 ts.forEachChild(node,walk);
 }walk(source);
 for(const spec of imports){
 if(!spec||!ts.isStringLiteralLike(spec)){fail(file,'unresolved_dynamic','nonliteral module');continue;}
 const name=spec.text,from=owner(file);
 if(from==='UI'&&(builtinModules.includes(name.replace(/^node:/,''))||name==='electron'||/credentials|storage/.test(name)))fail(file,'renderer_privileged',name);
 if(!name.startsWith('.')){const declared=(from==='connections/github'&&['octokit','@modelcontextprotocol/sdk/client/index.js','@modelcontextprotocol/sdk/client/stdio.js'].includes(name))||(from==='app'&&name==='electron')||(from==='UI'&&['react','react-dom/client','react/jsx-runtime'].includes(name));if(!declared&&!name.startsWith('node:')&&!builtinModules.includes(name.replace(/^node:/,'')))fail(file,'unresolved_import',name);continue;}
 const path=posix.normalize(posix.join(posix.dirname(file),name));
 const target=[path,path.replace(/\.js$/,'.ts'),path.replace(/\.js$/,'.tsx'),path+'/index.ts'].find(p=>Object.hasOwn(files,p));
 if(!target){fail(file,'unresolved_import',name);continue;}
 const to=owner(target);edges.push([file,target]);
 if(from!==to){
 moduleEdges.push([from,to]);
 if(target!==to+'/src/index.ts')fail(file,'private_import',target);
 if(from==='connections'&&to.startsWith('connections/'))fail(file,'reverse_connector',target);
 if(to==='app')fail(file,'reverse_app',target);
 if(from==='shared')fail(file,'shared_business',target);
 if(from==='UI'&&(['shared','permissions','connections','app'].includes(to)||to.startsWith('connections/')))fail(file,'renderer_privileged',target);
 }
 }
 }
 if(!edges.length)fail('<graph>','empty_graph','no source dependency edges');
 for(const n of cycles(names,edges))fail(n,'file_cycle',n);
 for(const n of cycles([...new Set(names.map(owner))],moduleEdges))fail(n,'module_cycle',n);
 return {files:names.length,edges,moduleEdges,errors};
}
const domains=['app','shared','permissions','space','AI','conversations','connections','workflows','views','UI','plugins','accounts','environments'];
export function readProductSources(root){
 const files={};
 function walk(dir){for(const e of readdirSync(resolve(root,dir),{withFileTypes:true})){
 if(['tests','experiment','experiments','prototype','node_modules','dist','upstream'].includes(e.name))continue;
 const p=posix.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(?:ts|tsx|mts|js|mjs)$/.test(p)&&!p.endsWith('.d.ts'))files[p]=readFileSync(resolve(root,p),'utf8');
 }}
 for(const d of domains)if(existsSync(resolve(root,d)))walk(d);return files;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=analyze(readProductSources(process.cwd()));console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
}
