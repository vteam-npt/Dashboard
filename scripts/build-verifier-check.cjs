const {generateKeyPairSync, sign} = require('node:crypto');
const fs = require('node:fs');
const esbuild = require('esbuild');
(async()=>{
  const result = await esbuild.build({entryPoints:['apps-script/google-token-verifier.js'],bundle:true,format:'iife',globalName:'GoogleTokenVerifier',target:'es2020',write:false});
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const jwk={...publicKey.export({format:'jwk'}),kid:'runtime-check'};
  const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const body=enc({alg:'RS256',kid:'runtime-check'})+'.'+enc({iss:'accounts.google.com',aud:'test-client',sub:'runtime-test',email:'test@gmail.com',email_verified:true,iat:1700000000,exp:1700003600});
  const token=body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');
  const test=`\nfunction testVerifierRuntime() {\n const identity=GoogleTokenVerifier.verifyGoogleIdToken(${JSON.stringify(token)},'test-client',${JSON.stringify({keys:[jwk]})},1700000100000);\n if(identity.sub !== 'runtime-test') throw Error('Verification failed');\n console.log('Verifier runtime check passed');\n}\n`;
  fs.mkdirSync('artifacts',{recursive:true});
  fs.writeFileSync('artifacts/VerifierRuntimeCheck.gs',result.outputFiles[0].text+test);
})();
