import test from 'node:test';
import assert from 'node:assert/strict';
import {createWindowsCredentialCipher} from '../../dist/app/src/desktop-credentials.js';
test('Windows credential cipher requires the OS backend and never enables a weak fallback',()=>{
 let encrypts=0;const native={isEncryptionAvailable:()=>true,encryptString(value){encrypts++;return Buffer.from('encrypted:'+value);},decryptString(value){return value.toString().slice(10);}};
 const unsupported=createWindowsCredentialCipher(native,'linux');
 assert.equal(unsupported.available(),false);assert.throws(()=>unsupported.seal('fixture'));assert.equal(encrypts,0);
 const offline=createWindowsCredentialCipher({...native,isEncryptionAvailable:()=>false},'win32');
 assert.equal(offline.available(),false);assert.throws(()=>offline.seal('fixture'));assert.equal(encrypts,0);
});
test('Windows cipher encodes opaque OS ciphertext and rejects malformed stored bytes',()=>{
 const native={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from('encrypted:'+value),decryptString:value=>value.toString().slice(10)};
 const cipher=createWindowsCredentialCipher(native,'win32');const value=cipher.seal('fixture-only');
 assert.equal(cipher.available(),true);assert.equal(value.includes('fixture-only'),false);assert.equal(cipher.unseal(value),'fixture-only');
 assert.throws(()=>cipher.unseal('invalid base64!'));assert.throws(()=>cipher.unseal(''));
});
