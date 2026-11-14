import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// './' works at any sub-path (GitHub Pages project sites). The workflow overrides it with /<repo>/.
export default defineConfig({base:process.env.BASE_PATH||'./',plugins:[react()]});
