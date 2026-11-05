import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import anime from 'animejs/lib/anime.es.js';
import {ArrowLeft, Banknote, CreditCard, Landmark, Check, LoaderCircle} from 'lucide-react';
import './radial-sale.css';
import {RadialGlass} from './RadialGlass';
import vivoLogo from '../Vivo-Logo-500x281.png';

const polar=(r,a)=>{const n=(a-90)*Math.PI/180;return [200+r*Math.cos(n),200+r*Math.sin(n)];};
function segment(start,end){
 const outer=188,inner=112,corner=11,oi=Math.asin(corner/outer)*180/Math.PI,ii=Math.asin(corner/inner)*180/Math.PI,large=end-start>180?1:0;
 const point=(r,a)=>polar(r,a).map(n=>n.toFixed(2)).join(' ');
 return `M ${point(outer,start+oi)} A ${outer} ${outer} 0 ${large} 1 ${point(outer,end-oi)} Q ${point(outer,end)} ${point(outer-corner,end)} L ${point(inner+corner,end)} Q ${point(inner,end)} ${point(inner,end-ii)} A ${inner} ${inner} 0 ${large} 0 ${point(inner,start+ii)} Q ${point(inner,start)} ${point(inner+corner,start)} L ${point(outer-corner,start)} Q ${point(outer,start)} ${point(outer,start+oi)} Z`;
}
const nowLocal=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,16);
export function RadialSale({data,staff,team,busy,onSave}){
 const active=useMemo(()=>data.products.filter(p=>p.active),[data.products]);
 const [series,setSeries]=useState(''),[model,setModel]=useState(''),[product,setProduct]=useState(null),[hover,setHover]=useState(-1),[price,setPrice]=useState(''),[payment,setPayment]=useState(''),[sold,setSold]=useState(nowLocal),[notice,setNotice]=useState('');
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const [transition,setTransition]=useState('entering');
 const wheelRef=useRef(null),transitionLock=useRef(false),timer=useRef(null);
 useEffect(()=>()=>{clearTimeout(timer.current);if(wheelRef.current)anime.remove(wheelRef.current.querySelectorAll('.radial-segment'));},[]);
 const changeWheel=action=>{
  if(transitionLock.current)return;
  transitionLock.current=true;setTransition('exiting');
  const finish=()=>{action();transitionLock.current=false;setTransition('entering');};
  const groups=wheelRef.current?.querySelectorAll('.radial-segment');
  if(groups?.length){anime.remove(groups);anime({targets:groups,scale:0,opacity:0,easing:'easeInBack',duration:190,complete:finish});}
  else timer.current=setTimeout(finish,190);
 };
 const matching=active;
 const seriesList=[...new Set(matching.map(p=>p.series))].sort((a,b)=>['Y','V','X'].indexOf(a)-['Y','V','X'].indexOf(b));
 const models=[...new Set(matching.filter(p=>p.series===series).map(p=>p.model))];
 const variants=matching.filter(p=>p.series===series&&p.model===model);
 const items=!series?seriesList.map(v=>({label:v+' Series',value:v})):!model?models.map(v=>({label:v,value:v})):variants.map(v=>({label:`${v.ram} / ${v.storage} GB`,value:v.product_id}));
 const wheelKey=JSON.stringify([series,model,product?.product_id||'',items.map(item=>item.value)]);
 useLayoutEffect(()=>{
  const groups=wheelRef.current?.querySelectorAll('.radial-segment');
  if(!groups?.length){timer.current=setTimeout(()=>setTransition('idle'),280);return()=>clearTimeout(timer.current);}
  anime.remove(groups);
  anime({targets:groups,scale:[0,1],opacity:[0,1],easing:'easeOutElastic(1, .65)',duration:740,delay:anime.stagger(55),complete:()=>setTransition(current=>current==='entering'?'idle':current)});
  return()=>anime.remove(groups);
 },[wheelKey]);
 const choose=i=>{const item=items[i];if(!item)return;changeWheel(()=>{if(!series){setSeries(item.value);}else if(!model){setModel(item.value);}else{const p=active.find(x=>x.product_id===item.value);if(p){setProduct(p);setPrice(p.is_demo===true||p.is_demo==='TRUE'?'':p.standard_price);setPayment('');setNotice('');}}setHover(-1);});};
 const back=()=>{if(product){if(transitionLock.current)return;setProduct(null);setPayment('');return;}changeWheel(()=>{if(model)setModel('');else if(series)setSeries('');setHover(-1);});};
 const home=()=>{if(transitionLock.current)return;if(product){setProduct(null);setSeries('');setModel('');setPayment('');setHover(-1);return;}changeWheel(()=>{setSeries('');setModel('');setHover(-1);});};
 const submit=async e=>{e.preventDefault();if(!payment){setNotice('กรุณาเลือกช่องทางชำระเงิน');return;}if(!staff){setNotice('หน้านี้สำหรับพนักงาน กรุณาเพิ่มรายการผ่านเมนูรายการขาย');return;}setNotice('');const success=await onSave({request_id:requestId,product_id:product.product_id,price,payment_method:payment,sold_at:sold+':00+07:00'});if(success){setProduct(null);setSeries('');setModel('');setPayment('');setRequestId(crypto.randomUUID());setSold(nowLocal());}};
 return <section className="radial-page"><div className="radial-heading"><h1>{product?'เลือกช่องทางชำระเงิน':'เลือกสินค้า'}</h1><p>{product?'โปรดตรวจสอบข้อมูลก่อนบันทึกยอดขาย':'โปรดเลือกซีรีส์ รุ่น และความจุ'}</p></div>
 {!product?<><div className="radial-tools">{(series||model)&&<><button type="button" className="radial-back" disabled={transition==='exiting'} onClick={back}><ArrowLeft size={16}/> ย้อนกลับ</button><button type="button" className="radial-back" disabled={transition==='exiting'} onClick={home}>หน้าแรก</button></>}</div><div className="radial-crumb">{series||'ซีรีส์'} <span>›</span> {model||'รุ่น'} <span>›</span> ความจุ</div>
 {items.length>8?<div className={"radial-list "+transition}>{items.map((item,i)=><button key={item.value} type="button" disabled={transition==='exiting'} onClick={()=>choose(i)}>{item.label}<span>›</span></button>)}</div>:<div className={"radial-wheel "+transition}><RadialGlass count={items.length}/><svg ref={wheelRef} viewBox="0 0 400 400" aria-label="เมนูเลือกรุ่นสินค้า"><defs><linearGradient id="tileGlass" x1="0" y1="0" x2="0.75" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".76"/><stop offset=".42" stopColor="#eef5ff" stopOpacity=".34"/><stop offset="1" stopColor="#aabfec" stopOpacity=".50"/></linearGradient><filter id="tileShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#526aab" floodOpacity=".26"/></filter></defs>{items.map((item,i)=>{const step=360/items.length,start=i*step+2,end=(i+1)*step-2,mid=(start+end)/2,[x,y]=polar(150,mid);return <g key={`${series}-${model}-${item.value}`} role="button" tabIndex={transition==='idle'?0:-1} aria-disabled={transition==='exiting'} aria-label={item.label} onClick={()=>choose(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(i);}}} className={hover===i?'radial-segment active':'radial-segment'}><path d={segment(start,end)}/><foreignObject x={x-49} y={y-27} width="98" height="54"><div className="radial-label">{item.label}</div></foreignObject></g>;})}</svg><div className="radial-hub" aria-hidden="true"><img className="radial-logo" src={vivoLogo} alt=""/><span>{!series?'เลือกซีรีส์':!model?'เลือกรุ่น':'เลือกความจุ'}</span></div></div>}
 {!items.length&&<p className="radial-empty">ไม่พบสินค้า</p>}</>:<form className="radial-checkout" onSubmit={submit}><button type="button" className="radial-back" disabled={transition==='exiting'} onClick={back}><ArrowLeft size={16}/> เปลี่ยนรุ่น</button> <button type="button" className="radial-back" disabled={transition==='exiting'} onClick={home}>หน้าแรก</button><div className="radial-selected"><div className="radial-device"><span>vivo</span><b>{product.series}</b></div><div><small>ข้อมูลสินค้า</small><h2>{product.model}</h2><p>{product.ram} / {product.storage} GB</p></div><Check size={20}/></div><div className="radial-payment-title">ช่องทางชำระเงิน</div><div className="radial-payments">{[['cash','เงินสด',Banknote],['credit','บัตรเครดิต',CreditCard],['financing','สินเชื่อ',Landmark]].map(([id,label,Icon])=><button type="button" key={id} aria-pressed={payment===id} className={payment===id?'selected':''} onClick={()=>{setPayment(id);setNotice('');}}><Icon size={23}/><span>{label}</span></button>)}</div>
 <div className="radial-details"><label>ราคาขายจริง (บาท)<input required type="number" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>วันและเวลาขาย<input required type="datetime-local" value={sold} min={nowLocal().slice(0,7)+'-01T00:00'} max={nowLocal()} onChange={e=>setSold(e.target.value)}/></label></div>{(product.is_demo===true||product.is_demo==='TRUE')&&<p className="radial-note">สินค้าเดโม · กรุณาระบุราคาขายจริง · ค่าคอมเริ่มต้น 0 บาท</p>}<p className="radial-note">ยอดย้อนหลังต้องรอหัวหน้าอนุมัติ · คอมมิชชันเป็นยอดประมาณการ</p>{notice&&<p className="radial-error" role="alert">{notice}</p>}<button className="radial-save" disabled={busy} type="submit">{busy?<><LoaderCircle className="spin" size={18}/> กำลังบันทึก</>:<><Check size={18}/> บันทึกยอดขาย</>}</button></form>}</section>;
}
