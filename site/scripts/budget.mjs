// Size gate, run after a build.
//   first screen: JavaScript that index.html loads without the visitor doing anything  <= 60 KB gzipped
//   whole site:   all JavaScript                                                      <= 150 KB gzipped
//   data:         any file under dist/data                                            <= 200 KB
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, relative, resolve } from 'node:path';

const DIST = 'dist';
const FIRST_SCREEN = 60 * 1024, WHOLE_SITE = 150 * 1024, DATA_FILE = 200 * 1024;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

if (!existsSync(join(DIST, 'index.html'))) { console.error('no dist/index.html: run "npm run build" first'); process.exit(1); }

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const gz = (file) => gzipSync(readFileSync(file)).length;

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const eager = new Set([...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1].replace(/^\//, '').replace(/^.*?(_astro\/)/, '$1')));
// A first-screen module loads everything it imports statically, so those files count too.
const staticImports = (code) => [...code.matchAll(/(?:\bfrom|\bimport)\s*["'](\.{1,2}\/[^"']+\.js)["']/g)].map((m) => m[1]);
const queue = [...eager].map((rel) => ({ rel, code: null }));
if (inline) queue.push({ rel: '_astro/inline.js', code: inline });
while (queue.length) {
  const { rel, code } = queue.pop();
  const file = join(DIST, rel);
  if (code === null && !existsSync(file)) continue;
  for (const spec of staticImports(code ?? readFileSync(file, 'utf8'))) {
    const next = relative(DIST, resolve(dirname(file), spec));
    if (!eager.has(next)) { eager.add(next); queue.push({ rel: next, code: null }); }
  }
}

const js = walk(DIST).filter((f) => f.endsWith('.js'));
let first = inline ? gzipSync(inline).length : 0, total = first, failed = false;
if (inline) console.log(`first   inline scripts in index.html  ${kb(first)}`);
for (const file of js) {
  const rel = relative(DIST, file), size = gz(file), isFirst = eager.has(rel);
  total += size;
  if (isFirst) first += size;
  console.log(`${isFirst ? 'first  ' : 'lazy   '} ${rel}  ${kb(size)}`);
}
console.log(`first screen ${kb(first)} of ${kb(FIRST_SCREEN)}`);
console.log(`whole site   ${kb(total)} of ${kb(WHOLE_SITE)}`);
if (first > FIRST_SCREEN) { console.error('  first screen is over budget'); failed = true; }
if (total > WHOLE_SITE) { console.error('  whole site is over budget'); failed = true; }

const dataDir = join(DIST, 'data');
if (existsSync(dataDir)) {
  for (const file of walk(dataDir)) {
    const size = statSync(file).size;
    if (size > DATA_FILE) { console.error(`  ${relative(DIST, file)} is ${kb(size)}, over ${kb(DATA_FILE)}`); failed = true; }
  }
}
process.exit(failed ? 1 : 0);
