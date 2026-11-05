let scriptPromise;

function loadGoogleIdentity() {
 if (window.google?.accounts?.id) return Promise.resolve();
 if (!scriptPromise) {
  if (window.location.protocol==='http:' && window.location.hostname==='localhost' && !document.querySelector('meta[name="referrer"]')) {
   const meta=document.createElement('meta');meta.name='referrer';meta.content='no-referrer-when-downgrade';document.head.appendChild(meta);
  }
  scriptPromise = new Promise((resolve,reject) => {
   const script=document.createElement('script');
   script.src='https://accounts.google.com/gsi/client';
   script.async=true;
   script.onload=()=>window.google?.accounts?.id ? resolve() : reject(new Error('ไม่สามารถโหลด Google Login ได้'));
   script.onerror=()=>reject(new Error('ไม่สามารถโหลด Google Login ได้'));
   document.head.appendChild(script);
  }).catch(error=>{scriptPromise=null;throw error;});
 }
 return scriptPromise;
}

export async function renderGoogleSignIn(element, clientId, onCredential) {
 if (!clientId || !element) throw new Error('ยังไม่ได้ตั้งค่า Google Login');
 await loadGoogleIdentity();
 window.google.accounts.id.initialize({client_id:clientId,callback:response=>{
  if(typeof response?.credential==='string'&&response.credential) onCredential(response.credential);
 }});
 element.replaceChildren();
 for(const text of ['signin_with','signup_with']) {
  const group=document.createElement('div');group.className='google-signin-option';
  const label=document.createElement('span');label.className='google-signin-label';label.textContent=text==='signin_with'?'เข้าสู่ระบบ':'สมัครใช้งาน';
  const button=document.createElement('div');group.append(label,button);element.appendChild(group);
  window.google.accounts.id.renderButton(button,{type:'standard',theme:'outline',size:'large',text,shape:'pill',locale:'th'});
 }
}
