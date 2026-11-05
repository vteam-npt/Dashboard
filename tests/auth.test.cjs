const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const users = [{user_id:'admin',email:'owner@gmail.com',google_sub:'',role:'ADMIN',active:true}];
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync('apps-script/Backend.gs','utf8')+'\n'+fs.readFileSync('apps-script/Auth.gs','utf8'),ctx);
  ctx.rows_ = () => users;
  ctx.save_ = (_,__,user) => user;
  return {ctx,users};
}
test('pre-provisioned owner binds once to verified Google subject',()=>{
  const {ctx,users} = fixture();
  const user = ctx.actorForIdentity_(null,{sub:'subject',email:'owner@gmail.com'});
  assert.equal(user.google_sub,'subject');
  assert.equal(ctx.actorForIdentity_(null,{sub:'subject',email:'different@gmail.com'}).user_id,'admin');
  assert.throws(()=>ctx.actorForIdentity_(null,{sub:'other',email:'owner@gmail.com'}));
  users[0].active=false;
  assert.throws(()=>ctx.actorForIdentity_(null,{sub:'subject',email:'owner@gmail.com'}));
});
test('non-Google-hosted email cannot claim a pre-provisioned account',()=>{
  const {ctx,users} = fixture(); users[0].email='owner@example.com';
  assert.throws(()=>ctx.actorForIdentity_(null,{sub:'subject',email:'owner@example.com'}));
  assert.equal(ctx.actorForIdentity_(null,{sub:'subject',email:'owner@example.com',hosted_domain:'example.com'}).user_id,'admin');
});

test('sessions store hashes, enforce revoked users, and revoke on logout',()=>{
 const crypto=require('node:crypto'),{ctx,users}=fixture();const sessions=[];
 ctx.Utilities={DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},computeDigest:(_,value)=>Array.from(crypto.createHash('sha256').update(value).digest())};
 ctx.sessionSheet_=()=>({});ctx.rows_=(_,name)=>name==='Sessions'?sessions:users;ctx.save_=(_,name,row)=>{if(name==='Sessions'){const i=sessions.findIndex(s=>s.session_hash===row.session_hash);if(i<0)sessions.push(row);else sessions[i]=row;}return row;};
 users[0].google_sub='subject';const token='vivo1.'+'a'.repeat(43),now=new Date('2026-11-05T00:00:00Z');
 const created=ctx.startSession_(null,users[0],token,now);assert.equal(sessions.length,1);assert.notEqual(sessions[0].session_hash,token);assert.equal(ctx.sessionActor_(null,token,now).user_id,'admin');
 assert.throws(()=>ctx.sessionActor_(null,'vivo1.'+'b'.repeat(43),now));assert.equal(ctx.sessionActor_(null,token,new Date('2040-01-01T00:00:00Z')).user_id,'admin');
 users[0].active=false;assert.throws(()=>ctx.sessionActor_(null,token,now));users[0].active=true;
 ctx.endSession_(null,token);assert.throws(()=>ctx.sessionActor_(null,token,now));
});

test('Google login can create session and bootstrap in one request for an active user only',()=>{
 const {ctx,users}=fixture();const actor=users[0];actor.google_sub='verified';let created=0;
 ctx.googleIdentity_=()=>({sub:'verified',email:'owner@gmail.com'});ctx.database_=()=>({});ctx.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};ctx.SpreadsheetApp={flush(){}};
 ctx.startSession_=(_,user,secret)=>{assert.equal(user.user_id,'admin');assert.match(secret,/^vivo1\./);created++;};ctx.bootstrap_=(_,user,p)=>({actor:{user_id:user.user_id},month:p.month,static_catalog:p.static_catalog});
 const result=ctx.authenticatedApi('google-id-token','identityStatus',{secret:'vivo1.'+'a'.repeat(43),month:'2026-11',static_catalog:true});assert.equal(result.data.data.static_catalog,true);assert.equal(result.ok,true);assert.equal(result.data.status,'ACTIVE');assert.equal(result.data.data.actor.user_id,'admin');assert.equal(created,1);
 ctx.googleIdentity_=()=>({sub:'unknown',email:'new@gmail.com'});ctx.rows_=()=>[];const pending=ctx.authenticatedApi('another-token','identityStatus',{secret:'vivo1.'+'b'.repeat(43),month:'2026-11'});assert.equal(pending.data.status,'NEW');assert.equal(created,1);
});
