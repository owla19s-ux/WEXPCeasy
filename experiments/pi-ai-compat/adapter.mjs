/** Isolated compatibility candidate, not a WEX product implementation.
 * Only Chat Completions is guarded. Dependencies are boundary substitutes.
 * No sessions, auth store, agent loop, tools execution or automatic retries.
 */
import {stream} from '@earendil-works/pi-ai/api/openai-completions';
import {Value} from 'typebox/value';
const fail = code => { throw new Error(code); };
const size = value => Buffer.byteLength(JSON.stringify(value));
export function sealContinuation(scope,payload,maxBytes) {
 if(size(payload)>maxBytes)fail('ContinuationLimit');
 return structuredClone({scope,payload});
}
export function openContinuation(scope,envelope,maxBytes) {
 if(JSON.stringify(scope)!==JSON.stringify(envelope.scope))fail('ContinuationScope');
 if(size(envelope.payload)>maxBytes)fail('ContinuationLimit');
 return structuredClone(envelope.payload);
}
function freezeDeep(value) {
 if(value&&typeof value==='object'){for(const child of Object.values(value))freezeDeep(child);Object.freeze(value);}
 return value;
}
function preflight(r) {
 if(Object.keys(r.model.headers??{}).length||r.model.compat?.supportsFinishReason===false)fail('UnsupportedParameter');
 for(const msg of r.context.messages)if(Array.isArray(msg.content))for(const part of msg.content)
  if(part.type==='image'&&!r.model.input.includes('image'))fail('UnsupportedImage');
 const u=new URL(r.model.baseUrl);
 if(u.username||u.password||u.search||u.hash||!['https:','http:'].includes(u.protocol)||
  (u.protocol==='http:'&&u.hostname!=='127.0.0.1'))fail('Endpoint');
 if(Object.keys(r.model.samplingParams??{}).some(k=>!['top_p'].includes(k)))fail('UnsupportedParameter');
 if(r.proxy)fail('UnsupportedProxy'); // No fake proxy support or fallback to direct network.
 for(const [key,value] of Object.entries(r.params??{})) {
  if(!(r.allowedParams??[]).includes(key))fail('UnsupportedParameter');
  if(['temperature','maxTokens','top_p'].includes(key)&&(!Number.isFinite(value)||value<0))fail('UnsupportedParameter');
  if(key==='reasoningEffort'&&!['off','minimal','low','medium','high','xhigh'].includes(value))fail('UnsupportedParameter');
 }
 for(const t of r.context.tools??[])if(Object.keys(t).some(k=>!['name','description','parameters'].includes(k)))fail('UnsupportedParameter');
}
function rawGuard() {
 let terminal=false;const tools=new Map();let usage;
 return {get usage(){return usage;},get terminal(){return terminal;}, inspect(chunk){
  if(chunk.error)fail('Provider');
  if(chunk.usage)usage=chunk.usage;
  const choices=chunk.choices??[];
  if(choices.length===0)return;
  if(choices.length!==1||choices[0].index!==0)fail('Protocol');
  const c=choices[0],d=c.delta??{};
  if(terminal&&(c.finish_reason||Object.keys(d).length))fail('Protocol');
  if(d.role&&d.role!=='assistant')fail('Protocol');
  for(const t of d.tool_calls??[]) {
   if(!Number.isInteger(t.index)||t.index<0||t.index>tools.size)fail('Protocol');
   const old=tools.get(t.index);
   if(old&&((t.id&&old.id!==t.id)||(t.function?.name&&old.name!==t.function.name)))fail('InvalidTool');
   if(!old)tools.set(t.index,{id:t.id,name:t.function?.name});
  }
  if(c.finish_reason) {
   if(!['stop','tool_calls'].includes(c.finish_reason))fail('Protocol');
   terminal=true;
  }
 }};
}
function raceAbort(p,signal) {
 if(signal.aborted)return Promise.reject(new Error(String(signal.reason)));
 return new Promise((resolve,reject)=>{
  const onAbort=()=>reject(new Error(String(signal.reason)));
  signal.addEventListener('abort',onAbort,{once:true});
  Promise.resolve(p).then(resolve,reject).finally(()=>signal.removeEventListener('abort',onAbort));
 });
}
function guardedFetch(fetcher,r,ac,limits,record) {
 return async(input,init)=>{
  let timer;
  try {
   timer=setTimeout(()=>ac.abort('ConnectTimeout'),r.timeouts?.connect??2000);
   const res=await raceAbort(fetcher(input,{...init,redirect:'manual',signal:ac.signal}),ac.signal);
   clearTimeout(timer);
   record.status=res.status;
   if(res.status>=300&&res.status<400)fail('Redirect');
   if(res.status!==200) {await res.body?.cancel();return new Response('{}',{status:res.status,headers:{'content-type':'application/json'}});}
   if(!res.body)fail('Protocol');
   if(!res.headers.get('content-type')?.includes('text/event-stream')){await res.body.cancel();fail('Provider');}
   const reader=res.body.getReader();let total=0;let pending=Buffer.alloc(0);
   const body=new ReadableStream({async pull(c){
    let idle;
    try {
     idle=setTimeout(()=>ac.abort('IdleTimeout'),r.timeouts?.idle??2000);
     const {value,done}=await raceAbort(reader.read(),ac.signal);clearTimeout(idle);
     if(done){c.close();return;}
     total+=value.byteLength;if(total>limits.responseBytes)fail('ResponseLimit');
     // Frame size counts all raw bytes, including comments, without decoding UTF8 prematurely.
     pending=Buffer.concat([pending,Buffer.from(value)]);
     let match;
     while((match=/\r?\n\r?\n/.exec(pending.toString('latin1')))) {
      const length=match.index+match[0].length;if(length>limits.frameBytes)fail('FrameLimit');
      const raw=pending.subarray(0,match.index).toString('utf8');
      const data=raw.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      try{if(data&&data!=='[DONE]'&&JSON.parse(data).error)fail('Provider');}catch(e){if(e.message==='Provider')throw e;}
      pending=pending.subarray(length);
     }
     if(pending.length>limits.frameBytes)fail('FrameLimit');
     c.enqueue(value);
    }catch(e){clearTimeout(idle);record.error=ac.signal.aborted?String(ac.signal.reason):e.message;ac.abort(record.error);reader.cancel().catch(()=>{});c.error(e);}
   },cancel(){return reader.cancel();}});
   return new Response(body,{status:res.status,headers:res.headers});
  }catch(e){record.error=ac.signal.aborted?String(ac.signal.reason):e.message;throw e;}
  finally{clearTimeout(timer);}
 };
}
export async function candidate(input,services,transport) {
 const r=freezeDeep(structuredClone({...input,signal:undefined})); // Callbacks observe the frozen attempt snapshot.
 const ac=new AbortController();const partial=[];const record={};let totalTimer;
 const cancelled=()=>ac.abort('Cancelled');
 try {
  preflight(r);
  if(input.signal?.aborted)fail('Cancelled');
  input.signal?.addEventListener('abort',cancelled,{once:true});
  // Actual destination and actual content go to the authority; role/context names are not permission.
  if(await services.permissions(r)!==true)fail('Permission');
  if(r.scope.endpoint!==r.model.baseUrl||r.scope.model!==r.model.id)fail('ContinuationScope');
  const apiKey=await services.credentials(r.scope.credentialRef);
  if(!apiKey)fail('Credential');
  try {await services.attempt(r.scope);}catch{fail('AttemptPersistence');}
  totalTimer=setTimeout(()=>ac.abort('TotalTimeout'),r.timeouts?.total??5000);
  const limits={frameBytes:65536,responseBytes:1048576,events:4096,...r.limits};
  const guard=rawGuard();
  const {top_p,...options}=r.params??{};
  const s=stream(r.model,r.context,{...options,...(top_p===undefined?{}:{samplingParams:{top_p}}),apiKey,maxRetries:0,signal:ac.signal,
   fetch:guardedFetch(transport.fetch,r,ac,limits,record),onProviderStreamEvent:chunk=>{try{guard.inspect(chunk);}catch(e){record.error=e.message;throw e;}}});
  for await(const event of s) {
   if(ac.signal.aborted)fail(String(ac.signal.reason));
   if(partial.length>=limits.events){ac.abort('EventLimit');fail('EventLimit');}
   // Drop raw SDK error messages at the boundary. Keep bounded provisional display deltas only.
   if(!['error','done'].includes(event.type))partial.push({type:event.type,...(event.delta===undefined?{}:{delta:event.delta})});
  }
  const message=await s.result();
  if(ac.signal.aborted)fail(String(ac.signal.reason));
  if(record.error)fail(record.error);
  if(record.status===401||record.status===403)fail('Authentication');
  if(record.status===429)fail('RateLimit');
  if(record.status>=400)fail('Provider');
  if(!guard.terminal||!['stop','toolUse'].includes(message.stopReason))fail('Protocol');
  const ids=new Set();
  for(const t of message.content.filter(x=>x.type==='toolCall')) {
   if(t.argumentsError||!t.name||!t.id||ids.has(t.id)||!t.arguments||Array.isArray(t.arguments)||typeof t.arguments!=='object')fail('InvalidTool');
   ids.add(t.id);
   const definitions=r.context.tools;
   if(definitions){const def=definitions.find(d=>d.name===t.name);if(!def||!Value.Check(def.parameters,t.arguments))fail('InvalidTool');}
  }
  // Unknown observation is not replaced by SDK zero-filled accounting; cost is never a bill.
  const result={completed:true,message,usage:guard.usage??null,costSource:'catalog-estimate-not-invoice'};
  try{await services.receipt(r.scope,result);}catch{return {completed:false,error:'ReceiptPersistence',observed:result};}
  return result;
 }catch(e){
  const codes=new Set(['UnsupportedImage','Endpoint','UnsupportedProxy','UnsupportedParameter','Cancelled','Permission','ContinuationScope','Credential','AttemptPersistence','ReceiptPersistence','Protocol','InvalidTool','FrameLimit','ResponseLimit','EventLimit','ConnectTimeout','IdleTimeout','TotalTimeout','Authentication','RateLimit','Provider','Redirect']);
  return {completed:false,error:codes.has(e.message)?e.message:'NetworkUnknown',partial};
 }
 finally{clearTimeout(totalTimer);input.signal?.removeEventListener('abort',cancelled);}
}
