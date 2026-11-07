// Shared, data-independent school brand rendering for locally generated PDFs.
export function drawSchoolLogoOnHeader(ctx, logo, x, y) {
  if(!logo) return false;
  const width = 142;
  const height = 118;
  const radius = 14;
  const pad = 8;
  const naturalWidth = Number(logo.naturalWidth || logo.width) || width - pad * 2;
  const naturalHeight = Number(logo.naturalHeight || logo.height) || height - pad * 2;
  const scale = Math.min((width - pad * 2) / naturalWidth, (height - pad * 2) / naturalHeight);
  const renderWidth = naturalWidth * scale;
  const renderHeight = naturalHeight * scale;

  // The school's genuine logo has dark outlines and needs a light ground.
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.drawImage(logo, x + (width - renderWidth) / 2, y + (height - renderHeight) / 2, renderWidth, renderHeight);
  return true;
}
