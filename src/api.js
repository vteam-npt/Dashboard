const env=import.meta.env;
export const productionConfig={clientId:env.VITE_GOOGLE_CLIENT_ID,bridgeUrl:env.VITE_APPS_SCRIPT_URL,sandboxOrigin:env.VITE_APPS_SCRIPT_SANDBOX_ORIGIN};
export const configured=Object.values(productionConfig).some(Boolean);
export const live=Object.values(productionConfig).every(Boolean);
let gateway=null;
export function setGateway(value){gateway=value;}
export function call(action,payload={}){
 if(!live||!gateway)return Promise.reject(new Error('หน้าตัวอย่างนี้ไม่สามารถบันทึกข้อมูลจริงได้'));
 return gateway.call(action,payload);
}
export const preview={actor:{user_id:'preview',name:'ผู้ดูแลระบบ',role:'ADMIN'},month:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).slice(0,7),users:[],sales:[],registrations:[],targets:[],families:[{family_id:'family-demo-1',name:'ทีมตัวอย่าง 1'}],branches:[],campaigns:[],commissions:[{product_id:'demo-y',amount:100},{product_id:'demo-v',amount:200},{product_id:'demo-x',amount:300}],products:[{product_id:'demo-y',series:'Y',model:'Y Demo',ram:8,storage:128,standard_price:5999,active:true,is_demo:true},{product_id:'demo-v',series:'V',model:'V Demo',ram:8,storage:256,standard_price:12999,active:true,is_demo:true},{product_id:'demo-x',series:'X',model:'X Demo',ram:12,storage:256,standard_price:24999,active:true,is_demo:true}]};
