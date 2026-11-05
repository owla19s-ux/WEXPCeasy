export function parseUniqueJson(raw:string):unknown {
 const parsed:unknown=JSON.parse(raw);
 // JSON.parse accepts duplicate keys. A complete, already parsed token stream lets us reject them.
 const stack:{object:boolean;nextKey:boolean;keys:Set<string>}[]=[];
 for(const [token] of raw.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]/g)){
  if(token==='{'||token==='['){if(stack.length>=128)throw Error('provider_json_too_deep');stack.push({object:token==='{',nextKey:token==='{',keys:new Set()});continue;}
  if(token==='}'||token===']'){stack.pop();continue;}
  const top=stack.at(-1);if(token===','&&top?.object){top.nextKey=true;continue;}
  if(token.startsWith('"')&&top?.object&&top.nextKey){const key=JSON.parse(token) as string;if(top.keys.has(key))throw Error('duplicate_json_key');top.keys.add(key);top.nextKey=false;}
 }
 return parsed;
}
