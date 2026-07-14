import fs from 'node:fs';
import path from 'node:path';

const roots=['src','tests','docs','public','README.md','CHANGELOG.md','index.html'];
const ignored=new Set(['public/vendor']);
const textExtensions=new Set(['.js','.mjs','.json','.md','.html','.css','.yml','.yaml','.txt']);
const forbiddenContent=[
  /Baláž Daniel/i,
  /vyplatni-pasky-2026-01-az-06/i
];
const forbiddenPath=[
  /(?:^|[\\/])vyplatni-pasky(?:[-_].*)?\.json$/i,
  /(?:^|[\\/])payroll(?:[-_].*)?\.json$/i
];
const findings=[];

function normalized(target){ return target.replaceAll('\\\\','/'); }

function scan(target){
  if(!fs.existsSync(target)) return;
  const stat=fs.statSync(target);
  if(stat.isDirectory()){
    if(ignored.has(normalized(target))) return;
    for(const name of fs.readdirSync(target)) scan(path.join(target,name));
    return;
  }
  const display=normalized(target);
  forbiddenPath.forEach(pattern=>{
    if(pattern.test(display)) findings.push(`${display}: zakazany soukromy datovy soubor`);
  });
  if(!textExtensions.has(path.extname(target))) return;
  const text=fs.readFileSync(target,'utf8');
  forbiddenContent.forEach(pattern=>{
    if(pattern.test(text)) findings.push(`${display}: ${pattern}`);
  });
  if(path.extname(target)==='.json'){
    try{
      const data=JSON.parse(text);
      const rows=Array.isArray(data) ? data : [data];
      const looksLikePrivatePayroll=rows.some(row=>row && typeof row==='object' &&
        ('netPay' in row || 'grossPay' in row || 'payrollMonth' in row) &&
        ('employeeName' in row || 'employer' in row || 'paymentDate' in row));
      if(looksLikePrivatePayroll) findings.push(`${display}: soubor vypada jako realny export vyplatnich pasek`);
    }catch{}
  }
}
roots.forEach(scan);
if(findings.length){
  console.error('Kontrola citlivych dat selhala:\n'+[...new Set(findings)].join('\n'));
  process.exit(1);
}
console.log('Sensitive-data check OK: ve zdrojovem baliku nejsou zname realne mzdove exporty ani zakazane identifikatory.');
