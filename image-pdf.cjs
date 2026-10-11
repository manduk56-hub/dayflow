// One image, one page. The page follows the image aspect ratio instead of
// splitting the schedule across sheets of paper.
function imagePDF(image) {
  const { width, height } = image.getSize();
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || image.isEmpty()) {
    throw new Error('PDF로 저장할 이미지가 없습니다.');
  }
  const scale = Math.min(595.276 / width, 14400 / height);
  const pageWidth = (width * scale).toFixed(3), pageHeight = (height * scale).toFixed(3);
  const jpeg = image.toJPEG(100);
  const drawing = Buffer.from(`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`);
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`),
    Buffer.concat([Buffer.from(`<< /Length ${drawing.length} >>\nstream\n`), drawing, Buffer.from('endstream')]),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from('\nendstream')])
  ];
  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')], offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')]);
    chunks.push(chunk);length += chunk.length;
  });
  const xref = `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  chunks.push(Buffer.from(xref));
  return Buffer.concat(chunks);
}
module.exports = { imagePDF };
