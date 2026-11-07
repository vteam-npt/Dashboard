/* All helper functions end with _ and cannot be called through google.script.run. */
function legacyApi_(action, payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const db = database_();
    const actor = actor_(db);
    const result = dispatch_(db, actor, action, payload || {}, new Date());
    SpreadsheetApp.flush();
    return JSON.parse(JSON.stringify({ok:true, data:result}));
  } catch (error) {
    return {ok:false, error:String(error.message || 'ไม่สามารถทำรายการได้')};
  } finally { lock.releaseLock(); }
}
function database_() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('SETUP_STATUS') !== 'READY') throw new Error('ฐานข้อมูลยังไม่พร้อมใช้งาน');
  return SpreadsheetApp.openById(p.getProperty('DATABASE_ID'));
}
function rows_(db, name) {
  const values = db.getSheetByName(name).getDataRange().getValues();
  const headers = values.shift();
  return values.map((row,i) => {
    const out = {_row:i+2}; headers.forEach((h,j) => out[h] = row[j] instanceof Date ? row[j].toISOString() : row[j]); return out;
  }).filter(row => row[headers[0]] !== '');
}
function save_(db, name, record) {
  const sheet = db.getSheetByName(name);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const values = headers.map(h => record[h] === undefined ? '' : record[h]);
  // User-controlled text is never interpreted as a spreadsheet formula.
  const safe = values.map((v,i) => typeof v === 'string' && ((name==='Targets' && headers[i]==='month') || /^[=+@\-]/.test(v)) ? "'"+v : v);
  sheet.getRange(record._row || sheet.getLastRow()+1,1,1,headers.length).setValues([safe]);
  return record;
}
function active_(row) { return row && (row.active === true || row.active === 'TRUE'); }
function actor_(db) {
  // Do NOT use getEffectiveUser(): an owner-executed app would identify every visitor as the owner.
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) throw new Error('GOOGLE_IDENTITY_REQUIRED: Google ยังไม่ส่งตัวตนผู้ใช้ กรุณาใช้บัญชีเจ้าของระบบในรอบทดสอบนี้');
  const actor = rows_(db,'Users').find(u => String(u.email).toLowerCase() === email && active_(u));
  if (!actor) throw new Error('บัญชีนี้ยังไม่ได้รับสิทธิ์ กรุณาติดต่อผู้ดูแล');
  return actor;
}
function assert_(condition,message) { if (!condition) throw new Error(message); }
function month_(date) { return new Date(new Date(date).getTime()+7*3600000).toISOString().slice(0,7); }
function day_(date) { return new Date(new Date(date).getTime()+7*3600000).toISOString().slice(0,10); }
function targetMonth_(value) {
  const text=String(value || '');
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return text;
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? month_(date) : '';
}
function latestTargets_(targets, month) {
  const latest=new Map();
  targets.forEach(t=>{
    if (targetMonth_(t.month)!==month) return;
    const prior=latest.get(t.user_id);
    const time=Date.parse(t.updated_at)||0, previous=prior ? Date.parse(prior.updated_at)||0 : 0;
    if (!prior || time>previous || (time===previous && (t._row||0)>(prior._row||0))) latest.set(t.user_id,t);
  });
  return Array.from(latest.values()).map(t=>({...t,month}));
}
function money_(value, zero) { const n=Number(value); assert_(value !== '' && Number.isFinite(n) && n >= (zero ? 0 : 0.01) && n<=100000000 && Math.abs(n*100-Math.round(n*100))<0.00001,'จำนวนเงินไม่ถูกต้อง'); return Math.round(n*100)/100; }
function text_(value, max) { assert_(typeof value === 'string' && value.trim() && value.length <= max,'กรุณาระบุข้อมูลให้ครบ'); return value.trim(); }
function manager_(actor) { assert_(['MANAGER','ADMIN'].includes(actor.role),'เฉพาะหัวหน้าหรือผู้ดูแล'); }
function admin_(actor) { assert_(actor.role==='ADMIN','เฉพาะผู้ดูแลระบบ'); }
function scope_(actor, row) { return actor.role==='ADMIN' || (actor.role==='MANAGER' && actor.family_id && row.family_id===actor.family_id) || (actor.role==='STAFF' && row.user_id===actor.user_id); }
function staff_(db,actor,id) {
  const user=rows_(db,'Users').find(u=>u.user_id===id && active_(u) && u.role==='STAFF');
  assert_(user && scope_(actor,user) && user.family_id && user.branch_id,'ไม่พบพนักงานในขอบเขตที่ได้รับสิทธิ์'); return user;
}
function audit_(db, actor, action, id) { save_(db,'AuditLogs',{event_id:Utilities.getUuid(),timestamp:new Date().toISOString(),actor_id:actor.user_id,action,entity_id:id,details:''}); }
// Caller must hold the script lock. Delete only this sale and its own audit entries.
function removeSale_(db, sale) {
  const saleActions=['ADD_SALE','deleteSale','approveSale','rejectSale'];
  const logs=rows_(db,'AuditLogs').filter(e=>e.entity_id===sale.sale_id && saleActions.includes(e.action));
  const logSheet=db.getSheetByName('AuditLogs');
  logs.map(e=>e._row).sort((a,b)=>b-a).forEach(row=>logSheet.deleteRow(row));
  db.getSheetByName('Sales').deleteRow(sale._row);
  return {sale_id:sale.sale_id,status:'DELETED'};
}
function dispatch_(db, actor, action, p, now) {
  if (action==='bootstrap') return bootstrap_(db,actor,p,now);
  if(action==='syncSales') return syncBatch_(db,actor,p,now);
  if(action==='syncDeletes') return syncDeletes_(db,actor,p,now);
  if(action==='pinApplications') return pinApplications_(db,actor);
  if(action==='pinApprove'||action==='pinReject') return pinReview_(db,actor,{request_id:p.request_id,approve:action==='pinApprove'},now);
  if(action==='adminSetPin') return adminSetPin_(db,actor,p.pin);
  if (action==='approveRegistration' || action==='rejectRegistration') {
    manager_(actor);
    return reviewRegistration_(db,actor,p.request_id,action==='approveRegistration',now);
  }
  if (action==='addSale') {
    const user=staff_(db,actor,actor.role==='STAFF'?actor.user_id:p.user_id);
    const requestId=text_(p.request_id,100);
    const existing=rows_(db,'Sales').find(s=>s.request_id===requestId && s.created_by===actor.user_id);
    if (existing) return existing;
    const product=rows_(db,'Products').find(x=>x.product_id===p.product_id && active_(x));
    assert_(product,'รุ่นสินค้าไม่พร้อมใช้งาน');
    assert_(['cash','credit','financing'].includes(p.payment_method),'ช่องทางชำระเงินไม่ถูกต้อง');
    assert_(typeof p.sold_at==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+07:00$/.test(p.sold_at),'วันเวลาขายไม่ถูกต้อง');
    const sold=new Date(p.sold_at); assert_(Number.isFinite(sold.getTime()) && sold<=now && month_(sold)===month_(now),'เพิ่มยอดได้เฉพาะเดือนปัจจุบัน และห้ามเลือกเวลาในอนาคต');
    const prices=rows_(db,'Commissions').filter(r=>r.product_id===product.product_id && new Date(r.effective_from)<=sold && (!r.effective_to || sold<new Date(r.effective_to))).sort((a,b)=>new Date(b.effective_from)-new Date(a.effective_from));
    assert_(prices.length,'ยังไม่มีอัตราคอมมิชชันสำหรับวันขายนี้');
    const sale={sale_id:Utilities.getUuid(),request_id:requestId,user_id:user.user_id,family_id:user.family_id,branch_id:user.branch_id,product_id:product.product_id,product_name:product.model+(product.ram||product.storage?' '+[product.ram,product.storage].filter(Boolean).join('/'):''),price:money_(p.price),payment_method:p.payment_method,sold_at:sold.toISOString(),recorded_at:now.toISOString(),base_commission:money_(prices[0].amount,true),status:'APPROVED',created_by:actor.user_id};
    save_(db,'Sales',sale); audit_(db,actor,'ADD_SALE',sale.sale_id); return sale;
  }
  if (['deleteSale','approveSale','rejectSale'].includes(action)) {
    const sale=rows_(db,'Sales').find(s=>s.sale_id===p.sale_id);
    assert_(sale && scope_(actor,sale),'ไม่พบรายการในขอบเขตที่ได้รับสิทธิ์');
    assert_(month_(sale.sold_at)===month_(now),'จัดการได้เฉพาะรายการเดือนปัจจุบัน');
    if (action==='deleteSale') {if(db&&db.getSheetByName)recordSaleDeletion_(db,sale,now);return removeSale_(db,sale);}
    else { manager_(actor);assert_(sale.status==='PENDING','รายการนี้ไม่ได้รออนุมัติ');sale.status=action==='approveSale'?'APPROVED':'REJECTED';sale.approved_by=actor.user_id;sale.approved_at=now.toISOString(); }
    save_(db,'Sales',sale);audit_(db,actor,action,sale.sale_id);return sale;
  }
  if (action==='setTarget') {
    manager_(actor);const user=staff_(db,actor,p.user_id); const month=month_(now);
    const target=latestTargets_(rows_(db,'Targets'),month).find(t=>t.user_id===user.user_id) || {target_id:Utilities.getUuid(),user_id:user.user_id,month};
    target.amount=money_(p.amount,true);target.set_by=actor.user_id;target.updated_at=now.toISOString();save_(db,'Targets',target);audit_(db,actor,'SET_TARGET',target.target_id);return target;
  }
  if (action==='addUser') {
    admin_(actor);const email=text_(p.email,200).toLowerCase();assert_(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'อีเมลไม่ถูกต้อง');
    assert_(!rows_(db,'Users').some(u=>String(u.email).toLowerCase()===email),'มีบัญชีนี้แล้ว');
    assert_(['STAFF','MANAGER'].includes(p.role),'บทบาทไม่ถูกต้อง');
    assert_(rows_(db,'Families').some(f=>f.family_id===p.family_id && active_(f)),'เลือกทีม');
    const branch=p.role==='STAFF'?{branch_id:Utilities.getUuid(),name:text_(p.branch_name,80),active:true}:null;
    if(branch) save_(db,'Branches',branch);
    const u={user_id:Utilities.getUuid(),email,name:text_(p.name,80),role:p.role,family_id:p.family_id,branch_id:branch?branch.branch_id:'',active:true};save_(db,'Users',u);
    save_(db,'Memberships',{membership_id:Utilities.getUuid(),user_id:u.user_id,family_id:u.family_id,branch_id:u.branch_id,started_at:now.toISOString(),ended_at:''});audit_(db,actor,'ADD_USER',u.user_id);return u;
  }
  if(action==='detachUser') {
    admin_(actor);const u=rows_(db,'Users').find(x=>x.user_id===p.user_id);assert_(u && u.role!=='ADMIN','ไม่สามารถปลดผู้ดูแล');
    rows_(db,'Memberships').filter(m=>m.user_id===u.user_id&&!m.ended_at).forEach(m=>{m.ended_at=now.toISOString();save_(db,'Memberships',m);});
    u.family_id='';u.branch_id='';u.active=false;save_(db,'Users',u);audit_(db,actor,'DETACH_USER',u.user_id);return {done:true};
  }
  if(action==='addFamily') {admin_(actor);const f={family_id:Utilities.getUuid(),name:text_(p.name,80),active:true};save_(db,'Families',f);audit_(db,actor,'ADD_FAMILY',f.family_id);return f;}
  if(action==='export') {return bootstrap_(db,actor,p,now).sales;}
  throw new Error('ไม่รองรับการทำรายการนี้');
}
function bootstrap_(db,actor,p,now) {
  const month=p.month||month_(now);assert_(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'เดือนไม่ถูกต้อง');
  const users=rows_(db,'Users').filter(u=>scope_(actor,u));
  const ids=users.map(u=>u.user_id);
  const registrations=actor.role==='STAFF'?[]:rows_(db,'Registrations').filter(r=>r.status==='PENDING' && (actor.role==='ADMIN'||((r.requested_role||'STAFF')==='STAFF' && r.manager_id===actor.user_id && r.family_id===actor.family_id))).map(r=>({request_id:r.request_id,name:r.name,branch_name:r.branch_name,manager_id:r.manager_id,requested_role:r.requested_role||'STAFF',created_at:r.created_at,status:r.status}));
  const sync_deletions=db&&db.getSheetByName&&db.getSheetByName('SyncLedger')?rows_(db,'SyncLedger').filter(row=>scope_(actor,row)).map(row=>({request_id:row.request_id,sale_id:row.sale_id})):[];
  const pin_registrations=actor.role!=='STAFF'&&db&&db.getSheetByName&&db.getSheetByName('PinApplications')?pinApplications_(db,actor):[];
  return {actor,month,server_now:now.toISOString(),users,pin_registrations,sync_deletions,products:p.static_catalog===true?[]:rows_(db,'Products'),commissions:p.static_catalog===true?[]:rows_(db,'Commissions'),families:rows_(db,'Families').filter(f=>actor.role==='ADMIN'||f.family_id===actor.family_id),branches:rows_(db,'Branches').filter(b=>actor.role==='ADMIN'||users.some(u=>u.branch_id===b.branch_id)),targets:latestTargets_(rows_(db,'Targets'),month).filter(t=>ids.includes(t.user_id)),sales:rows_(db,'Sales').filter(s=>scope_(actor,s)&&month_(s.sold_at)===month),registrations};
}
