// Credentials are kept in this tab only and verified by the server on restoration.
// The transport must use HTTPS and authenticate the server response.
export function createRegistrationGateway(transport) {
 let credential = null;
 const storageKey = 'vivo-google-credential';
 const readStored = () => { try { return window.sessionStorage?.getItem(storageKey) || null; } catch (_) { return null; } };
 const store = value => { try { if (value) window.sessionStorage?.setItem(storageKey,value); else window.sessionStorage?.removeItem(storageKey); } catch (_) { /* Storage may be unavailable. */ } };
 const request = (action, payload={}) => {
  if (!credential) return Promise.reject(new Error('กรุณาเข้าสู่ระบบด้วย Google อีกครั้ง'));
  try {
   const part=credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
   const claims=JSON.parse(window.atob(part));
   if (Number.isFinite(claims.exp) && claims.exp*1000<=Date.now()) {
    credential=null; store(null);
    return Promise.reject(new Error('การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบด้วย Google อีกครั้ง'));
   }
  } catch (_) { /* The server remains responsible for token validation. */ }
  return transport({credential, action, payload});
 };
 return {
  async signIn(value) {
   if (typeof value !== 'string' || !value) throw new Error('ไม่สามารถยืนยันบัญชี Google ได้');
   credential = value;
   try { const result=await request('identityStatus'); store(credential); return result; }
   catch (error) { credential = null; store(null); throw error; }
  },
  async restore() {
   credential=readStored();
   if (!credential) return null;
   return request('identityStatus');
  },
  status: () => request('identityStatus'),
  managers: () => request('registrationManagers'),
  register: payload => request('register', payload),
  call: (action,payload) => request(action,payload),
  signOut() { credential = null; store(null); window.google?.accounts?.id?.disableAutoSelect(); }
 };
}
