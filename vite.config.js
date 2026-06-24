import { defineConfig } from 'vite';

function githubPagesBase() {
  if (process.env.LIFEHUB_BASE) return process.env.LIFEHUB_BASE;
  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
    return `/${repoName}/`;
  }
  return './';
}

export default defineConfig({
  base: githubPagesBase(),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  }
});
