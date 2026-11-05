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
