import http from 'node:http';
import { stream } from '@earendil-works/pi-ai/api/openai-completions';
export const model = { id:'manual-text',name:'Manual text (no tools required)',api:'openai-completions',provider:'wex-test',baseUrl:'http://127.0.0.1:1/v1',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:8192,maxTokens:128 };
export const context = {messages:[{role:'user',content:'hello',timestamp:1}]};
export const choice = (delta={},finish_reason=null,extra={}) => ({choices:[{index:0,delta,finish_reason,...extra}]});
export const frame = data => `data: ${JSON.stringify(data)}\n\n`;
export const end = () => frame(choice({},'stop'))+'data: [DONE]\n\n';
export const text = s => frame(choice({content:s}));
export const tool = (args='{}',name='write',id='t1',index=0) => choice({tool_calls:[{index,id,type:'function',function:{name,arguments:args}}]});
export function bytesFetch(body, {status=200,step=1,headers={}}={}) {
  return async () => {
    const b=Buffer.from(body); let offset=0;
    return new Response(new ReadableStream({pull(c){if(offset===b.length){c.close();return;}c.enqueue(b.subarray(offset,offset+=Math.min(step,b.length-offset)));}}), {status,headers:{'content-type':status===200?'text/event-stream':'application/json',...headers}});
  };
}
export async function run(body,{model: m=model,context:c=context,...options}={}) {
  const events=[];
  const s=stream(m,c,{apiKey:'fake-local-only',maxRetries:0,fetch:bytesFetch(body),...options});
  for await(const e of s) events.push(e);
  return {message:await s.result(),events};
}
export async function localServer(handler) {
  const requests=[];
  const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;requests.push({url:req.url,headers:req.headers,body:JSON.parse(body||'{}')});handler(req,res,requests);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/custom/v1`,requests,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
