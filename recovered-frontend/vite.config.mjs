import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolveDashboardEnvironment, QA_FRONTEND_HOST } from './src/config/environmentPolicy.js';
import { buildQaHeaders } from './src/config/qaHeaders.js';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_');
  const config = resolveDashboardEnvironment(environment, mode === 'qa' ? QA_FRONTEND_HOST : '');
  if (config.isQa !== (mode === 'qa')) throw new Error('QA configuration requires the explicit QA build mode');
  const qaHeaders = mode === 'qa' ? {
    name: 'isolated-dashboard-qa-headers',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: buildQaHeaders(environment) });
    },
  } : null;
  return {
  // This changes the out put dir from dist to build
  // comment this out if that isn't relevant for your project
  build: {
    outDir: "build",
    chunkSizeWarningLimit: 2000,
  },
  plugins: [tsconfigPaths(), react(), ...(qaHeaders ? [qaHeaders] : [])],
  server: {
    port: "4028",
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: ['.amazonaws.com', '.builtwithrocket.new']
  }
  };
});
