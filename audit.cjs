const src  = require('fs').readFileSync('src/main.js',  'utf8');
const html = require('fs').readFileSync('index.html',   'utf8');

// 1. Check for stray require() calls
const lines = src.split('\n');
let warned = false;
lines.forEach((l, i) => {
  if (l.includes('require(')) {
    console.log('WARN require() at line', i + 1, ':', l.trim());
    warned = true;
  }
});
if (!warned) console.log('No stray require() calls ✓');

// 2. Check all getElementById() refs exist as id="..." in HTML
const re  = /getElementById\(['"]([^'"]+)['"]\)/g;
const ids = [];
let m;
while ((m = re.exec(src)) !== null) ids.push(m[1]);

const missing = [];
const seen    = new Set();
ids.forEach(id => {
  if (!seen.has(id) && !html.includes('id="' + id + '"')) {
    missing.push(id);
    seen.add(id);
  }
});

if (missing.length) {
  console.log('MISSING DOM IDs (', missing.length, '):', missing.join(', '));
} else {
  console.log('All', ids.length, 'DOM ID references found in index.html ✓');
}

// 3. Check all querySelectorAll data-view values have matching nav buttons
const views = [];
const rv = /data-view="([^"]+)"/g;
let mv;
while ((mv = rv.exec(html)) !== null) views.push(mv[1]);
console.log('Nav views defined:', [...new Set(views)].join(', '));
