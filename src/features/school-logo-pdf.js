// Render the original school mark directly on the navy PDF header.
// The official PNG uses white and light grey fills with dark outlines.
// Painting a white badge behind it makes both letterforms almost disappear.
export function drawSchoolLogoOnHeader(ctx, logo, x, y) {
  if(!logo) return false;
  const width = 142;
  const height = 118;
  const pad = 4;
  const naturalWidth = Number(logo.naturalWidth || logo.width) || width - pad * 2;
  const naturalHeight = Number(logo.naturalHeight || logo.height) || height - pad * 2;
  const scale = Math.min((width - pad * 2) / naturalWidth, (height - pad * 2) / naturalHeight);
  const renderWidth = naturalWidth * scale;
  const renderHeight = naturalHeight * scale;

  // No light backing rectangle: preserve transparent edges and both original colours.
  ctx.drawImage(logo, x + (width - renderWidth) / 2, y + (height - renderHeight) / 2, renderWidth, renderHeight);
  return true;
}
