// Drafts are scoped to the signed-in employee and never sent automatically.
export function createSaleCart(storage,userId){
 const key='vivo-sale-cart-v1:'+encodeURIComponent(userId);
 const read=()=>{const raw=storage.getItem(key);if(!raw)return [];let items;try{items=JSON.parse(raw)}catch(_){throw new Error('ไม่สามารถอ่านตะกร้าที่บันทึกไว้ได้')}if(!Array.isArray(items)||items.some(item=>!item||typeof item.request_id!=='string'))throw new Error('ข้อมูลตะกร้าไม่ถูกต้อง');return items;};
 const write=items=>{storage.setItem(key,JSON.stringify(items));if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('vivo-cart-updated',{detail:key}));};
 return {key,read,add(item){const items=read();if(items.some(x=>x.request_id===item.request_id))throw new Error('มีรายการนี้ในตะกร้าแล้ว');items.push(item);write(items);return items;},remove(id){const items=read().filter(item=>item.request_id!==id);write(items);return items;}};
}
// Only remove an item after the server acknowledges it; retries keep its request_id.
export async function submitSaleCart(cart,send,onChange=()=>{}){
 const pending=cart.read(),confirmed=[];
 for(const item of pending){
  try{
   if(!cart.read().some(current=>current.request_id===item.request_id))continue;
   const result=await send({request_id:item.request_id,product_id:item.product_id,price:item.price,payment_method:item.payment_method,sold_at:item.sold_at});
   if(!result?.sale_id)throw new Error('ไม่ได้รับการยืนยันจากระบบ');
   const remaining=cart.remove(item.request_id);confirmed.push(result);onChange(remaining,confirmed.length);
  }catch(error){return {confirmed,error};}
 }
 return {confirmed,error:null};
}
