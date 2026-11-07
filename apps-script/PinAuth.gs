// PIN accounts are approved by an administrator. These helpers require the script lock.
function pinSheet_(db,name,headers){let sheet=db.getSheetByName(name);if(!sheet){sheet=db.insertSheet(name);sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);sheet.protect().setDescription('Application authentication: managed by dashboard');}return sheet;}
function ensurePinSchema_(db){pinSheet_(db,'PinApplications',['request_id','email','name','branch_name','manager_id','requested_role','existing_user_id','salt','pin_hash','status','created_at','reviewed_by','reviewed_at']);pinSheet_(db,'PinCredentials',['user_id','salt','pin_hash','failures','locked_until']);}
function pinSecret_(){const props=PropertiesService.getScriptProperties();let secret=props.getProperty('PIN_SERVER_SECRET');if(!secret){secret=Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid();props.setProperty('PIN_SERVER_SECRET',secret);}return secret;}
function pinDigest_(pin,salt){const bytes=Utilities.computeHmacSha256Signature(String(pin)+'|'+salt,pinSecret_(),Utilities.Charset.UTF_8);return bytes.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
function pinValid_(pin){return typeof pin==='string'&&/^\d{6,8}$/.test(pin);}
function pinEmail_(value){const email=text_(value,200).toLowerCase();assert_(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'อีเมลไม่ถูกต้อง');return email;}
function pinApply_(db,p,now){
 ensurePinSchema_(db);const email=pinEmail_(p.email),name=text_(p.name,80),branch=text_(p.branch_name,80);assert_(pinValid_(p.pin),'PIN ต้องเป็นตัวเลข 6–8 หลัก');
 const users=rows_(db,'Users'),existing=users.find(u=>String(u.email).toLowerCase()===email);assert_(!existing||active_(existing),'บัญชีนี้ถูกระงับ');
 const role=existing?existing.role:(p.requested_role||'STAFF');assert_(['STAFF','MANAGER','ADMIN'].includes(role),'บทบาทไม่ถูกต้อง');
 const manager=role==='STAFF'&&!existing?users.find(u=>u.user_id===p.manager_id&&u.role==='MANAGER'&&active_(u)&&u.family_id):null;
 assert_(existing||role!=='ADMIN','ไม่สามารถสมัครเป็นผู้ดูแลระบบ');assert_(existing||role!=='STAFF'||manager,'ไม่พบหัวหน้าที่เลือก');
 const applications=rows_(db,'PinApplications');assert_(!applications.some(x=>String(x.email).toLowerCase()===email&&x.status==='PENDING'),'มีคำขอที่รออนุมัติแล้ว');
 assert_(applications.filter(x=>now-new Date(x.created_at)<60000).length<10,'มีคำขอมากเกินไป กรุณาลองใหม่ภายหลัง');
 const salt=Utilities.getUuid()+Utilities.getUuid(),app={request_id:Utilities.getUuid(),email,name,branch_name:branch,manager_id:manager?manager.user_id:'',requested_role:role,existing_user_id:existing?existing.user_id:'',salt,pin_hash:pinDigest_(p.pin,salt),status:'PENDING',created_at:now.toISOString()};
 save_(db,'PinApplications',app);return {status:'PENDING'};
}
function canReviewPin_(db,actor,app){if(actor.role==='ADMIN')return true;if(actor.role!=='MANAGER'||!actor.family_id||app.requested_role!=='STAFF')return false;const users=rows_(db,'Users');if(!users.some(u=>u.user_id===actor.user_id&&u.role==='MANAGER'&&active_(u)&&u.family_id===actor.family_id))return false;if(app.existing_user_id)return users.some(u=>u.user_id===app.existing_user_id&&u.role==='STAFF'&&active_(u)&&u.family_id===actor.family_id&&String(u.email).toLowerCase()===String(app.email).toLowerCase());return app.manager_id===actor.user_id;}
function pinApplications_(db,actor){manager_(actor);ensurePinSchema_(db);return rows_(db,'PinApplications').filter(a=>a.status==='PENDING'&&canReviewPin_(db,actor,a)).map(a=>({request_id:a.request_id,email:a.email,name:a.name,branch_name:a.branch_name,manager_id:a.manager_id,requested_role:a.requested_role,existing_user_id:a.existing_user_id,created_at:a.created_at}));}
function pinReview_(db,actor,p,now){
 manager_(actor);ensurePinSchema_(db);const app=rows_(db,'PinApplications').find(a=>a.request_id===p.request_id&&a.status==='PENDING');assert_(app&&canReviewPin_(db,actor,app),'ไม่พบคำขอในขอบเขตที่ได้รับสิทธิ์');
 if(p.approve===true){let user=app.existing_user_id&&rows_(db,'Users').find(u=>u.user_id===app.existing_user_id&&active_(u)&&String(u.email).toLowerCase()===String(app.email).toLowerCase());
  if(!app.existing_user_id){assert_(!rows_(db,'Users').some(u=>String(u.email).toLowerCase()===String(app.email).toLowerCase()),'บัญชีนี้มีอยู่แล้ว');let familyId='',branchId='';
   if(app.requested_role==='STAFF'){const manager=rows_(db,'Users').find(u=>u.user_id===app.manager_id&&u.role==='MANAGER'&&active_(u)&&u.family_id);assert_(manager,'ไม่พบหัวหน้า');familyId=manager.family_id;const branch={branch_id:Utilities.getUuid(),name:app.branch_name,active:true};branchId=branch.branch_id;save_(db,'Branches',branch);}
   else {const family={family_id:Utilities.getUuid(),name:'ทีม '+app.name,active:true};familyId=family.family_id;save_(db,'Families',family);}
   user={user_id:Utilities.getUuid(),email:app.email,name:app.name,role:app.requested_role,family_id:familyId,branch_id:branchId,active:true};save_(db,'Users',user);save_(db,'Memberships',{membership_id:Utilities.getUuid(),user_id:user.user_id,family_id:familyId,branch_id:branchId,started_at:now.toISOString(),ended_at:''});}
  assert_(user,'ไม่พบบัญชีเดิมหรือบัญชีถูกระงับ');if(app.existing_user_id&&db&&db.getSheetByName&&db.getSheetByName('Sessions'))rows_(db,'Sessions').filter(s=>s.user_id===user.user_id).forEach(session=>{session.revoked=true;save_(db,'Sessions',session)});const credential=rows_(db,'PinCredentials').find(c=>c.user_id===user.user_id)||{user_id:user.user_id};credential.salt=app.salt;credential.pin_hash=app.pin_hash;credential.failures=0;credential.locked_until='';save_(db,'PinCredentials',credential);
 }
 app.status=p.approve===true?'APPROVED':'REJECTED';app.reviewed_by=actor.user_id;app.reviewed_at=now.toISOString();app.pin_hash='';app.salt='';save_(db,'PinApplications',app);return {status:app.status};
}
function pinLogin_(db,p,now){
 ensurePinSchema_(db);const email=pinEmail_(p.email);assert_(pinValid_(p.pin),'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง');const user=rows_(db,'Users').find(u=>String(u.email).toLowerCase()===email&&active_(u));const credential=user&&rows_(db,'PinCredentials').find(c=>c.user_id===user.user_id);const salt=credential?credential.salt:'not-an-account';const candidate=pinDigest_(p.pin,salt);
 if(!credential)return {status:'INVALID'};if(credential.locked_until&&new Date(credential.locked_until)>now)return {status:'LOCKED'};
 if(candidate!==credential.pin_hash){credential.failures=Number(credential.failures||0)+1;if(credential.failures>=5){credential.locked_until=new Date(now.getTime()+15*60000).toISOString();credential.failures=0;}save_(db,'PinCredentials',credential);return {status:'INVALID'};}
 credential.failures=0;credential.locked_until='';save_(db,'PinCredentials',credential);startSession_(db,user,p.secret,now);return {status:'ACTIVE',data:bootstrap_(db,user,{month:p.month,static_catalog:true},now)};
}

function adminSetPin_(db,actor,pin){admin_(actor);assert_(pinValid_(pin),'PIN ต้องเป็นตัวเลข 6–8 หลัก');ensurePinSchema_(db);const salt=Utilities.getUuid()+Utilities.getUuid();const credential=rows_(db,'PinCredentials').find(c=>c.user_id===actor.user_id)||{user_id:actor.user_id};credential.salt=salt;credential.pin_hash=pinDigest_(pin,salt);credential.failures=0;credential.locked_until='';save_(db,'PinCredentials',credential);return {done:true};}
