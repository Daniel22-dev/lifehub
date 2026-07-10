import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const fail = message => {
  console.error(`Smoke check failed: ${message}`);
  process.exitCode = 1;
};
const mustContain = (name, text, needle) => {
  if(!text.includes(needle)) fail(`${name} neobsahuje povinný text: ${needle}`);
};
const mustNotContain = (name, text, needle) => {
  if(text.includes(needle)) fail(`${name} stále obsahuje zakázaný text: ${needle}`);
};

const html = read('index.html');
const app = read('src/app/lifehub-app.js');
const constants = read('src/config/constants.js');
const storage = read('src/storage/indexed-db.js');
const crypto = read('src/security/crypto.js');
const css = read('src/styles/lifehub.css');
const pkg = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('public/manifest.json'));
const sw = read('public/sw.js');
const gitignore = read('.gitignore');
const ci = read('.github/workflows/ci.yml');
const deploy = read('.github/workflows/deploy.yml');

mustContain('index.html', html, 'data-action="export-complete-backup"');
mustContain('index.html', html, 'id="backupStatus"');
mustContain('index.html', html, 'id="changeVaultPassword"');
mustContain('index.html', html, 'Oficiální osobní nástroj');
mustContain('lifehub-app.js', app, 'function exportCompleteEncryptedBackup');
mustContain('lifehub-app.js', app, 'function importCompleteBackup');
mustContain('lifehub-app.js', app, 'prepareBackupFileEntries');
mustContain('lifehub-app.js', app, 'recoverPendingRestore');
mustContain('lifehub-app.js', app, 'recoverPendingKeyRotation');
mustContain('lifehub-app.js', app, 'function changeVaultPassword');
mustContain('lifehub-app.js', app, 'offerBackupBeforeImport');
mustContain('lifehub-app.js', app, 'reconcileStoredFileFlags');
mustContain('lifehub-app.js', app, 'buildImportPreviewMessage');
mustContain('lifehub-app.js', app, 'metadata: backupMetadata');
mustContain('lifehub-app.js', app, 'lastRestoreAt');
mustContain('lifehub-app.js', app, 'validateBackupFileSet');
mustContain('indexed-db.js', storage, 'idbReplaceEncryptedStores');
mustContain('crypto.js', crypto, 'validateKdfIterations');
mustContain('constants.js', constants, "APP_VERSION = '4.0.0'");
mustContain('service worker', sw, "lifehub-vite-shell-v4-0");
mustNotContain('service worker', sw, 'skipWaiting()');
mustNotContain('CSS', css, '.w-100{');
mustContain('.gitignore', gitignore, 'node_modules/');
mustContain('.gitignore', gitignore, '*.pdf');
mustContain('.gitignore', gitignore, '!package.json');
mustContain('ci.yml', ci, 'npm ci');
mustContain('ci.yml', ci, 'npm test');
mustContain('deploy.yml', deploy, 'npm ci');
mustContain('deploy.yml', deploy, 'npm test');

if(pkg.version !== '4.0.0') fail('package.json verze není 4.0.0');
if(manifest.name !== 'LifeHub' || manifest.lang !== 'cs' || manifest.scope !== './') fail('manifest nemá produkční metadata LifeHubu 4.0');
if(process.exitCode) process.exit(process.exitCode);
console.log('Smoke check OK: LifeHub 4.0 má zapojené šifrování, transakční obnovu, testy, PWA a GitHub workflow.');
