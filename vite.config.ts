import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {cloudflare} from '@cloudflare/vite-plugin';
import {sites} from './build/sites-vite-plugin';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
 server:{host:'0.0.0.0',allowedHosts:['terminal.local']},
 plugins:[
  react(),
  sites({mockAuth:false}),
  cloudflare({inspectorPort:false,viteEnvironment:{name:'server'},config:{
   name:'fluxo',main:'worker/index.ts',compatibility_date:'2026-05-15',
   compatibility_flags:['nodejs_compat'],
   assets:{binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:['/api/*']},
   d1_databases:[{binding:'DB',database_name:'fluxo',database_id:'00000000-0000-4000-8000-000000000000'}]
  }})
 ]
});
