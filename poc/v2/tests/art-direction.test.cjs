'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const load=p=>fs.readFileSync(path.join(root,p));
const text=p=>load(p).toString('utf8');
const EXPECTED_SHA256=Object.freeze({
  A:'7b930af021851401d82b3d871178a95365b4ad833d1388e815c7656a89ac69da',
  B:'87b5d4f6dd4f1c562257780f9db81be5875df1e167bae703f47b837efd019165',
  C:'57af9d57444a4bf6d064a5a692cbe56aa741b018e71383f85ca205d5578c8f42'
});
test('three original compressed SVG art samples decode and preserve a single exact composition',()=>{
  const contents=[];
  for(const style of ['A','B','C']){
    const bytes=load('assets/styles/style-'+style+'.svgz');
    assert.equal(bytes.subarray(0,2).toString('hex'),'1f8b','real gzip SVG file');
    const svg=zlib.gunzipSync(bytes);
    assert.equal(crypto.createHash('sha256').update(svg).digest('hex'),EXPECTED_SHA256[style]);
    const source=svg.toString('utf8');
    assert.match(source,/^<svg\s/);
    assert.match(source,/viewBox="0 0 960 620"/);
    assert.match(source,/width="960" height="620"/);
    for(const xy of ['translate(544 461)','translate(364 474)','translate(468 526)']){
      assert.ok(source.includes(xy),style+' missing stable person footprint '+xy);
    }
    assert.ok(source.includes('<path')||source.includes('<rect'),'meaningful vector art');
    contents.push(source);
  }
  assert.equal(new Set(contents).size,3,'all styles require distinct original art');
});
test('same-scene viewer loads all three separated SVG assets and never embeds game logic',()=>{
  const html=text('art-exploration.html');
  const js=text('src/art-exploration.js');
  const css=text('assets/styles/art-exploration.css');
  for(const style of ['A','B','C'])assert.ok(html.includes('assets/styles/style-'+style+'.svgz'));
  assert.match(html,/href="village-review.html"/);
  assert.match(html,/src="src\/art-exploration.js"/);
  assert.match(html,/href="assets\/styles\/art-exploration.css"/);
  for(const mode of ['full','4x','8x'])assert.ok(html.includes('data-view="'+mode+'"'));
  assert.ok(css.includes("body[data-view='4x']")&&css.includes("body[data-view='8x']"));
  assert.ok(js.includes("document.body.dataset.artReady='true'"));
  assert.doesNotMatch(js,/\badvanceTicks\b|\bcastMiracle\b|\bMath\.random\s*\(/);
  assert.match(html,/非遊戲 Screenshot/);
});
test('Node 24 multi-file startup and original 8x game path are preserved without standalone parity',()=>{
  const packageJson=JSON.parse(text('package.json'));
  const serve=text('tools/serve.cjs');
  const index=text('index.html');
  assert.equal(packageJson.scripts.start,'node tools/serve.cjs');
  assert.equal(packageJson.engines.node,'>=24 <25');
  assert.equal(packageJson.scripts['test:art'],'node --test tests/art-direction.test.cjs');
  assert.match(serve,/\.svgz':\s*'image\/svg\+xml'/);
  assert.match(serve,/Content-Encoding/);
  assert.match(serve,/gzip/);
  assert.match(serve,/\.png':\s*'image\/png'/);
  assert.ok(index.includes('src/app.js')&&index.includes('assets/style-base.css'));
  assert.ok(fs.existsSync(path.join(root,'village-review.html')));
  for(const asset of ['pixel-villagers-v0.png','pixel-ground-v0.png','pixel-village-objects-v0.png']){
    assert.ok(fs.existsSync(path.join(root,'assets',asset)),'rollback art exists: '+asset);
  }
  assert.ok(fs.existsSync(path.join(root,'World-of-God-Playable.html')),'historical archive retained');
});
