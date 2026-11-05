// RAM and storage values are stored as GB, including 1024 GB for 1 TB.
export function formatVariant(product) {
 const ram=product.ram,storage=product.storage;
 if(!ram&&!storage)return '';
 const capacity=Number(storage)===1024?'1 TB':storage?`${storage} GB`:'';
 return [ram?`${ram} GB`:'',capacity].filter(Boolean).join(' / ');
}
