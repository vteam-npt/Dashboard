const {test} = require('node:test');
const assert = require('node:assert/strict');

test('registration gateway keeps credentials in memory and clears them on failure or sign-out',async()=>{
 const {createRegistrationGateway} = await import('../src/registrationGateway.js');
 const calls=[];
 global.window={};
 const gateway=createRegistrationGateway(async request=>{calls.push(request);if(request.credential==='bad')throw Error('invalid');return {status:'ACTIVE'};});
 await assert.rejects(gateway.status(),/เข้าสู่ระบบ/);
 await assert.rejects(gateway.signIn('bad'),/invalid/);
 await assert.rejects(gateway.status(),/เข้าสู่ระบบ/);
 await gateway.signIn('valid');
 await gateway.register({name:'Tester'});
 assert.equal(calls[2].credential,'valid');
 assert.equal(calls[2].action,'register');
 gateway.signOut();
 await assert.rejects(gateway.status(),/เข้าสู่ระบบ/);
 delete global.window;
});

test('expired credential is rejected before any backend call',async()=>{
 const {createRegistrationGateway}=await import('../src/registrationGateway.js');
 global.window={atob:global.atob};let calls=0;
 const gateway=createRegistrationGateway(async()=>{calls++;return {status:'ACTIVE'};});
 const payload=Buffer.from(JSON.stringify({exp:1})).toString('base64url');
 await assert.rejects(gateway.signIn(`e.${payload}.s`),/หมดอายุ/);
 assert.equal(calls,0);delete global.window;
});
