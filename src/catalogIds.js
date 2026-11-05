// These are persistent IDs already used in the production sales records.
const existingSkuIds={'X|X300|12|256':'1a4f9b89-b10e-4de4-b6d0-f7fdb1bc6b83'};
export const catalogId=(series,model,ram,storage)=>existingSkuIds[[series,model,ram,storage].join('|')]||'catalog-202611-'+`${series}-${model}-${ram}-${storage}`.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
