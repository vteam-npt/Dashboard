/* The bridge contains no application data and forwards only authenticated requests. */
function doGet() {
  const origins = ['https://vteam-npt.github.io'];
  if (PropertiesService.getScriptProperties().getProperty('ALLOW_LOCAL_DEV') === 'true') origins.push('http://localhost:5173');
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
  (function () {
    const origins = ${JSON.stringify(origins)};
    const allowedActions = ['syncSales','syncDeletes','pinManagers','pinApply','pinLogin','pinApplications','pinApprove','pinReject','adminSetPin','startSession','endSession','identityStatus','registrationManagers','register','bootstrap','addSale','deleteSale','approveSale','rejectSale','setTarget','addUser','detachUser','addFamily','approveRegistration','rejectRegistration','export'];
    window.addEventListener('message', function (event) {
      if (event.source !== window.top || !origins.includes(event.origin)) return;
      const msg = event.data;
      if (!msg || msg.type !== 'vivo-request' || typeof msg.id !== 'string' || msg.id.length > 100 ||
          typeof msg.token !== 'string' || msg.token.length > 12000 || !allowedActions.includes(msg.action)) return;
      const target = event.source, targetOrigin = event.origin, id = msg.id;
      function respond(value) { target.postMessage({type:'vivo-response',id:id,result:value},targetOrigin); }
      google.script.run.withSuccessHandler(respond).withFailureHandler(function () {
        respond({ok:false,error:'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองอีกครั้ง'});
      }).authenticatedApi(msg.token,msg.action,msg.payload || {});
    });
    origins.forEach(function(origin) { window.top.postMessage({type:'vivo-ready'},origin); });
  })();
  <\/script></body></html>`;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
