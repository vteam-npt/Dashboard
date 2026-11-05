const {test} = require('node:test');
const assert = require('node:assert/strict');
const {generateKeyPairSync, sign} = require('node:crypto');
const vm = require('node:vm');
const esbuild = require('esbuild');

test('Google token verifier checks signature, key and identity claims', async () => {
  const {verifyGoogleIdToken} = await import('../apps-script/google-token-verifier.js');
  const {publicKey, privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  const jwk = {...publicKey.export({format:'jwk'}), kid:'test-key', alg:'RS256', use:'sig'};
  const jwks = {keys:[jwk]}, audience = 'client-id';
  const claims = {iss:'https://accounts.google.com', aud:audience, sub:'123', email:'STAFF@EXAMPLE.COM', email_verified:true, iat:1700000000, exp:1700003600};
  const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  function token(payload = claims, header = {alg:'RS256', kid:'test-key'}) {
    const body = encode(header)+'.'+encode(payload);
    return body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');
  }
  const now = 1700000100000;
  assert.equal(verifyGoogleIdToken(token(),audience,jwks,now).email,'staff@example.com');
  for (const invalid of [
    {...claims,aud:'other'}, {...claims,iss:'https://evil.example'}, {...claims,exp:1700000000},
    {...claims,email_verified:false}, {...claims,sub:''}, {...claims,azp:'other'}, {...claims,iat:1700000300}
  ]) assert.throws(()=>verifyGoogleIdToken(token(invalid),audience,jwks,now));
  assert.throws(()=>verifyGoogleIdToken(token(claims,{alg:'none',kid:'test-key'}),audience,jwks,now));
  assert.throws(()=>verifyGoogleIdToken(token(claims,{alg:'RS256',kid:'unknown'}),audience,jwks,now));
  const parts=token().split('.'); parts[1]=encode({...claims,sub:'attacker'});
  assert.throws(()=>verifyGoogleIdToken(parts.join('.'),audience,jwks,now));
});

test('bundled verifier runs without Node or browser crypto globals', async () => {
  const build = await esbuild.build({entryPoints:['apps-script/google-token-verifier.js'],bundle:true,format:'iife',globalName:'GoogleTokenVerifier',target:'es2020',write:false});
  const ctx = vm.createContext({Uint8Array});
  vm.runInContext(build.outputFiles[0].text,ctx);
  const {publicKey,privateKey} = generateKeyPairSync('rsa',{modulusLength:2048});
  const jwk = {...publicKey.export({format:'jwk'}),kid:'k'};
  const enc = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  const body=enc({alg:'RS256',kid:'k'})+'.'+enc({iss:'accounts.google.com',aud:'client',sub:'123',email:'user@gmail.com',email_verified:true,iat:1700000000,exp:1700003600});
  const token=body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');
  assert.equal(ctx.GoogleTokenVerifier.verifyGoogleIdToken(token,'client',{keys:[jwk]},1700000100000).sub,'123');
});
