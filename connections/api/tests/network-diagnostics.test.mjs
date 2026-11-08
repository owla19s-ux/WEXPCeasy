import test from 'node:test';
import assert from 'node:assert/strict';
import {requestCorrelation,failureMetadata,networkFailure,providerError} from '../../../dist/connections/api/src/network-diagnostics.js';

test('network diagnostics classify HTTP errors without exposing provider bodies',()=>{
 assert.equal(providerError(401),'provider_authorization');
 assert.equal(providerError(403),'provider_authorization');
 assert.equal(providerError(404),'provider_endpoint_or_model_not_found');
 assert.equal(providerError(429),'provider_rate_limited');
 assert.equal(providerError(302),'redirect_refused');
 assert.equal(providerError(503),'provider_http_error');
});

test('response diagnostics retain only safe request correlation and numeric Retry-After',()=>{
 const response=new Response(null,{status:429,headers:{'x-request-id':'req-123','retry-after':'12'}});
 assert.deepEqual(requestCorrelation(response),{providerRequestId:'req-123'});
 assert.deepEqual(failureMetadata(response),{httpStatus:429,retryAfterSeconds:12});
 assert.deepEqual(requestCorrelation(new Response(null,{headers:{'x-request-id':'not allowed / path'}})),{});
 assert.deepEqual(failureMetadata(new Response(null,{status:429,headers:{'retry-after':'Wed, 01 Jan 2025 00:00:00 GMT'}})),{httpStatus:429});
 assert.deepEqual(failureMetadata(new Response(null,{status:429,headers:{'retry-after':'my-secret'}}),'my-secret'),{httpStatus:429});
});

test('network errors retain separate DNS, TLS and connection diagnostics',()=>{
 const error=(code)=>new TypeError('fetch failed',{cause:Object.assign(new Error('network failure'),{code})});
 assert.equal(networkFailure(error('ENOTFOUND')),'provider_dns_failed');
 assert.equal(networkFailure(error('ECONNREFUSED')),'provider_unreachable');
 assert.equal(networkFailure(error('ERR_TLS_CERT_ALTNAME_INVALID')),'provider_tls_failed');
 assert.equal(networkFailure(error('UND_ERR_CONNECT_TIMEOUT')),'provider_connect_timeout');
 assert.equal(networkFailure(error('OTHER')),undefined);
 assert.equal(networkFailure(new Error('failed')),undefined);
});
