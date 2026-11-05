import catalogPatch from './catalog-patch.json';
import {createWriteQueue} from './writeQueue';
import {catalogId} from './catalogIds';
const env=import.meta.env;
export const productionConfig={clientId:env.VITE_GOOGLE_CLIENT_ID,bridgeUrl:env.VITE_APPS_SCRIPT_URL,sandboxOrigin:env.VITE_APPS_SCRIPT_SANDBOX_ORIGIN};
export const configured=Object.values(productionConfig).some(Boolean);
export const live=Object.values(productionConfig).every(Boolean);
export const staticProducts=catalogPatch.map(([series,model,ram,storage])=>({product_id:catalogId(series,model,ram,storage),series,model,ram,storage,standard_price:'',active:true,is_demo:false}));
export function useStaticCatalog(data){return data?{...data,products:staticProducts}:data;}
const writeActions=new Set(['addSale','deleteSale','approveSale','rejectSale','setTarget','addUser','detachUser','addFamily','approveRegistration','rejectRegistration']);
const enqueue=createWriteQueue(()=>typeof navigator==='undefined'||navigator.onLine!==false);
let gateway=null;
export function setGateway(value){gateway=value;}
export function call(action,payload={}){
 if(!live||!gateway)return Promise.reject(new Error('หน้าตัวอย่างนี้ไม่สามารถบันทึกข้อมูลจริงได้'));
 const current=gateway;
 const run=()=>{if(current!==gateway)throw new Error('บัญชีเปลี่ยนแล้ว กรุณาบันทึกอีกครั้ง');return current.call(action,action==='bootstrap'?{...payload,static_catalog:true}:payload);};
 return writeActions.has(action)?enqueue(run):run();
}
export const preview={actor:{user_id:'preview',name:'ผู้ดูแลระบบ',role:'ADMIN'},month:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).slice(0,7),users:[],sales:[],registrations:[],targets:[],families:[{family_id:'family-demo-1',name:'ทีมตัวอย่าง 1'}],branches:[],commissions:[],products:staticProducts};
