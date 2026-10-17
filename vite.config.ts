import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {spawn} from 'child_process';
import {defineConfig, Plugin} from 'vite';

let pythonBackendProcess: any = null;

function pythonBackendPlugin(): Plugin {
  return {
    name: 'python-backend-runner',
    configureServer() {
      // Check if backend on port 8080 is reachable, otherwise spawn uvicorn
      fetch('http://127.0.0.1:8080/health')
        .then(() => {
          console.log('[EduGuard] Python backend is already running on port 8080.');
        })
        .catch(() => {
          console.log('[EduGuard] Spawning Python FastAPI backend on port 8080...');
          pythonBackendProcess = spawn(
            'python3',
            ['-m', 'uvicorn', 'app.main:app', '--app-dir', './backend', '--port', '8080', '--host', '127.0.0.1'],
            {stdio: 'inherit'}
          );
          process.on('exit', () => {
            if (pythonBackendProcess) pythonBackendProcess.kill();
          });
        });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pythonBackendPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/scan': 'http://127.0.0.1:8080',
        '/incidents': 'http://127.0.0.1:8080',
        '/users': 'http://127.0.0.1:8080',
        '/permissions': 'http://127.0.0.1:8080',
        '/students': 'http://127.0.0.1:8080',
        '/access-logs': 'http://127.0.0.1:8080',
        '/health': 'http://127.0.0.1:8080',
        '/reload': 'http://127.0.0.1:8080',
        '/analyses': 'http://127.0.0.1:8080',
        '/auth': 'http://127.0.0.1:8080',
      },
    },
  };
});
