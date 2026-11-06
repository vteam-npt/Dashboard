import catalogPatch from './catalog-patch.json';
import {createWriteQueue} from './writeQueue';
import {catalogId} from './catalogIds';
const env=import.meta.env;
export const productionConfig={clientId:env.VITE_GOOGLE_CLIENT_ID,bridgeUrl:env.VITE_APPS_SCRIPT_URL,sandboxOrigin:env.VITE_APPS_SCRIPT_SANDBOX_ORIGIN};
export const configured=Boolean(productionConfig.bridgeUrl||productionConfig.sandboxOrigin);
export const live=Boolean(productionConfig.bridgeUrl&&productionConfig.sandboxOrigin);
export const staticProducts=catalogPatch.map(([series,model,ram,storage,commission,price])=>({product_id:catalogId(series,model,ram,storage),series,model,ram,storage,standard_price:price,base_commission:commission,active:true,is_demo:false}));
export function useStaticCatalog(data){return data?{...data,products:staticProducts}:data;}
const writeActions=new Set(['syncDeletes','syncSales','addSale','deleteSale','approveSale','rejectSale','setTarget','addUser','detachUser','addFamily','approveRegistration','rejectRegistration','pinApprove','pinReject','adminSetPin']);
const enqueue=createWriteQueue(()=>typeof navigator==='undefined'||navigator.onLine!==false);
let gateway=null;
export function setGateway(value){gateway=value;}
export function call(action,payload={},expectedSession=null){
 if(!live||!gateway)return Promise.reject(new Error('หน้าตัวอย่างนี้ไม่สามารถบันทึกข้อมูลจริงได้'));
 const current=gateway;
 const run=()=>{if(current!==gateway||(expectedSession&&(expectedSession.gateway!==current||expectedSession.version!==current.sessionVersion())))throw new Error('บัญชีเปลี่ยนแล้ว กรุณาเข้าสู่ระบบบัญชีเดิมก่อนส่งอีกครั้ง');return current.call(action,action==='bootstrap'?{...payload,static_catalog:true}:payload);};
 return writeActions.has(action)?enqueue(run):run();
}
export function bindSessionCall(){const expected={gateway,version:gateway?.sessionVersion()};return (action,payload)=>call(action,payload,expected);}
export const preview={actor:{user_id:'preview',name:'ผู้ดูแลระบบ',role:'ADMIN'},month:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).slice(0,7),users:[],sales:[],registrations:[],targets:[],families:[{family_id:'family-demo-1',name:'ทีมตัวอย่าง 1'}],branches:[],commissions:[],products:staticProducts};
