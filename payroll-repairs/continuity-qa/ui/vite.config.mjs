import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const p=name=>fileURLToPath(new URL(name,import.meta.url));
export default defineConfig({root:p('.'),plugins:[react()],resolve:{alias:[
{find:/.*config\/dashboardEnvironment$/,replacement:p('config.js')},
{find:/.*contexts\/AuthContext$/,replacement:p('auth.jsx')},
{find:/.*\/supabase(?:\.js)?$/,replacement:p('supabase.js')},
{find:/.*services\/(payrollService|dentrixNormalizedService|ascendApi)$/,replacement:p('ancillary.js')}
]},build:{outDir:p('../qa-browser-build'),emptyOutDir:true}});
