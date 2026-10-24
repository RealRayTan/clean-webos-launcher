const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

test('frontend poster.css eliminates 1080p real-time blur and suppresses dialog overdraw', () => {
  const css = fs.readFileSync(path.join(rootDir, 'app', 'poster.css'), 'utf8');

  // No full-screen blur filters on cover layers
  assert.doesNotMatch(css, /filter:\s*blur\(/, 'cover layers must not use expensive real-time filter: blur()');

  // No backdrop-filter blur in light theme
  assert.doesNotMatch(css, /backdrop-filter:\s*blur\(/, 'theme elements must not use GPU backdrop-filter blur');

  // Must suppress cover visibility when dialog is open to avoid alpha overdraw
  assert.match(
    css,
    /\.scene\[data-dialog-open="true"\]\s+\.cover\s*\{\s*visibility:\s*hidden;\s*\}/,
    'must hide .cover when dialog is open'
  );
});

test('frontend sources.css optimizes infinite animations and shadow rasterization', () => {
  const css = fs.readFileSync(path.join(rootDir, 'app', 'sources.css'), 'utf8');

  // source-pulse keyframes must not trigger composite transforms
  assert.doesNotMatch(css, /@keyframes\s+source-pulse\s*\{[^}]*transform:\s*scale/, 'source-pulse must not scale');

  // Dots should avoid expensive box-shadow blurs
  assert.doesNotMatch(css, /\.source-dot\s*\{[^}]*box-shadow:/, 'source-dot must not use dynamic box-shadow blur');

  // trending.css cinema-card must not use backdrop-filter blur or scaling/floating transforms
  const trendingCss = fs.readFileSync(path.join(rootDir, 'app', 'trending.css'), 'utf8');
  assert.doesNotMatch(trendingCss, /\.cinema-card\s*\{[^}]*backdrop-filter:\s*blur/, 'cinema-card must not use backdrop-filter blur');
  assert.doesNotMatch(trendingCss, /\.cinema-card\.focus[^{]*\{[^}]*scale\(/, 'cinema-card.focus must not scale');
  assert.doesNotMatch(trendingCss, /\.cinema-card\.focus[^{]*\{[^}]*translateY\(/, 'cinema-card.focus must not float translateY');

  // app.js must not inject inline scale transforms onto cinema cards
  const appJs = fs.readFileSync(path.join(rootDir, 'app', 'app.js'), 'utf8');
  assert.doesNotMatch(appJs, /cinemaCardNodes\[[^\]]*\][^{]*scale:/, 'app.js must not animate scale on cinemaCardNodes');
});

test('frontend benchmark.js and pool.js load in index.html', () => {
  const html = fs.readFileSync(path.join(rootDir, 'app', 'index.html'), 'utf8');
  assert.match(html, /<script src="benchmark\.js"><\/script>/, 'index.html must load benchmark.js');
  assert.match(html, /<script src="pool\.js"><\/script>/, 'index.html must load pool.js');

  const benchmarkCode = fs.readFileSync(path.join(rootDir, 'app', 'benchmark.js'), 'utf8');
  const context = { window: {}, console, location: { search: '' } };
  vm.createContext(context);
  vm.runInContext(benchmarkCode, context);
  assert.equal(typeof context.window.runScrollBenchmark, 'function', 'runScrollBenchmark must be a function on window');
});

test('tools/profile.py and tools/debloat.py CLI argument and syntax validation', () => {
  const profileHelp = execFileSync('python3', [path.join(rootDir, 'tools', 'profile.py'), '--help'], { encoding: 'utf8' });
  assert.match(profileHelp, /--json/, 'profile.py must support --json');

  const debloatHelp = execFileSync('python3', [path.join(rootDir, 'tools', 'debloat.py'), '--help'], { encoding: 'utf8' });
  assert.match(debloatHelp, /\{status,plan,apply,restore\}/, 'debloat.py must support status, plan, apply, restore');

  // debloat.py plan works without connecting to TV
  const debloatPlan = execFileSync('python3', [path.join(rootDir, 'tools', 'debloat.py'), 'plan'], { encoding: 'utf8' });
  assert.match(debloatPlan, /LG webOS 优化瘦身计划/, 'plan action must describe debloat plan');
  assert.match(debloatPlan, /com\.webos\.app\.lgchannels/, 'plan must target lgchannels');
  assert.match(debloatPlan, /livePlus/, 'plan must target livePlus ACR');
});
