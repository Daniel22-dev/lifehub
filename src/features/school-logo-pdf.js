// Use the exact black-on-white school logo distributed with AI Studio GHRAB.
// Source: Daniel22-dev/AI-Studio-GHRAB/src/assets/brand/school-logo.png.
// Its black line art needs a white surface against the navy PDF masthead.
export function drawSchoolLogoOnHeader(ctx, logo, x, y) {
  if(!logo) return false;
  const width=142;
  const height=118;
  const radius=14;
  const padding=4;
  const naturalWidth=Number(logo.naturalWidth || logo.width) || 384;
  const naturalHeight=Number(logo.naturalHeight || logo.height) || 384;
  const scale=Math.min((width-padding*2)/naturalWidth,(height-padding*2)/naturalHeight);
  const renderWidth=naturalWidth*scale;
  const renderHeight=naturalHeight*scale;

  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.arcTo(x+width,y,x+width,y+height,radius);
  ctx.arcTo(x+width,y+height,x,y+height,radius);
  ctx.arcTo(x,y+height,x,y,radius);
  ctx.arcTo(x,y,x+width,y,radius);
  ctx.closePath();
  ctx.fillStyle='#ffffff';
  ctx.fill();
  ctx.drawImage(logo,x+(width-renderWidth)/2,y+(height-renderHeight)/2,renderWidth,renderHeight);
  return true;
}
