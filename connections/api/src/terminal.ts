export class ProviderTerminalError extends Error {
 constructor(readonly reason:'provider_output_truncated'|'provider_content_filtered'|'provider_refusal'){
  super(reason);
 }
}

export function checkFinishReason(reason:unknown):void {
 if(reason==='length')throw new ProviderTerminalError('provider_output_truncated');
 if(reason==='content_filter')throw new ProviderTerminalError('provider_content_filtered');
}

export function checkRefusal(value:unknown):void {
 if(value===undefined||value===null||value==='')return;
 if(typeof value!=='string')throw Error('invalid_provider_refusal');
 throw new ProviderTerminalError('provider_refusal');
}
