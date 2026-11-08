export interface GitHubFile {owner:string;repo:string;ref:string;path:string}
function validate(file:GitHubFile):void {
 if(!file||typeof file.owner!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(file.owner)||
  typeof file.repo!=='string'||!/^[a-zA-Z0-9_.-]{1,100}$/.test(file.repo)||['.','..'].includes(file.repo)||
  typeof file.ref!=='string'||!file.ref||file.ref.length>255||/[\u0000-\u0020]/.test(file.ref)||
  typeof file.path!=='string'||!file.path||file.path.length>4096||/[\u0000-\u001f\\]/.test(file.path)||
  file.path.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('invalid_github_file_target');
}
/** Opaque exact permission target. A repository, ref and path cannot be retargeted through payload fields. */
export function githubFileTarget(file:GitHubFile):string {
 validate(file);return 'github-file:'+JSON.stringify([file.owner,file.repo,file.ref,file.path]);
}
export function parseGitHubFileTarget(target:string):GitHubFile {
 if(typeof target!=='string'||!target.startsWith('github-file:'))throw Error('invalid_github_file_target');
 const fields:unknown=JSON.parse(target.slice(12));
 if(!Array.isArray(fields)||fields.length!==4)throw Error('invalid_github_file_target');
 const file={owner:fields[0],repo:fields[1],ref:fields[2],path:fields[3]} as GitHubFile;
 if(githubFileTarget(file)!==target)throw Error('noncanonical_github_file_target');
 return file;
}
