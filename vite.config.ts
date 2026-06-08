import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

const getGitValue = (command: string) => {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const appVersion = process.env.npm_package_version || '1.0.0';
const commitHash =
  process.env.VITE_APP_COMMIT_HASH ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  getGitValue('git rev-parse --short HEAD');
const branchName =
  process.env.VITE_APP_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  getGitValue('git rev-parse --abbrev-ref HEAD');
const buildTimestamp =
  process.env.VITE_APP_BUILD_TIMESTAMP ||
  process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE ||
  process.env.VERCEL_GIT_COMMIT_COMMITTER_DATE ||
  new Date().toISOString();
const buildTarget = process.env.VITE_APP_BUILD_TARGET || (process.env.VERCEL ? 'vercel' : 'local');
const commitMessage =
  process.env.VITE_APP_COMMIT_MESSAGE ||
  process.env.VERCEL_GIT_COMMIT_MESSAGE ||
  getGitValue('git log -1 --pretty=%s');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    __APP_COMMIT_HASH__: JSON.stringify(commitHash),
    __APP_BRANCH__: JSON.stringify(branchName),
    __APP_BUILD_TARGET__: JSON.stringify(buildTarget),
    __APP_COMMIT_MESSAGE__: JSON.stringify(commitMessage)
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    }
  },
});
