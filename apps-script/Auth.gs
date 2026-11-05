/* GOOGLE_CLIENT_ID is configured in Script Properties, never accepted from a caller. */
function googleIdentity_(token) {
  const clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  assert_(clientId, 'ระบบเข้าสู่ระบบยังไม่ได้ตั้งค่า');
  const cache = CacheService.getScriptCache();
  const cacheKey = 'google-jwks-v1';
  function fetchKeys() {
    const response = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/certs', {muteHttpExceptions: true, followRedirects: false});
    assert_(response.getResponseCode() === 200, 'ไม่สามารถตรวจสอบบัญชี Google ได้');
    const text = response.getContentText();
    const keys = JSON.parse(text);
    assert_(Array.isArray(keys.keys) && keys.keys.length > 0, 'ไม่สามารถตรวจสอบบัญชี Google ได้');
    cache.put(cacheKey, text, 300);
    return keys;
  }
  let keys;
  try { keys = JSON.parse(cache.get(cacheKey) || 'null'); } catch (_) { keys = null; }
  if (!keys) keys = fetchKeys();
  try { return GoogleTokenVerifier.verifyGoogleIdToken(token, clientId, keys); }
  catch (error) {
    if (String(error.message) !== 'Unknown signing key') throw error;
    return GoogleTokenVerifier.verifyGoogleIdToken(token, clientId, fetchKeys());
  }
}

function actorForIdentity_(db, identity) {
  const users = rows_(db, 'Users');
  let user = users.find(u => u.google_sub === identity.sub);
  if (user) { assert_(active_(user), 'บัญชีนี้ถูกระงับ'); return user; }
  user = users.find(u => String(u.email).toLowerCase() === identity.email);
  if (!user) return null;
  assert_(active_(user) && !user.google_sub, 'บัญชีนี้ไม่สามารถเข้าใช้งานได้');
  const domain = identity.email.split('@').pop();
  assert_(domain === 'gmail.com' || (identity.hosted_domain && identity.hosted_domain === domain), 'ไม่สามารถยืนยันบัญชีที่กำหนดล่วงหน้าได้');
  user.google_sub = identity.sub;
  save_(db, 'Users', user);
  return user;
}

function authenticatedApi(token, action, payload) {
  const lock = LockService.getScriptLock();
  try {
    const identity = googleIdentity_(token);
    lock.waitLock(30000);
    try {
      const db = database_(), actor = actorForIdentity_(db, identity), p = payload || {}, now = new Date();
      let result;
      if (action === 'identityStatus') {
        const pending = rows_(db,'Registrations').some(r => r.google_sub === identity.sub && r.status === 'PENDING');
        result = {status: actor ? 'ACTIVE' : pending ? 'PENDING' : 'NEW'};
      } else if (action === 'registrationManagers') {
        assert_(!actor, 'บัญชีนี้มีสิทธิ์เข้าใช้งานแล้ว');
        result = rows_(db,'Users').filter(u => u.role === 'MANAGER' && active_(u) && u.family_id).map(u => ({id:u.user_id,name:u.name}));
      } else if (action === 'register') {
        assert_(!actor, 'บัญชีนี้มีสิทธิ์เข้าใช้งานแล้ว');
        result = submitRegistration_(db, identity, p, now);
      } else {
        assert_(actor, 'บัญชีนี้ยังไม่ได้รับสิทธิ์');
        result = dispatch_(db, actor, action, p, now);
      }
      SpreadsheetApp.flush();
      return JSON.parse(JSON.stringify({ok:true,data:result}));
    } finally { lock.releaseLock(); }
  } catch (_) {
    // Avoid returning tokens, key material or internal exception details to callers.
    return {ok:false,error:'ไม่สามารถยืนยันตัวตนหรือทำรายการได้ กรุณาตรวจสอบข้อมูลและลองอีกครั้ง'};
  }
}
