#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  console.error('Usage: build_article.js <raw-json> <output-dir>');
  process.exit(2);
}

const input = path.resolve(inputArg);
const out = path.resolve(outputArg);
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const tweet = data.tweet || data;
const article = tweet.article;
if (!article?.content?.blocks || !article?.content?.entityMap) {
  throw new Error('The payload does not contain an X Article body');
}

fs.mkdirSync(out, { recursive: true });
const chunksDir = path.join(out, 'chunks');
const imagesDir = path.join(out, 'images');
fs.mkdirSync(chunksDir, { recursive: true });
fs.mkdirSync(imagesDir, { recursive: true });

const sourceUrl = tweet.url;
if (!/^https:\/\/x\.com\/[^/]+\/status\/\d+/.test(sourceUrl || '')) throw new Error('Invalid source URL');
const entities = new Map(article.content.entityMap.map(x => [String(x.key), x.value]));
const media = new Map((article.media_entities || []).map(x => [String(x.media_id), x]));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function richText(block) {
  const text = block.text || '';
  const ranges = [...(block.inlineStyleRanges || [])].sort((a, b) => a.offset - b.offset);
  if (!ranges.length) return esc(text);
  let result = '', pos = 0;
  for (const r of ranges) {
    result += esc(text.slice(pos, r.offset));
    const value = esc(text.slice(r.offset, r.offset + r.length));
    const tag = ({ Bold: 'b', Italic: 'em', Underline: 'u', Strikethrough: 'del' })[r.style];
    result += tag ? `<${tag}>${value}</${tag}>` : value;
    pos = r.offset + r.length;
  }
  return result + esc(text.slice(pos));
}

const content = [];
const images = [];
for (const block of article.content.blocks) {
  if (block.type === 'header-one') content.push({ type: 'xml', xml: `<h1>${richText(block)}</h1>` });
  else if (block.type === 'header-two') content.push({ type: 'xml', xml: `<h2>${richText(block)}</h2>` });
  else if (block.type === 'unordered-list-item') content.push({ type: 'xml', xml: `<ul><li>${richText(block)}</li></ul>` });
  else if (block.type === 'ordered-list-item') content.push({ type: 'xml', xml: `<ol><li seq="auto">${richText(block)}</li></ol>` });
  else if (block.type === 'atomic') {
    const range = block.entityRanges?.[0];
    const entity = range ? entities.get(String(range.key)) : null;
    if (!entity) continue;
    if (entity.type === 'MARKDOWN') {
      const md = String(entity.data.markdown || '');
      const fenced = md.match(/^```([^\n]*)\n([\s\S]*?)\n```$/);
      content.push({ type: 'xml', xml: fenced
        ? `<pre lang="${esc(fenced[1] || 'text')}"><code>${esc(fenced[2])}</code></pre>`
        : `<p>${esc(md).replace(/\n/g, '<br/>')}</p>` });
    } else if (entity.type === 'MEDIA') {
      const id = String(entity.data.mediaItems?.[0]?.mediaId || '');
      const item = media.get(id);
      if (!item) throw new Error(`Missing media entity ${id}`);
      const baseUrl = item.media_info.original_img_url;
      const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}name=orig`;
      const ext = path.extname(new URL(baseUrl).pathname) || '.jpg';
      const name = `${String(images.length + 1).padStart(2, '0')}_${id}${ext}`;
      const image = { id, name, url, width: item.media_info.original_img_width, height: item.media_info.original_img_height };
      images.push(image);
      content.push({ type: 'image', image });
    }
  } else if (block.text) content.push({ type: 'xml', xml: `<p>${richText(block)}</p>` });
}

const skeleton = [
  `<title>${esc(article.title)}</title>`,
  `<p>🔗 原文链接： <a href="${esc(sourceUrl)}">${esc(sourceUrl)}</a></p>`,
  '<hr/>'
];
fs.writeFileSync(path.join(out, 'skeleton.xml'), skeleton.join('\n'), 'utf8');

const expected = [...skeleton];
const plan = [];
let buffer = [], chunkNo = 1;
function flush() {
  if (!buffer.length) return;
  const name = `${String(chunkNo++).padStart(2, '0')}.xml`;
  fs.writeFileSync(path.join(chunksDir, name), buffer.join('\n'), 'utf8');
  plan.push({ type: 'text', file: `chunks/${name}` });
  buffer = [];
}
for (const item of content) {
  if (item.type === 'image') {
    flush();
    plan.push({ type: 'image', file: `images/${item.image.name}`, name: item.image.name, width: Math.min(800, item.image.width), original_width: item.image.width, original_height: item.image.height });
    expected.push(`<img name="${esc(item.image.name)}"/>`);
  } else {
    buffer.push(item.xml);
    expected.push(item.xml);
    if (buffer.length >= 18) flush();
  }
}
flush();

fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8');
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(images, null, 2), 'utf8');
fs.writeFileSync(path.join(out, 'downloads.tsv'), images.map(x => `${x.url}\t${x.name}`).join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(out, 'expected.xml'), expected.join('\n'), 'utf8');
console.log(JSON.stringify({ title: article.title, sourceUrl, sourceBlocks: article.content.blocks.length, headings: content.filter(x => /^<h[12]>/.test(x.xml || '')).length, codeBlocks: content.filter(x => /^<pre /.test(x.xml || '')).length, images: images.length, planSteps: plan.length }, null, 2));

