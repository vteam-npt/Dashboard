// Pin the exact Apps Script sandbox origin established during deployment; never
// send a credential to '*' or to a hostname inferred from an incoming message.
export function createBridgeTransport({url, sandboxOrigin, hostWindow=window, hostDocument=document, timeoutMs=60000}) {
 const endpoint=new URL(url);
 if (endpoint.protocol!=='https:' || endpoint.hostname!=='script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname)) throw new Error('URL ระบบไม่ถูกต้อง');
 const sandbox=new URL(sandboxOrigin);
 if (sandbox.protocol!=='https:' || !/^n-[a-z0-9-]+-script\.googleusercontent\.com$/.test(sandbox.hostname) || sandbox.origin!==sandboxOrigin) throw new Error('Origin ระบบไม่ถูกต้อง');
 if (hostWindow.top!==hostWindow) throw new Error('กรุณาเปิดเว็บไซต์โดยตรง');
 let remote=null, readyResolve, readyReject, disposed=false, frame;
 const pending=new Map();
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 const readyTimer=hostWindow.setTimeout(()=>readyReject(new Error('เชื่อมต่อระบบไม่สำเร็จ')),timeoutMs);
 // A rejection must be observed even if the user never clicks sign-in.
 ready.catch(()=>{});
 function belongsToFrame(source) {
  try {
   let node=source;
   for(let depth=0;depth<6;depth++) {
    if(node===frame.contentWindow)return true;
    if(!node || node===node.parent)return false;
    node=node.parent;
   }
  } catch (_) { /* Cross-origin implementations may deny ancestry inspection. */ }
  return false;
 }
 function receive(event) {
  if (disposed || event.origin!==sandboxOrigin || !belongsToFrame(event.source) || !event.data || typeof event.data!=='object') return;
  if (event.data.type==='vivo-ready' && !remote) { remote=event.source;hostWindow.clearTimeout(readyTimer);readyResolve();return; }
  if (event.source!==remote || event.data.type!=='vivo-response') return;
  const item=pending.get(event.data.id); if(!item)return;
  pending.delete(event.data.id);hostWindow.clearTimeout(item.timer);
  const result=event.data.result;
  if(result?.ok===true)item.resolve(result.data);else {const error=new Error(result?.error||'ไม่สามารถทำรายการได้');error.code=result?.code;item.reject(error);}
 }
 hostWindow.addEventListener('message',receive);
 frame=hostDocument.createElement('iframe');frame.hidden=true;frame.title='การเชื่อมต่อระบบ';
 // The public bridge must not inherit a Google account from the device.
 // Browsers without credentialless keep their existing behavior.
 if ('credentialless' in frame) frame.credentialless=true;
 frame.src=url;hostDocument.body.appendChild(frame);
 async function request({credential,action,payload}) {
  await ready;
  if(disposed||!remote)throw new Error('การเชื่อมต่อถูกปิด');
  const id=hostWindow.crypto.randomUUID();
  return new Promise((resolve,reject)=>{
   const timer=hostWindow.setTimeout(()=>{pending.delete(id);reject(new Error('ระบบใช้เวลาตอบกลับนานเกินไป'));},timeoutMs);
   pending.set(id,{resolve,reject,timer});
   remote.postMessage({type:'vivo-request',id,token:credential,action,payload},sandboxOrigin);
  });
 }
 request.close=()=>{disposed=true;hostWindow.clearTimeout(readyTimer);readyReject(new Error('การเชื่อมต่อถูกปิด'));hostWindow.removeEventListener('message',receive);frame.remove();for(const item of pending.values()){hostWindow.clearTimeout(item.timer);item.reject(new Error('การเชื่อมต่อถูกปิด'));}pending.clear();};
 return request;
}
