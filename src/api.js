import catalogPatch from './catalog-patch.json';
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
export const preview={actor:{user_id:'preview',name:'ผู้ดูแลระบบ',role:'ADMIN'},month:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).slice(0,7),users:[],sales:[],registrations:[],targets:[],families:[{family_id:'family-demo-1',name:'ทีมตัวอย่าง 1'}],branches:[],campaigns:[],commissions:catalogPatch.map(([series,model,ram,storage,amount],i)=>({product_id:'preview-'+i,amount})),products:catalogPatch.map(([series,model,ram,storage],i)=>({product_id:'preview-'+i,series,model,ram,storage,standard_price:'',active:true,is_demo:false}))};
