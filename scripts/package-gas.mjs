// Prepares source for review only; it does not create or update a deployment.
import fs from 'node:fs/promises';
import {build} from 'esbuild';

const files=['ProductionSetup.gs','Backend.gs','Registration.gs','Auth.gs','Migrations.gs','Bridge.gs'];
const sources=await Promise.all(files.map(file=>fs.readFile(`apps-script/${file}`,'utf8')));
const verifier=await build({entryPoints:['apps-script/google-token-verifier.js'],bundle:true,format:'iife',globalName:'GoogleTokenVerifier',target:'es2020',write:false});
await fs.mkdir('artifacts',{recursive:true});
await fs.writeFile('artifacts/Application.gs',verifier.outputFiles[0].text+'\n'+sources.join('\n'));
console.log('Prepared artifacts/Application.gs for review only. No deployment was made.');
