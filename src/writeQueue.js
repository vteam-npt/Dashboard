// Serialize writes from this tab. A failed write is returned to the caller and
// is never kept as an offline draft.
export function createWriteQueue(isOnline=()=>true){
 let tail=Promise.resolve();
 return task=>{
  if(!isOnline())return Promise.reject(new Error('ไม่มีอินเทอร์เน็ต กรุณาเชื่อมต่อแล้วกดบันทึกใหม่'));
  const result=tail.then(()=>{if(!isOnline())throw new Error('ไม่มีอินเทอร์เน็ต กรุณาเชื่อมต่อแล้วกดบันทึกใหม่');return task();});
  tail=result.catch(()=>{});
  return result;
 };
}
