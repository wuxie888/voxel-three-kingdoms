// Web build for the deploy: the official site (site/: index.html, img/, media/) at the root and the game under /play/ —
// one minified, content-hashed game-<hash>.js (three tree-shaken in) instead of ~60 module requests, index.html pointed
// at it, and its static assets — written as a Vercel prebuilt output (.vercel/output: static/ + config.json, hashed
// bundle cached immutably). The source tree itself still runs as-is (the game at its root).
// Usage: node tools/build.mjs [--deploy]   (needs esbuild: npm i esbuild, or NODE_PATH to a folder that has it)
//        --deploy runs `vercel deploy --prebuilt --prod` afterwards.
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const root = path.resolve(import.meta.dirname, '..');
const outRoot = path.join(root, '.vercel/output'), site = path.join(outRoot, 'static'), out = path.join(site, 'play');
fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const res = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, format: 'esm', minify: true, target: 'es2022', charset: 'utf8', legalComments: 'eof', write: false,
  alias: { 'three/addons': path.join(root, 'vendor/three/addons'), three: path.join(root, 'vendor/three/three.module.js') },
});
const js = res.outputFiles[0].contents;
const name = `game-${crypto.createHash('sha256').update(js).digest('hex').slice(0, 10)}.js`;
fs.writeFileSync(path.join(out, name), js);

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const n0 = html.length;
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\n/, '').replace('src="./src/main.js"', `src="./${name}"`);
if (html.length === n0 || !html.includes(name)) throw new Error('index.html: importmap / entry script not found');
fs.writeFileSync(path.join(out, 'index.html'), html);
for (const f of ['icon.png', 'og.jpg', 'src/ui/brush.woff2']) {
  fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
  fs.copyFileSync(path.join(root, f), path.join(out, f));
}
// the official site: site/ as it is, plus the share card and the icon at the root
fs.cpSync(path.join(root, 'site'), site, { recursive: true });
for (const f of ['icon.png', 'og.jpg']) fs.copyFileSync(path.join(root, f), path.join(site, f));
// macOS leaves AppleDouble "._*" files beside everything written to exFAT / FAT drives (like this repo's): not shipped
const sweep = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (f.startsWith('._')) fs.rmSync(p); else if (fs.statSync(p).isDirectory()) sweep(p); } };
sweep(site);
fs.writeFileSync(path.join(outRoot, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '^/play$', status: 308, headers: { location: '/play/' } },
    { src: '^/play/game-[0-9a-f]+\\.js$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '^/(img|media)/.*', headers: { 'cache-control': 'public, max-age=86400' }, continue: true },
  ],
}, null, 2));
sweep(outRoot);

const kb = (b) => `${(b / 1024).toFixed(0)} KB`;
console.log(`${name} ${kb(js.length)} (gzip ≈ ${kb(execFileSync('gzip', ['-9c'], { input: js }).length)}) → ${path.relative(root, out)}; site → ${path.relative(root, site)}`);
if (process.argv.includes('--deploy')) execFileSync('vercel', ['deploy', '--prebuilt', '--prod', '--yes'], { cwd: root, stdio: 'inherit' });
