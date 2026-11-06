// New sync endpoints run inside authenticatedApi's script lock.
function syncLedgerSheet_(db){return pinSheet_(db,'SyncLedger',['request_id','sale_id','user_id','family_id','deleted_at']);}
function syncCatalogVersions_(){const raw=PropertiesService.getScriptProperties().getProperty('SYNC_CATALOG_VERSIONS');assert_(raw,'ยังไม่ได้ตั้งค่าเวอร์ชันสินค้า');const versions=JSON.parse(raw);assert_(Array.isArray(versions)&&versions.length,'เวอร์ชันสินค้าไม่ถูกต้อง');return versions.slice().sort((a,b)=>Date.parse(a.effective_at)-Date.parse(b.effective_at));}
function syncBatch_(db,actor,p,now){
 assert_(actor.role==='STAFF','เฉพาะพนักงาน');const user=staff_(db,actor,actor.user_id);assert_(Array.isArray(p.items)&&p.items.length>0&&p.items.length<=100,'จำนวนรายการไม่ถูกต้อง');syncLedgerSheet_(db);
 const versions=syncCatalogVersions_(),existing=rows_(db,'Sales'),deleted=rows_(db,'SyncLedger'),products=rows_(db,'Products');const inputIds=new Set(),prepared=[],answers=[];
 for(const item of p.items){
  const requestId=text_(item.request_id,100);assert_(!inputIds.has(requestId),'รายการซ้ำในชุด');inputIds.add(requestId);
  const tombstone=deleted.find(s=>s.request_id===requestId&&s.user_id===actor.user_id);if(tombstone){answers.push({request_id:requestId,sale_id:tombstone.sale_id,deleted:true});continue;}
  const prior=existing.find(s=>s.request_id===requestId&&s.created_by===actor.user_id);if(prior){answers.push(prior);continue;}
  assert_(typeof item.recorded_at==='string'&&typeof item.sold_at==='string','วันเวลารายการไม่ถูกต้อง');const recorded=new Date(item.recorded_at),sold=new Date(item.sold_at);assert_(Number.isFinite(recorded.getTime())&&Number.isFinite(sold.getTime())&&recorded<=now&&sold<=recorded&&month_(sold)===month_(recorded),'วันเวลารายการไม่ถูกต้อง');
  const expected=versions.filter(v=>Date.parse(v.effective_at)<=recorded.getTime()).pop();assert_(expected,'ไม่พบเวอร์ชันสินค้า');if(item.catalog_version!==expected.version)return {status:'PATCH_REQUIRED',versions};
  const productId=text_(item.product_id,160),product=products.find(x=>x.product_id===productId);const productName=product?product.model+(product.ram||product.storage?' '+[product.ram,product.storage].filter(Boolean).join('/'):''):text_(item.product_name,200);assert_(['cash','credit','financing'].includes(item.payment_method),'ช่องทางชำระเงินไม่ถูกต้อง');
  prepared.push({sale_id:Utilities.getUuid(),request_id:requestId,user_id:user.user_id,family_id:user.family_id,branch_id:user.branch_id,product_id:productId,product_name:productName,price:money_(item.price),payment_method:item.payment_method,sold_at:sold.toISOString(),recorded_at:recorded.toISOString(),base_commission:money_(item.base_commission,true),status:'APPROVED',created_by:actor.user_id});
 }
 if(prepared.length){const sheet=db.getSheetByName('Sales'),headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];const values=prepared.map(s=>headers.map(h=>{const v=s[h]===undefined?'':s[h];return typeof v==='string'&&/^[=+@\-]/.test(v)?"'"+v:v;}));sheet.getRange(sheet.getLastRow()+1,1,values.length,headers.length).setValues(values);answers.push(...prepared);}
 return {status:'OK',sales:answers};
}
function recordSaleDeletion_(db,sale,now){syncLedgerSheet_(db);if(!rows_(db,'SyncLedger').some(s=>s.request_id===sale.request_id&&s.user_id===sale.user_id))save_(db,'SyncLedger',{request_id:sale.request_id,sale_id:sale.sale_id,user_id:sale.user_id,family_id:sale.family_id,deleted_at:now.toISOString()});}
// A deletion is idempotent and leaves only synchronization metadata, not visible sale history.
function syncDeletes_(db,actor,p,now){
 assert_(Array.isArray(p.items)&&p.items.length>0&&p.items.length<=100,'จำนวนรายการไม่ถูกต้อง');syncLedgerSheet_(db);const results=[];const seen=new Set();
 for(const item of p.items){
  const deleteId=text_(item.delete_id,150),requestId=text_(item.request_id,100);assert_(!seen.has(deleteId),'รายการซ้ำ');seen.add(deleteId);const deletionTime=item.deleted_at?new Date(item.deleted_at):now;assert_(Number.isFinite(deletionTime.getTime())&&deletionTime<=now,'เวลาลบไม่ถูกต้อง');
  const local=actor.role==='STAFF'&&item.user_id===actor.user_id&&String(item.sale_id)==='local:'+requestId;const sale=rows_(db,'Sales').find(s=>(s.request_id===requestId||(!s.request_id&&requestId==='legacy:'+s.sale_id))&&(s.sale_id===item.sale_id||(local&&s.user_id===actor.user_id)));
  if(sale){if(!sale.request_id)sale.request_id=requestId;assert_(scope_(actor,sale),'ไม่พบรายการในขอบเขต');assert_(month_(sale.sold_at)===month_(deletionTime),'จัดการได้เฉพาะเดือนที่ขาย');recordSaleDeletion_(db,sale,now);removeSale_(db,sale);results.push({delete_id:deleteId,deleted:true});continue;}
  const ledger=rows_(db,'SyncLedger').find(x=>x.request_id===requestId&&(x.sale_id===item.sale_id||(local&&x.user_id===actor.user_id)));
  if(ledger){assert_(scope_(actor,ledger),'ไม่พบรายการในขอบเขต');results.push({delete_id:deleteId,deleted:true});continue;}
  assert_(local,'ไม่พบรายการ');assert_(month_(item.sold_at)===month_(deletionTime),'จัดการได้เฉพาะเดือนที่ขาย');
  save_(db,'SyncLedger',{request_id:requestId,sale_id:item.sale_id,user_id:actor.user_id,family_id:actor.family_id,deleted_at:now.toISOString()});results.push({delete_id:deleteId,deleted:true});
 }
 return {status:'OK',deletions:results};
}
