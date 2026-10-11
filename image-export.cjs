const path = require('node:path');
const fs = require('node:fs/promises');

async function renderPlanImage({ BrowserWindow }, html) {
  if (typeof html !== 'string' || html.length > 4_000_000) throw new Error('올바른 일정표를 선택해주세요.');
  const width = 1000;
  const preview = new BrowserWindow({
    show: false, width, height: 900, useContentSize: true,
    backgroundColor: '#fffdf4',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true, backgroundThrottling: false }
  });
  try {
    preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const font = await fs.readFile(path.join(__dirname, 'assets/fonts/neodgm_pro.woff2'));
    const stylesheet = (await fs.readFile(path.join(__dirname, 'style.css'), 'utf8'))
      .replace("assets/fonts/neodgm_pro.woff2", 'data:font/woff2;base64,' + font.toString('base64'));
    const document = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; script-src 'none'">
      <style>${stylesheet}</style><style>
        html{scrollbar-gutter:auto}
        body{margin:0;padding:20px;background:#fffdf4;overflow:hidden}
        .plan{min-height:0;width:100%;box-shadow:none}
        .export-actions,.flow-view-switch,.circle-details,.stale{display:none!important}
        #timeline[hidden]{display:block!important}
        .timeline-row.alarm-active .block{outline:none}
      </style></head><body>${html}</body></html>`;
    await preview.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(document));
    const height = await preview.webContents.executeJavaScript(`(async()=>{
      await document.fonts.ready;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return Math.ceil(document.body.scrollHeight);
    })()`);
    if (!Number.isInteger(height) || height < 1 || height > 32760) throw new Error('일정표가 이미지로 복사하기에 너무 큽니다.');
    preview.setContentSize(width, height);
    await preview.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const image = await preview.webContents.capturePage({ x: 0, y: 0, width, height }, { stayHidden: true, stayAwake: true });
    if (image.isEmpty()) throw new Error('일정표 이미지를 만들지 못했습니다.');
    return image;
  } finally { preview.destroy(); }
}
async function copyPlanImage(dependencies, html) {
  const image = await renderPlanImage(dependencies, html);
  dependencies.clipboard.writeImage(image);
  return image.getSize();
}
async function exportPlanPDF(dependencies, html) {
  const image = await renderPlanImage(dependencies, html);
  return require('./image-pdf.cjs').imagePDF(image);
}
module.exports = { renderPlanImage, copyPlanImage, exportPlanPDF };
