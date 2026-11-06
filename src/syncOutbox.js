import {pendingSales,acknowledgeSales,repairPendingSales,markAttempted,acknowledgeDeletions} from './localDb.js';
import {validateHistory,repairItem} from './catalogVersions.js';
import {bangkokMonth} from './bangkokMonth.js';
// A single request per chunk; only acknowledged records leave the outbox.
export async function syncOutbox({db,userId,send,sendDeletes,fetchHistory,onHistory=async()=>{},onProgress=()=>{}}){
 let repaired=false,confirmed=0;
 for(;;){
  const rows=await pendingSales(db,userId),deletes=rows.filter(x=>x.kind==='delete').slice(0,100);
  if(deletes.length){if(!sendDeletes)throw new Error('ระบบลบข้อมูลยังไม่พร้อม');const result=await sendDeletes({items:deletes.map(x=>x.item)});if(result?.status!=='OK'||!Array.isArray(result.deletions)||result.deletions.length!==deletes.length||new Set(result.deletions.map(x=>x.delete_id)).size!==deletes.length||result.deletions.some(x=>!deletes.some(d=>d.requestId===x.delete_id)))throw new Error('ผลยืนยันการลบไม่ครบ');await acknowledgeDeletions(db,userId,result.deletions);onProgress({status:'SYNCING',confirmed});continue;}
  const candidates=rows.filter(x=>x.kind==='sale').slice(0,100);if(!candidates.length)return {status:'OK',confirmed};
  const pending=await markAttempted(db,userId,candidates.map(x=>x.requestId));if(!pending.length)continue;
  const response=await send({items:pending.map(x=>x.item)});
  if(response?.status==='PATCH_REQUIRED'){
   if(repaired)throw new Error('แพตช์ยังไม่ตรงกับเซิร์ฟเวอร์');
   const history=validateHistory(await fetchHistory(),response.versions);await repairPendingSales(db,userId,history,repairItem);await onHistory(history);repaired=true;onProgress({status:'PATCHED'});continue;
  }
  if(response?.status!=='OK'||!Array.isArray(response.sales))throw new Error('ระบบยังไม่ยืนยันผลการส่ง');
  const allowed=new Map(pending.map(x=>[x.requestId,x]));const received=new Set();
  for(const sale of response.sales){if(!sale?.request_id||!sale.sale_id||!allowed.has(sale.request_id)||received.has(sale.request_id))throw new Error('ผลยืนยันไม่ถูกต้อง');received.add(sale.request_id);}
  if(received.size!==pending.length)throw new Error('ผลยืนยันไม่ครบ กรุณาลองส่งอีกครั้ง');
  const grouped=new Map();for(const sale of response.sales){const month=bangkokMonth(allowed.get(sale.request_id).item.sold_at);if(!grouped.has(month))grouped.set(month,[]);grouped.get(month).push(sale);}
  for(const [month,sales] of grouped)await acknowledgeSales(db,userId,month,sales);
  confirmed+=response.sales.length;onProgress({status:'SYNCING',confirmed});
 }
}
