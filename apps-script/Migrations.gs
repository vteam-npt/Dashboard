// Run once from the editor, as owner, before enabling manager registration.
function addRegistrationRoleColumn_() {
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const db=database_(), sheet=db.getSheetByName('Registrations');
    const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    if(headers.includes('requested_role')) { console.log('Registration role column already exists'); return; }
    if(headers[0]!=='request_id' || !headers.includes('reviewed_at')) throw Error('Unexpected registration schema; no change made');
    sheet.getRange(1,headers.length+1).setValue('requested_role').setBackground('#1d4ed8').setFontColor('#ffffff').setFontWeight('bold');
    SpreadsheetApp.flush();console.log('Registration role column added');
  } finally {lock.releaseLock();}
}

// Creates explicitly fictional products only when the catalogue is empty.
function seedDemoProducts_() {
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const db=database_();
    if(rows_(db,'Products').length) { console.log('Catalogue is not empty; no demo products added'); return; }
    ['Y','V','X'].forEach(series=>{
      const product={product_id:Utilities.getUuid(),series,model:series+' Demo',ram:'8',storage:'128',standard_price:1,active:true,is_demo:true};
      save_(db,'Products',product);
      save_(db,'Commissions',{rule_id:Utilities.getUuid(),product_id:product.product_id,amount:0,effective_from:'1970-01-01T00:00:00.000Z',effective_to:''});
    });
    SpreadsheetApp.flush();console.log('Three demo products created with placeholder prices and zero commission');
  } finally {lock.releaseLock();}
}

function testGoogleSigningKeys_() {
  const response=UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/certs',{muteHttpExceptions:true,followRedirects:false});
  if(response.getResponseCode()!==200 || !Array.isArray(JSON.parse(response.getContentText()).keys)) throw Error('Cannot retrieve Google signing keys');
  console.log('Google signing keys retrieved successfully');
}


// Owner-only maintenance. Review the count before running the cleanup.
function countDeletedSales_() {
  const db=database_();
  console.log('Deleted sales awaiting cleanup: '+rows_(db,'Sales').filter(s=>s.status==='DELETED').length);
}
function purgeDeletedSales_() {
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const db=database_(), sales=rows_(db,'Sales').filter(s=>s.status==='DELETED').sort((a,b)=>b._row-a._row);
    sales.forEach(s=>removeSale_(db,s));
    SpreadsheetApp.flush();console.log('Removed deleted sales: '+sales.length);
  } finally {lock.releaseLock();}
}
