// Credentials are kept only in memory. The transport is supplied separately and
// must use HTTPS and authenticate the server response before this can be mounted.
export function createRegistrationGateway(transport) {
 let credential = null;
 const request = (action, payload={}) => {
  if (!credential) return Promise.reject(new Error('กรุณาเข้าสู่ระบบด้วย Google อีกครั้ง'));
  try {
   const part=credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
   const claims=JSON.parse(window.atob(part));
   if (Number.isFinite(claims.exp) && claims.exp*1000<=Date.now()) {
    credential=null;
    return Promise.reject(new Error('การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบด้วย Google อีกครั้ง'));
   }
  } catch (_) { /* The server remains responsible for token validation. */ }
  return transport({credential, action, payload});
 };
 return {
  async signIn(value) {
   if (typeof value !== 'string' || !value) throw new Error('ไม่สามารถยืนยันบัญชี Google ได้');
   credential = value;
   try { return await request('identityStatus'); }
   catch (error) { credential = null; throw error; }
  },
  status: () => request('identityStatus'),
  managers: () => request('registrationManagers'),
  register: payload => request('register', payload),
  call: (action,payload) => request(action,payload),
  signOut() { credential = null; window.google?.accounts?.id?.disableAutoSelect(); }
 };
}
