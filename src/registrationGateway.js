// Browser-generated session secrets are checked against hashes stored on the server.
export function createRegistrationGateway(transport) {
 let credential=null, restoring=null, generation=0, onInvalid=()=>{};
 const key='vivo-session-v1', cacheKey='vivo-dashboard-cache-v1';
 const read=(k)=>{try{return window.localStorage?.getItem(k)||null;}catch(_){return null;}};
 const write=(k,v)=>{try{if(v===null)window.localStorage?.removeItem(k);else window.localStorage?.setItem(k,v);}catch(_){}};
 const clear=()=>{generation++;credential=null;restoring=null;write(key,null);write(cacheKey,null);try{window.sessionStorage?.removeItem('vivo-google-credential');}catch(_){}};
 const saved=()=>{try{const value=JSON.parse(read(key)||'null');return value&&/^vivo1\.[A-Za-z0-9_-]{43}$/.test(value.token)?value:null;}catch(_){return null;}};
 const send=(action,payload={})=>credential?transport({credential,action,payload}):Promise.reject(new Error('กรุณาเข้าสู่ระบบด้วย Google อีกครั้ง'));
 const request=async(action,payload={})=>{if(restoring)await restoring;try{return await send(action,payload);}catch(error){if(error.code==='SESSION_INVALID'){clear();onInvalid();}throw error;}};
 const makeSecret=()=>{const bytes=new Uint8Array(32);window.crypto.getRandomValues(bytes);return 'vivo1.'+window.btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
 const start=async()=>{const secret=makeSecret();await send('startSession',{secret});credential=secret;write(key,JSON.stringify({token:secret}));};
 const cache=data=>{if(saved()&&data?.actor?.user_id)write(cacheKey,JSON.stringify({month:data.month,data}));};
 return {
  sessionVersion(){return generation;},
  useOfflineSession(){const session=saved();if(!session)return false;credential=session.token;return true;},
  onSessionInvalid(callback){onInvalid=callback;},
  cached(month){const session=saved();if(!session){clear();return null;}try{const item=JSON.parse(read(cacheKey)||'null');return item?.month===month&&item.data?.actor?.user_id?item.data:null;}catch(_){return null;}},
  cachedLatest(){if(!saved())return null;try{const item=JSON.parse(read(cacheKey)||'null');return item?.data?.actor?.user_id?item.data:null;}catch(_){return null;}},
  cache,
  async pinManagers(){return transport({credential:'vivo-public',action:'pinManagers',payload:{}});},
  async pinApply(payload){return transport({credential:'vivo-public',action:'pinApply',payload});},
  async pinLogin(email,pin){clear();const current=generation,secret=makeSecret();try{const month=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).slice(0,7);const result=await transport({credential:'vivo-public',action:'pinLogin',payload:{email,pin,secret,month}});if(current!==generation)throw Error('การเข้าสู่ระบบถูกยกเลิก');if(result.status==='ACTIVE'){credential=secret;write(key,JSON.stringify({token:secret}));cache(result.data);}return result;}catch(error){if(current===generation)clear();throw error;}},
  async signIn(value){
   if(typeof value!=='string'||!value)throw Error('ไม่สามารถยืนยันบัญชี Google ได้');
   clear();credential=value;const current=generation;
   try{
    const secret=makeSecret();
    const month=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).slice(0,7);
    const result=await send('identityStatus',{secret,month,static_catalog:true});
    if(current!==generation)throw Error('การเข้าสู่ระบบถูกยกเลิก');
    if(result.status==='ACTIVE'){
     if(result.data?.actor?.user_id){credential=secret;write(key,JSON.stringify({token:secret}));cache(result.data);}
     else await start();
    }
    return result;
   }catch(error){if(current===generation)clear();throw error;}
  },
  async restore(month){
   const session=saved();if(!session){clear();return null;}credential=session.token;
   const current=generation,work=send('bootstrap',{month,static_catalog:true});restoring=work;
   try{const data=await work;if(current!==generation)return null;cache(data);return {status:'ACTIVE',data};}
   catch(error){if(current!==generation)return null;if(error.code==='SESSION_INVALID')clear();throw error;}finally{if(current===generation)restoring=null;}
  },
  async status(){const result=await request('identityStatus');if(result.status==='ACTIVE'&&!credential.startsWith('vivo1.'))await start();return result;},managers:()=>request('registrationManagers'),register:p=>request('register',p),call:(action,payload)=>request(action,payload),
  signOut(){const previous=credential;if(previous?.startsWith('vivo1.'))transport({credential:previous,action:'endSession',payload:{}}).catch(()=>{});clear();window.google?.accounts?.id?.disableAutoSelect();}
 };
}
