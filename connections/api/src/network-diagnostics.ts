import {object} from './model.js';

/** HTTP/network diagnostics are transport-level, not Provider wire-protocol decoding. */
export function requestCorrelation(response:Response):{providerRequestId?:string}{
 const id=response.headers.get('x-request-id');
 return id&&/^[-a-zA-Z0-9_.:]{1,256}$/.test(id)?{providerRequestId:id}:{};
}

export function failureMetadata(response:Response,token?:string):{httpStatus:number;retryAfterSeconds?:number}{
 const value=response.headers.get('retry-after');
 const seconds=value&&(!token||!value.includes(token))&&/^\d{1,10}$/.test(value)?Number(value):undefined;
 return {httpStatus:response.status,...(seconds===undefined?{}:{retryAfterSeconds:seconds})};
}

export function networkFailure(error:unknown):string|undefined {
 if(!(error instanceof TypeError)||!object(error.cause)&&!(error.cause instanceof Error))return;
 const code=(error.cause as {code?:unknown}).code;
 if(typeof code!=='string')return;
 if(['ENOTFOUND','EAI_AGAIN'].includes(code))return 'provider_dns_failed';
 if(['ECONNREFUSED','ENETUNREACH','EHOSTUNREACH'].includes(code))return 'provider_unreachable';
 if(['CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID'].includes(code))return 'provider_tls_failed';
 if(code==='UND_ERR_CONNECT_TIMEOUT')return 'provider_connect_timeout';
}

export function providerError(status:number):string {
 return status===401||status===403?'provider_authorization':status===429?'provider_rate_limited':status===404?'provider_endpoint_or_model_not_found':status>=300&&status<400?'redirect_refused':'provider_http_error';
}
