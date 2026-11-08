import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { SCHOOL_LOGO_DATA_URI } from '../src/assets/school-logo-data.js';
import { drawSchoolLogoOnHeader } from '../src/features/school-logo-pdf.js';

const canonicalSourceSha='0b23733540b01fe70f35feda45037b0cd2c995cb';
// This Git blob hash pins the actual PNG checked into AI-Studio-GHRAB,
// not merely an image of similar dimensions or another logo variant.
test('PDF uses the exact canonical black-on-white school logo from AI Studio GHRAB', () => {
  assert.ok(SCHOOL_LOGO_DATA_URI.startsWith('data:image/png;base64,'));
  const publicLogo=fs.readFileSync(new URL('../public/school-logo.png',import.meta.url));
  const embedded=Buffer.from(SCHOOL_LOGO_DATA_URI.slice('data:image/png;base64,'.length),'base64');
  assert.deepEqual(publicLogo,embedded);
  assert.deepEqual([...publicLogo.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(publicLogo.readUInt32BE(16),384);
  assert.equal(publicLogo.readUInt32BE(20),384);
  const sourceBlobSha=createHash('sha1').update(`blob ${publicLogo.length}\0`).update(publicLogo).digest('hex');
  assert.equal(sourceBlobSha,canonicalSourceSha);
});

test('PDF draws original school logo legibly on white rounded badge without stretching', () => {
  const paints=[];
  const ctx={
    beginPath(){paints.push({type:'path'});},moveTo(){},arcTo(){},closePath(){},
    fill(){paints.push({type:'fill',color:this.fillStyle});},
    drawImage(...args){paints.push({type:'image',args});},
    fillStyle:''
  };
  const logo={naturalWidth:384,naturalHeight:384};
  assert.equal(drawSchoolLogoOnHeader(ctx,logo,72,41),true);
  assert.equal(paints.length,3);
  assert.deepEqual(paints[1],{type:'fill',color:'#ffffff'});
  const [drawnLogo,x,y,width,height]=paints[2].args;
  assert.equal(drawnLogo,logo);
  assert.ok(width<=134 && height<=110);
  assert.ok(x>=76 && x+width<=210);
  assert.ok(y>=45 && y+height<=155);
  assert.ok(Math.abs(width/height-1)<0.0001);
});

test('no missing logo is painted over the PDF header', () => {
  assert.equal(drawSchoolLogoOnHeader({},null,72,41),false);
});

test('both PDF exports use identical logo rendering', () => {
  const rewards=fs.readFileSync(new URL('../src/features/reward-pdf.js',import.meta.url),'utf8');
  const electricity=fs.readFileSync(new URL('../src/features/electricity-pdf.js',import.meta.url),'utf8');
  assert.match(rewards,/drawSchoolLogoOnHeader\(ctx,logo,MARGIN_X,41\)/);
  assert.match(electricity,/drawSchoolLogoOnHeader\(ctx,logo,MARGIN_X,36\)/);
  assert.ok(!rewards.includes('ctx.drawImage(logo,MARGIN_X,48,126,104)'));
  assert.ok(!electricity.includes('ctx.drawImage(logo, MARGIN_X, 44, 126, 104)'));
});
