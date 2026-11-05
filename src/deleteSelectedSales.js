export async function deleteSelectedSales(ids, remove, refresh) {
 const deleted=[], unavailable=[];
 for (let index=0; index<ids.length; index++) {
  const id=ids[index];
  try { await remove(id); deleted.push(id); }
  catch (error) {
   const current=await refresh();
   if (!current) return {deleted,unavailable,remaining:ids.slice(index),error};
   if (!current.sales.some(s=>s.sale_id===id && s.status!=='DELETED')) { unavailable.push(id); continue; }
   return {deleted,unavailable,remaining:ids.slice(index),error};
  }
 }
 return {deleted,unavailable,remaining:[]};
}
