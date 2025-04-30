const { build } = require('esbuild');
const path = require('path');

async function buildServer() {
  try {
    await build({
      entryPoints: ['server/index.js'],
      bundle: true,
      platform: 'node',
      target: 'node16',
      outfile: 'dist/index.js',
      format: 'cjs',
      external: ['pg-native', 'canvas', 'aws-crt', 'utf-8-validate', 'bufferutil'],
    });
    console.log('✅ Server build complete');
  } catch (err) {
    console.error('❌ Server build failed:', err);
    process.exit(1);
  }
}

buildServer();
