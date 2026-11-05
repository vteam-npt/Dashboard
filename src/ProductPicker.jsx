import React, {useMemo, useState} from 'react';
import {Search, Check, ChevronRight} from 'lucide-react';
import {formatVariant} from './formatVariant';

// Stock Handoff uses a hierarchy and search to avoid a long flat model list.
export function ProductPicker({products, value, onChange}) {
  const active = useMemo(() => products.filter(p => p.active), [products]);
  const selected = active.find(p => p.product_id === value);
  const [series, setSeries] = useState(selected?.series || 'Y');
  const [model, setModel] = useState(selected?.model || '');
  const [query, setQuery] = useState('');
  const seriesList = [...new Set(active.map(p => p.series))].sort((a,b) => ['Y','V','X','Other'].indexOf(a)-['Y','V','X','Other'].indexOf(b));
  const matches = active.filter(p => [p.series,p.model,p.ram,p.storage].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const models = [...new Set(matches.filter(p => p.series === series).map(p => p.model))];
  const variants = matches.filter(p => p.series === series && p.model === model);
  const selectModel = name => {
    setModel(name);
    onChange(null);
    const options = matches.filter(p => p.series === series && p.model === name);
    if (options.length === 1) onChange(options[0]);
  };
  return <div className="product-picker">
    <label className="product-search"><Search size={17}/><input aria-label="ค้นหารุ่นสินค้า" placeholder="ค้นหารุ่น เช่น Y หรือ V" value={query} onChange={e => {const q=e.target.value;setQuery(q);setModel('');if(q.trim()){const found=active.find(p=>[p.series,p.model,p.ram,p.storage].join(' ').toLowerCase().includes(q.trim().toLowerCase()));if(found)setSeries(found.series);}}}/></label>
    <div className="picker-step"><span>1</span> เลือกซีรีส์</div>
    <div className="series-tabs" role="group" aria-label="เลือกซีรีส์">{seriesList.map(s => <button type="button" key={s} aria-pressed={series===s} className={series===s?'selected':''} onClick={() => {setSeries(s);setModel('');onChange(null);}}>{s} {s!=='Other'&&<small>Series</small>}</button>)}</div>
    <div className="picker-step"><span>2</span> เลือกรุ่น</div>
    {models.length ? <div className="model-grid">{models.map(name => <button type="button" key={name} aria-pressed={model===name} className={model===name?'selected':''} onClick={() => selectModel(name)}><span>{name}</span><ChevronRight size={16}/></button>)}</div> : <p className="picker-empty">ไม่พบรุ่นในซีรีส์นี้ ลองค้นหาชื่ออื่นหรือเลือกซีรีส์อื่น</p>}
    {model && <><div className="picker-step"><span>3</span> เลือกความจุ</div><div className="variant-grid">{variants.map(p => <button type="button" key={p.product_id} aria-pressed={value===p.product_id} className={value===p.product_id?'selected':''} onClick={() => onChange(p)}><span>{formatVariant(p)||'เลือกสินค้า'}</span>{value===p.product_id&&<Check size={16}/>}</button>)}</div></>}
    <div className="picker-current">{selected ? <>เลือกแล้ว <b>{selected.model} · {formatVariant(selected)}</b></> : 'กรุณาเลือกรุ่นและความจุ'}</div>
  </div>;
}
