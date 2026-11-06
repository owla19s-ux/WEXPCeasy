type Reply<T>={ok:true;value:T}|{ok:false;error:string};
type CredentialBridge={target():Promise<Reply<{connectionName:string;provider:string;endpoint:string}>>;submit(secret:string):Promise<Reply<{accepted:true}>>;cancel():Promise<Reply<{accepted:true}>>};
const bridge=(window as Window&{wexCredential:CredentialBridge}).wexCredential;
const form=document.querySelector('form')!,input=document.querySelector<HTMLInputElement>('#secret')!,submit=document.querySelector<HTMLButtonElement>('button[type=submit]')!,message=document.querySelector<HTMLElement>('[role=alert]')!;
document.querySelector('#cancel')!.addEventListener('click',()=>{input.value='';void bridge.cancel();});
form.addEventListener('submit',event=>{
 event.preventDefault();submit.disabled=true;
 const secret=input.value;input.value='';
 void bridge.submit(secret).then(reply=>{if(!reply.ok){message.textContent='保存请求被拒绝，请检查凭证格式。';submit.disabled=false;}},()=>{message.textContent='无法保存凭证，请取消后重试。';});
});
void bridge.target().then(reply=>{
 if(!reply.ok){message.textContent='无法核对目标连接，请取消。';return;}
 for(const [key,value] of Object.entries(reply.value)){const node=document.querySelector('[data-target='+key+']');if(node)node.textContent=value;}
 input.disabled=false;submit.disabled=false;input.focus();
},()=>{message.textContent='凭证窗口不可用，请取消。';});
export {};
