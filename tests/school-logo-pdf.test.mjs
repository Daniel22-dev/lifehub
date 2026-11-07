import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SCHOOL_LOGO_DATA_URI } from '../src/assets/school-logo-data.js';
import { drawSchoolLogoOnHeader } from '../src/features/school-logo-pdf.js';

test('embedded school logo is an authentic-sized PNG, usable offline', () => {
  assert.ok(SCHOOL_LOGO_DATA_URI.startsWith('data:image/png;base64,'));
  const data = Buffer.from(SCHOOL_LOGO_DATA_URI.slice('data:image/png;base64,'.length), 'base64');
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(data.readUInt32BE(16), 664);
  assert.equal(data.readUInt32BE(20), 512);
  assert.ok(data.length > 1000);
});

test('logo PDF header preserves aspect ratio and prints against a white badge', () => {
  const paints = [];
  const ctx = {
    beginPath(){}, moveTo(){}, arcTo(){}, closePath(){},
    fill(){paints.push({type:'fill', color:this.fillStyle});},
    drawImage(...args){paints.push({type:'image', args});},
    fillStyle: ''
  };
  const logo = {naturalWidth:664, naturalHeight:512};
  assert.equal(drawSchoolLogoOnHeader(ctx, logo, 72, 41), true);
  assert.equal(paints.length, 2);
  assert.deepEqual(paints[0], {type:'fill',color:'#ffffff'});
  const [drawnLogo, x, y, width, height] = paints[1].args;
  assert.equal(drawnLogo, logo);
  assert.ok(width <= 126 && height <= 102);
  assert.ok(x >= 80 && x+width <= 206);
  assert.ok(y >= 49 && y+height <= 151);
  assert.ok(Math.abs(width/height - 664/512) < 0.0001);
});

test('missing logo is skipped without covering the header', () => {
  assert.equal(drawSchoolLogoOnHeader({}, null, 72, 41), false);
});

test('both PDF exports use the same non-distorting logo renderer', () => {
  const rewards = fs.readFileSync(new URL('../src/features/reward-pdf.js', import.meta.url), 'utf8');
  const electricity = fs.readFileSync(new URL('../src/features/electricity-pdf.js', import.meta.url), 'utf8');
  assert.match(rewards, /drawSchoolLogoOnHeader\(ctx,logo,MARGIN_X,41\)/);
  assert.match(electricity, /drawSchoolLogoOnHeader\(ctx,logo,MARGIN_X,36\)/);
  assert.ok(!rewards.includes('ctx.drawImage(logo,MARGIN_X,48,126,104)'));
  assert.ok(!electricity.includes('ctx.drawImage(logo, MARGIN_X, 44, 126, 104)'));
});
