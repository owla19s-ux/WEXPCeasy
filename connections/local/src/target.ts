export function localFileTarget(id:string):string {
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw Error('invalid_local_file_target');
 return 'local-file:'+id;
}
export function validateLocalFileTarget(target:string):void {
 if(typeof target!=='string'||!target.startsWith('local-file:')||localFileTarget(target.slice(11))!==target)throw Error('invalid_local_file_target');
}
