// Run once as the Apps Script owner before deploying the local-first API.
// Adds sheets/settings only; never deletes or overwrites existing business records.
function setupLocalFirst_(){
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{const db=database_();ensurePinSchema_(db);syncLedgerSheet_(db);const props=PropertiesService.getScriptProperties();if(!props.getProperty('SYNC_CATALOG_VERSIONS'))props.setProperty('SYNC_CATALOG_VERSIONS',JSON.stringify([{version:'baseline-202611',effective_at:'1970-01-01T00:00:00.000Z'}]));pinSecret_();SpreadsheetApp.flush();console.log('Local-first schema ready');}finally{lock.releaseLock();}
}
