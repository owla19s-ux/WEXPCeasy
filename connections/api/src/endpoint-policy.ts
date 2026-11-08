export type EndpointMode='base'|'request';
export type EndpointValidation=
 | {status:'ok';url:string}
 | {status:'invalid_endpoint'|'ambiguous_endpoint'};

/** Pure URL policy: remote endpoints require HTTPS; HTTP is accepted only on loopback. */
export function validateApiEndpoint(value:string,mode:EndpointMode):EndpointValidation {
 let url:URL;
 try{url=new URL(value);}catch{return {status:'invalid_endpoint'};}
 if(url.username||url.password||url.search||url.hash
  ||!['https:','http:'].includes(url.protocol)
  ||(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))){
  return {status:'invalid_endpoint'};
 }
 if(mode==='base'&&url.pathname.replace(/\/$/,'').endsWith('/chat/completions')){
  return {status:'ambiguous_endpoint'};
 }
 return {status:'ok',url:url.href};
}
