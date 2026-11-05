/** Run only in the Apps Script editor as the owner. No web endpoints yet. */
function setupProductionDatabase_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('DATABASE_ID')) {
      console.log('Database already configured. Setup did not change data.');
      return;
    }
    const owner = Session.getEffectiveUser().getEmail();
    if (!owner) throw new Error('Run setup from the editor using the owner account.');
    const sheetId = props.getProperty('PRODUCTION_DATABASE_ID');
    if (!sheetId) throw new Error('Set PRODUCTION_DATABASE_ID in Script Properties before setup.');
    const db = SpreadsheetApp.openById(sheetId);
    const sheets = db.getSheets();
    if (sheets.length !== 1 || sheets[0].getLastRow() !== 0 || sheets[0].getLastColumn() !== 0) {
      throw new Error('The configured spreadsheet must be empty. Setup made no changes.');
    }
    props.setProperty('DATABASE_ID', db.getId());
    props.setProperty('SETUP_STATUS', 'IN_PROGRESS');
    db.setSpreadsheetTimeZone('Asia/Bangkok');
    const schema = {
      Registrations: ['request_id','google_sub','email','name','branch_name','manager_id','family_id','status','created_at','reviewed_by','reviewed_at','requested_role'],
      Users: ['user_id','google_sub','email','name','role','family_id','branch_id','active'],
      Families: ['family_id','name','active'],
      Branches: ['branch_id','name','active'],
      Memberships: ['membership_id','user_id','family_id','branch_id','started_at','ended_at'],
      Products: ['product_id','series','model','ram','storage','standard_price','active','is_demo'],
      Commissions: ['rule_id','product_id','amount','effective_from','effective_to'],
      Campaigns: ['campaign_id','family_id','product_id','name','amount','starts_at','ends_at','created_by','active'],
      Targets: ['target_id','user_id','month','amount','set_by','updated_at'],
      Sales: ['sale_id','request_id','user_id','family_id','branch_id','product_id','product_name','price','payment_method','sold_at','recorded_at','base_commission','incentive','campaign_ids','status','created_by','approved_by','approved_at','deleted_by','deleted_at'],
      AuditLogs: ['event_id','timestamp','actor_id','action','entity_id','details'],
      Settings: ['key','value']
    };
    Object.keys(schema).forEach(function(name, index) {
      const sheet = index === 0 ? db.getSheets()[0].setName(name) : db.insertSheet(name);
      sheet.getRange(1, 1, 1, schema[name].length).setValues([schema[name]])
        .setBackground('#1d4ed8').setFontColor('#ffffff').setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.protect().setDescription('Application database: use dashboard for changes');
    });
    db.getSheetByName('Users').appendRow([Utilities.getUuid(), '', owner, 'Admin', 'ADMIN', '', '', true]);
    db.getSheetByName('Settings').getRange(2,1,4,2).setValues([
      ['timezone','Asia/Bangkok'],['payment_methods','cash,credit,financing'],
      ['schema_version','1'],['environment','production']
    ]);
    props.setProperty('SETUP_STATUS','READY');
    SpreadsheetApp.flush();
    console.log('Production database ready: ' + db.getUrl());
  } finally {
    lock.releaseLock();
  }
}
