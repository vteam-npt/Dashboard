// Owner-run removal of the retired incentive feature and its trial data.
// This does not delete sales or other sheets.
function removeIncentives202611_() {
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  const db=database_(), sales=db.getSheetByName('Sales');
  if(!sales)throw Error('Sales sheet missing; nothing changed');
  const headers=sales.getRange(1,1,1,sales.getLastColumn()).getValues()[0];
  if(!headers.includes('sale_id')||!headers.includes('base_commission'))throw Error('Unexpected Sales schema; nothing changed');
  const indexes=['incentive','campaign_ids'].map(h=>headers.indexOf(h)+1).filter(n=>n>0).sort((a,b)=>b-a);
  indexes.forEach(index=>sales.deleteColumn(index));
  const campaigns=db.getSheetByName('Campaigns');if(campaigns)db.deleteSheet(campaigns);
  SpreadsheetApp.flush();console.log('Removed retired incentive columns and campaign sheet');
 } finally {lock.releaseLock();}
}
