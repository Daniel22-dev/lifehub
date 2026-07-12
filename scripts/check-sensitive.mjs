import fs from 'node:fs';
import path from 'node:path';

const roots=['src','tests','docs','public','README.md','CHANGELOG.md','index.html'];
const ignored=new Set(['public/vendor']);
const textExtensions=new Set(['.js','.mjs','.json','.md','.html','.css','.yml','.yaml','.txt']);
const forbidden=[
  /Baláž Daniel/i,
  /vyplatni-pasky-2026-01-az-06/i
];
const findings=[];

function scan(target){
  if(!fs.existsSync(target)) return;
  const stat=fs.statSync(target);
  if(stat.isDirectory()){
    if(ignored.has(target.replaceAll('\\\\','/'))) return;
    for(const name of fs.readdirSync(target)) scan(path.join(target,name));
    return;
  }
  if(!textExtensions.has(path.extname(target))) return;
  const text=fs.readFileSync(target,'utf8');
  forbidden.forEach(pattern=>{ if(pattern.test(text)) findings.push(`${target}: ${pattern}`); });
}
roots.forEach(scan);
if(findings.length){
  console.error('Kontrola citlivých dat selhala:\n'+findings.join('\n'));
  process.exit(1);
}
console.log('Sensitive-data check OK: ve zdrojovém balíku nejsou známé reálné mzdové fixtures ani zakázané identifikátory.');
