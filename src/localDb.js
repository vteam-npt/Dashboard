// Separate records by account; snapshots never replace the local outbox.
const DB_NAME='vivo-local-first', DB_VERSION=4;
const key=(userId,month)=>`${userId}:${month}`;
function result(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});}
function complete(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('ไม่สามารถบันทึกข้อมูลในเครื่อง'));tx.onerror=()=>{};});}
export async function openLocalDb(indexedDB=globalThis.indexedDB){
 if(!indexedDB)throw new Error('อุปกรณ์นี้ไม่รองรับฐานข้อมูลในเครื่อง');
 const request=indexedDB.open(DB_NAME,DB_VERSION);
 request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'key'});if(!db.objectStoreNames.contains('outbox')){const s=db.createObjectStore('outbox',{keyPath:'key'});s.createIndex('userId','userId',{unique:false});}if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});if(!db.objectStoreNames.contains('drafts'))db.createObjectStore('drafts',{keyPath:'userId'});if(!db.objectStoreNames.contains('accepted')){const s=db.createObjectStore('accepted',{keyPath:'key'});s.createIndex('userId','userId',{unique:false});}if(!db.objectStoreNames.contains('removed')){const s=db.createObjectStore('removed',{keyPath:'key'});s.createIndex('userId','userId',{unique:false});}};
 const db=await result(request);db.onversionchange=()=>db.close();return db;
}
export async function saveSnapshot(db,userId,month,snapshot){
 if(!userId||snapshot?.actor?.user_id!==userId||snapshot.month!==month)throw new Error('ข้อมูลบัญชีหรือเดือนไม่ตรงกัน');
 const tx=db.transaction(['snapshots','accepted','removed'],'readwrite'),accepted=tx.objectStore('accepted'),removed=tx.objectStore('removed'),snapshots=tx.objectStore('snapshots'),prior=await result(snapshots.get(key(userId,month)));const oldTime=Date.parse(prior?.data?.server_now)||0,newTime=Date.parse(snapshot.server_now)||0;if(oldTime&&(!newTime||newTime<oldTime)){await complete(tx);return false;}const records=await result(accepted.index('userId').getAll(userId));const seen=new Set([...(snapshot.sales||[]).map(s=>s.request_id),...(snapshot.sync_deletions||[]).map(s=>s.request_id)].filter(Boolean));for(const row of records)if(row.month===month&&seen.has(row.requestId))accepted.delete(row.key);const deletions=new Set((snapshot.sync_deletions||[]).map(s=>s.request_id));const removedRows=await result(removed.index('userId').getAll(userId));for(const row of removedRows)if(row.month===month&&deletions.has(row.requestId))removed.delete(row.key);snapshots.put({key:key(userId,month),userId,month,data:snapshot});await complete(tx);return true;
}
export async function getSnapshot(db,userId,month){const tx=db.transaction('snapshots','readonly');return (await result(tx.objectStore('snapshots').get(key(userId,month))))?.data||null;}
export async function stageSales(db,userId,items){
 if(!userId||!Array.isArray(items)||!items.length)throw new Error('ไม่มีรายการสำหรับบันทึก');
 if(items.some(item=>!item.request_id||!item.product_id||!item.sold_at)||new Set(items.map(i=>i.request_id)).size!==items.length)throw new Error('ข้อมูลรายการไม่ครบหรือซ้ำ');
 const tx=db.transaction('outbox','readwrite'),store=tx.objectStore('outbox');
 for(const item of items)store.add({key:key(userId,item.request_id),userId,requestId:item.request_id,kind:'sale',status:'PENDING',item});
 await complete(tx);
}
export async function pendingSales(db,userId){const tx=db.transaction('outbox','readonly');return await result(tx.objectStore('outbox').index('userId').getAll(userId));}
// Persist acknowledgements and remove exactly those outbox records in one transaction.
export async function acknowledgeSales(db,userId,month,acknowledged){
 const tx=db.transaction(['snapshots','outbox','accepted'],'readwrite'),snapshots=tx.objectStore('snapshots'),outbox=tx.objectStore('outbox'),accepted=tx.objectStore('accepted');
 const record=await result(snapshots.get(key(userId,month)));if(!record){tx.abort();throw new Error('ไม่พบข้อมูลบัญชีในเครื่อง');}
 const sales=record.data.sales.slice();for(const ack of acknowledged){if(!ack.request_id||!ack.sale_id) {tx.abort();throw new Error('ผลยืนยันรายการไม่ครบ');}const i=sales.findIndex(s=>s.sale_id===ack.sale_id||s.request_id===ack.request_id);if(ack.deleted){if(i>=0)sales.splice(i,1);accepted.delete(key(userId,ack.request_id));}else{if(i>=0)sales[i]=ack;else sales.push(ack);accepted.put({key:key(userId,ack.request_id),userId,month,requestId:ack.request_id,sale:ack});}outbox.delete(key(userId,ack.request_id));}record.data.sales=sales;snapshots.put(record);await complete(tx);
}
export async function localDashboard(db,userId,month){
 const snapshot=await getSnapshot(db,userId,month);if(!snapshot)return null;
 const pending=(await pendingSales(db,userId)).filter(entry=>entry.kind==='sale'&&entry.item.sold_at.slice(0,7)===month);
 const tx=db.transaction('accepted','readonly'),accepted=(await result(tx.objectStore('accepted').index('userId').getAll(userId))).filter(x=>x.month===month);const base=snapshot.sales.slice(),existing=new Set(base.map(s=>s.request_id).filter(Boolean));for(const row of accepted)if(!existing.has(row.requestId)){base.push(row.sale);existing.add(row.requestId);}
 const deletes=(await pendingSales(db,userId)).filter(e=>e.kind==='delete');const removedTx=db.transaction('removed','readonly'),removedRows=await result(removedTx.objectStore('removed').index('userId').getAll(userId));const hidden=new Set([...deletes.map(e=>e.item.sale_id),...removedRows.map(e=>e.saleId)]);const hiddenRequests=new Set([...deletes.map(e=>e.item.request_id),...removedRows.map(e=>e.requestId)]);const local=pending.filter(e=>!existing.has(e.requestId)&&!hiddenRequests.has(e.requestId)).map(e=>({...e.item,sale_id:`local:${e.requestId}`,user_id:userId,status:'APPROVED',sync_status:e.status}));
 return {...snapshot,sales:[...base.filter(s=>!hidden.has(s.sale_id)&&!hiddenRequests.has(s.request_id)),...local]};
}
// Rewrite pending records in one transaction; preserve IDs, prices and payment.
export async function repairPendingSales(db,userId,history,repair){
 const tx=db.transaction('outbox','readwrite'),store=tx.objectStore('outbox'),rows=await result(store.index('userId').getAll(userId));
 try{for(const row of rows){if(row.kind==='sale'){row.item=repair(row.item,history);store.put(row);}}}catch(e){tx.abort();throw e;}
 await complete(tx);
}

export async function loadDrafts(db,userId){const tx=db.transaction('drafts','readonly');return (await result(tx.objectStore('drafts').get(userId)))?.items||[];}
export async function saveDrafts(db,userId,items){const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put({userId,items});await complete(tx);}
// Commit the selected devices to the outbox and remove them from drafts atomically.
export async function commitDrafts(db,userId,items){
 if(!items.length||items.some(i=>!i.request_id||!i.product_id))throw new Error('ข้อมูลรายการไม่ครบ');
 const tx=db.transaction(['drafts','outbox','snapshots'],'readwrite'),drafts=tx.objectStore('drafts'),outbox=tx.objectStore('outbox'),snapshots=tx.objectStore('snapshots');const record=await result(drafts.get(userId));const stored=record?.items||[];const ids=new Set(items.map(i=>i.request_id));
 if(ids.size!==items.length||items.some(item=>!stored.some(s=>s.request_id===item.request_id))){tx.abort();throw new Error('รายการในตะกร้าเปลี่ยนแล้ว กรุณาตรวจสอบอีกครั้ง');}
 for(const month of new Set(items.map(item=>item.sold_at?.slice(0,7)))){if(!month||!await result(snapshots.get(key(userId,month)))){tx.abort();throw new Error('ข้อมูลเดือนนี้ในเครื่องยังไม่พร้อม กรุณาเชื่อมต่อและอัปเดตข้อมูล');}}
 for(const item of items)outbox.add({key:key(userId,item.request_id),userId,requestId:item.request_id,kind:'sale',status:'PENDING',item});drafts.put({userId,items:stored.filter(i=>!ids.has(i.request_id))});await complete(tx);
}
export async function setSyncNotice(db,userId,message){const tx=db.transaction('meta','readwrite');tx.objectStore('meta').put({key:'sync:'+userId,message});await complete(tx);}
export async function getSyncNotice(db,userId){const tx=db.transaction('meta','readonly');return (await result(tx.objectStore('meta').get('sync:'+userId)))?.message||'';}
export async function modifyDrafts(db,userId,change){const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts');const current=(await result(store.get(userId)))?.items||[];let next;try{next=change(current);if(!Array.isArray(next))throw Error('ข้อมูลตะกร้าไม่ถูกต้อง');store.put({userId,items:next});}catch(e){tx.abort();throw e;}await complete(tx);return next;}
// LocalStorage drafts from the previous version are copied once; never sent automatically.
export async function migrateLegacyDrafts(db,userId,storage,prepare){
 const legacyKey='vivo-sale-cart-v1:'+encodeURIComponent(userId);const raw=storage.getItem(legacyKey);if(!raw)return;
 const legacy=JSON.parse(raw);if(!Array.isArray(legacy))throw new Error('ไม่สามารถอ่านตะกร้าเดิม');
 await modifyDrafts(db,userId,current=>{const ids=new Set(current.map(i=>i.request_id));return [...current,...legacy.filter(i=>!ids.has(i.request_id)).map(prepare)]});
 storage.removeItem(legacyKey);
}

export async function markAttempted(db,userId,ids){const tx=db.transaction('outbox','readwrite'),store=tx.objectStore('outbox'),marked=[];for(const id of ids){const row=await result(store.get(key(userId,id)));if(row&&row.kind==='sale'){row.attempted=true;store.put(row);marked.push(row)}}await complete(tx);return marked;}
export async function queueSaleDeletions(db,actorId,sales){
 if(!sales.length||sales.some(s=>!s?.sale_id||!s.request_id))throw Error('ข้อมูลรายการไม่ครบ');const tx=db.transaction('outbox','readwrite'),store=tx.objectStore('outbox');
 for(const sale of sales){const saleKey=key(actorId,sale.request_id),pending=await result(store.get(saleKey));if(pending?.kind==='sale'){store.delete(saleKey);if(!pending.attempted)continue;}
  const deleteId='delete:'+sale.request_id;store.put({key:key(actorId,deleteId),userId:actorId,requestId:deleteId,kind:'delete',status:'PENDING',item:{delete_id:deleteId,sale_id:sale.sale_id,request_id:sale.request_id,user_id:sale.user_id,family_id:sale.family_id,sold_at:sale.sold_at,deleted_at:new Date().toISOString()}});}
 await complete(tx);
}
export async function queueSaleDeletion(db,actorId,sale){return queueSaleDeletions(db,actorId,[sale]);}

export async function acknowledgeDeletions(db,userId,acks){const tx=db.transaction(['outbox','snapshots','accepted','removed'],'readwrite'),outbox=tx.objectStore('outbox'),snapshots=tx.objectStore('snapshots'),accepted=tx.objectStore('accepted'),removed=tx.objectStore('removed');for(const ack of acks){const row=await result(outbox.get(key(userId,ack.delete_id)));if(!row||row.kind!=='delete')continue;const month=row.item.sold_at.slice(0,7),record=await result(snapshots.get(key(userId,month)));if(record){record.data.sales=record.data.sales.filter(s=>s.sale_id!==row.item.sale_id&&s.request_id!==row.item.request_id);snapshots.put(record)}accepted.delete(key(userId,row.item.request_id));removed.put({key:key(userId,row.item.request_id),userId,month,requestId:row.item.request_id,saleId:row.item.sale_id});outbox.delete(row.key);}await complete(tx);}
export async function getLocalCatalog(db){const tx=db.transaction('meta','readonly');return (await result(tx.objectStore('meta').get('catalog-history')))?.history||null;}
export async function saveLocalCatalog(db,history){const tx=db.transaction('meta','readwrite');tx.objectStore('meta').put({key:'catalog-history',history});await complete(tx);}
