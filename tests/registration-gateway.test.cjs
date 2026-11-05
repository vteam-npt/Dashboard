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

test('restores a verified session after refresh and clears it on sign-out',async()=>{
 const {createRegistrationGateway}=await import('../src/registrationGateway.js');
 const values=new Map();
 global.window={atob:global.atob,sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 const token=`e.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.s`;
 let calls=0;const transport=async ({credential,action})=>{assert.equal(credential,token);assert.equal(action,'identityStatus');calls++;return {status:'ACTIVE'};};
 const first=createRegistrationGateway(transport);await first.signIn(token);
 const refreshed=createRegistrationGateway(transport);assert.equal((await refreshed.restore()).status,'ACTIVE');assert.equal(calls,2);
 refreshed.signOut();assert.equal(await createRegistrationGateway(transport).restore(),null);
 delete global.window;
});

test('expired saved session is removed without contacting server',async()=>{
 const {createRegistrationGateway}=await import('../src/registrationGateway.js');
 const values=new Map([['vivo-google-credential',`e.${Buffer.from(JSON.stringify({exp:1})).toString('base64url')}.s`]]);
 global.window={atob:global.atob,sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 let calls=0;const gateway=createRegistrationGateway(async()=>{calls++;});
 await assert.rejects(gateway.restore(),/หมดอายุ/);assert.equal(calls,0);assert.equal(values.size,0);delete global.window;
});
