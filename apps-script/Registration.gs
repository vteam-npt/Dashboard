/* Internal domain functions only. Callers must supply a verified Google identity,
 * and hold the script lock. Never accept identity from the browser directly. */
function submitRegistration_(db, identity, p, now) {
  assert_(identity && identity.sub && identity.email && identity.email_verified === true, 'จำเป็นต้องยืนยันบัญชี Google');
  const name=text_(p.name,80), branch=text_(p.branch_name,80);
  const requestedRole=p.requested_role || 'STAFF';
  assert_(['STAFF','MANAGER'].includes(requestedRole),'บทบาทไม่ถูกต้อง');
  const manager=requestedRole==='STAFF'?rows_(db,'Users').find(u=>u.user_id===p.manager_id && u.role==='MANAGER' && active_(u) && u.family_id):null;
  assert_(requestedRole==='MANAGER'||manager,'ไม่พบหัวหน้าที่เลือก');
  const existingUser=rows_(db,'Users').find(u=>u.google_sub===identity.sub || String(u.email).toLowerCase()===identity.email.toLowerCase());
  assert_(!existingUser,'บัญชีนี้มีอยู่ในระบบแล้ว กรุณาติดต่อผู้ดูแล');
  const requests=rows_(db,'Registrations');
  const existing=requests.find(r=>r.google_sub===identity.sub && r.status==='PENDING');
  if(existing)return {status:'PENDING'};
  const record={request_id:Utilities.getUuid(),google_sub:identity.sub,email:identity.email.toLowerCase(),name,branch_name:branch,manager_id:manager?manager.user_id:'',family_id:manager?manager.family_id:'',requested_role:requestedRole,status:'PENDING',created_at:now.toISOString()};
  save_(db,'Registrations',record);return {status:record.status};
}
function reviewRegistration_(db, actor, requestId, approve, now) {
  manager_(actor);
  const request=rows_(db,'Registrations').find(r=>r.request_id===requestId);
  assert_(request && request.status==='PENDING','ไม่พบคำขอที่รออนุมัติ');
  const requestedRole=request.requested_role || 'STAFF';
  assert_(['STAFF','MANAGER'].includes(requestedRole),'บทบาทไม่ถูกต้อง');
  assert_(actor.role==='ADMIN' || (requestedRole==='STAFF' && actor.user_id===request.manager_id && actor.family_id===request.family_id),'ไม่มีสิทธิ์พิจารณาคำขอนี้');
  if(approve){
    assert_(!rows_(db,'Users').some(u=>u.google_sub===request.google_sub || String(u.email).toLowerCase()===String(request.email).toLowerCase()),'บัญชีนี้มีอยู่ในระบบแล้ว');
    let familyId=request.family_id, branchId='';
    if(requestedRole==='STAFF') {
      const manager=rows_(db,'Users').find(u=>u.user_id===request.manager_id && u.role==='MANAGER' && active_(u) && u.family_id===request.family_id);
      assert_(manager,'หัวหน้าที่เลือกไม่ได้ดูแลทีมนี้แล้ว กรุณาติดต่อผู้ดูแล');
      const branch={branch_id:Utilities.getUuid(),name:request.branch_name,active:true}; branchId=branch.branch_id;save_(db,'Branches',branch);
    } else {
      const family={family_id:Utilities.getUuid(),name:'ทีม '+request.name,active:true};familyId=family.family_id;save_(db,'Families',family);
    }
    const user={user_id:Utilities.getUuid(),google_sub:request.google_sub,email:request.email,name:request.name,role:requestedRole,family_id:familyId,branch_id:branchId,active:true};
    save_(db,'Users',user);
    save_(db,'Memberships',{membership_id:Utilities.getUuid(),user_id:user.user_id,family_id:user.family_id,branch_id:user.branch_id,started_at:now.toISOString(),ended_at:''});
  }
  request.status=approve?'APPROVED':'REJECTED';request.reviewed_by=actor.user_id;request.reviewed_at=now.toISOString();save_(db,'Registrations',request);audit_(db,actor,'REVIEW_REGISTRATION',request.request_id);return {status:request.status};
}
