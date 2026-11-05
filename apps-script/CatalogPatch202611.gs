// Applies the approved November catalogue without changing existing sales.
// Safe to rerun after an interrupted import. No product price is assumed.
function applyCatalogPatch202611_() {
 const catalog=[["X","X300 Ultra",16,512,800],["X","X300 Ultra",16,1024,1200],["X","X300 Pro",12,256,600],["X","X300 Pro",16,512,800],["X","X300",12,256,500],["X","X300",16,512,600],["X","X300 FE",12,256,400],["X","X300 FE",12,512,500],["X","X Fold5",16,512,1800],["V","V80",8,128,250],["V","V80",8,256,300],["V","V80",8,512,350],["V","V80 Lite 5G",6,128,250],["V","V80 Lite 5G",6,256,300],["V","V70 FE",8,256,250],["V","V70 FE",12,256,300],["V","V70",8,256,250],["V","V70",12,256,300],["V","V70",12,512,350],["Y","Y31d",6,128,100],["Y","Y31d",6,256,120],["Y","Y31 5G",8,128,100],["Y","Y31 5G",8,256,120],["Y","Y11d",4,128,60],["Y","Y05",4,64,20],["Y","Y05",4,128,30],["Other","iQOO 15",12,256,600],["Other","iQOO 15",16,512,650],["Other","iQOO 15R",12,256,300],["Other","iQOO 15R",12,512,350],["Other","iQOO Neo 10",8,256,200],["Other","iQOO Neo 10",12,256,250],["Other","iQOO Neo 10",16,512,300],["Other","iQOO Z11",8,256,180],["Other","iQOO Z11",12,256,160],["Other","iQOO Z11x",8,128,165],["Other","iQOO Z11x",8,256,185]];
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  const db=database_(), products=rows_(db,'Products'), rules=rows_(db,'Commissions');
  const productSheet=db.getSheetByName('Products'), ruleSheet=db.getSheetByName('Commissions');
  const pHeaders=productSheet.getRange(1,1,1,productSheet.getLastColumn()).getValues()[0];
  const cHeaders=ruleSheet.getRange(1,1,1,ruleSheet.getLastColumn()).getValues()[0];
  const keys=['product_id','series','model','ram','storage','standard_price','active','is_demo'];
  const ruleKeys=['rule_id','product_id','amount','effective_from','effective_to'];
  if(keys.some(k=>!pHeaders.includes(k))||ruleKeys.some(k=>!cHeaders.includes(k)))throw Error('Unexpected schema; no changes made');
  const pendingProducts=[],pendingRules=[],identities=new Set();
  catalog.forEach(([series,model,ram,storage,amount])=>{
   const slug=(series+'-'+model+'-'+ram+'-'+storage).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
   const id='catalog-202611-'+slug, ruleId='commission-202611-'+slug;
   if(identities.has(id))throw Error('Duplicate SKU in catalogue: '+id);identities.add(id);
   const same=products.filter(p=>String(p.series)===series&&String(p.model).toLowerCase()===model.toLowerCase()&&String(p.ram)===String(ram)&&String(p.storage)===String(storage));
   const byId=products.find(p=>p.product_id===id);
   if(same.length>1||(byId&&!same.some(p=>p.product_id===id)))throw Error('Existing product conflicts with catalogue: '+model+' '+ram+'/'+storage);
   const existing=same[0], productId=existing?existing.product_id:id;
   if(existing&&!active_(existing))throw Error('Existing product is inactive: '+model+' '+ram+'/'+storage);
   const prior=rules.find(r=>r.rule_id===ruleId);
   if(prior&&(prior.product_id!==productId||Number(prior.amount)!==amount))throw Error('Existing commission conflicts: '+model+' '+ram+'/'+storage);
   if(!existing)pendingProducts.push({product_id:id,series,model,ram,storage,standard_price:'',active:true,is_demo:false});
   if(!prior)pendingRules.push({rule_id:ruleId,product_id:productId,amount,effective_from:existing?new Date().toISOString():'2026-11-01T00:00:00+07:00',effective_to:''});
  });
  if(pendingProducts.length)productSheet.getRange(productSheet.getLastRow()+1,1,pendingProducts.length,pHeaders.length).setValues(pendingProducts.map(p=>pHeaders.map(h=>p[h]===undefined?'':p[h])));
  if(pendingRules.length)ruleSheet.getRange(ruleSheet.getLastRow()+1,1,pendingRules.length,cHeaders.length).setValues(pendingRules.map(r=>cHeaders.map(h=>r[h]===undefined?'':r[h])));
  products.filter(p=>(p.is_demo===true||p.is_demo==='TRUE')&&(p.active===true||p.active==='TRUE')).forEach(p=>productSheet.getRange(p._row,pHeaders.indexOf('active')+1).setValue(false));
  SpreadsheetApp.flush();console.log('Catalogue applied: '+catalog.length+' entries; new products '+pendingProducts.length+'; new rules '+pendingRules.length);
 } finally {lock.releaseLock();}
}
