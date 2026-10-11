// Run with Electron: node_modules/.bin/electron scripts/create-d-icon.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(__dirname, '../assets/icon');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  let window;
  try {
    const font = fs.readFileSync(path.join(__dirname, '../assets/fonts/neodgm_pro.woff2')).toString('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <style>@font-face{font-family:Dayflow;src:url(data:font/woff2;base64,${font})}</style>
      <rect x="10" y="10" width="50" height="50" fill="#cfc5cc"/>
      <rect x="5" y="5" width="50" height="50" fill="#b4a2da" stroke="#39324b" stroke-width="2"/>
      <text id="letter" x="30" y="30" text-anchor="middle" dominant-baseline="central" font-family="Dayflow" font-size="32" font-weight="700" fill="#39324b">d</text>
      <text id="dot" x="44" y="30" text-anchor="middle" dominant-baseline="central" font-family="Dayflow" font-size="32" font-weight="700" fill="#39324b">.</text>
    </svg>`;
    fs.mkdirSync(directory, { recursive: true });
    window = new BrowserWindow({ show:false, width:64, height:64, useContentSize:true, transparent:true, backgroundColor:'#00000000', webPreferences:{offscreen:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false} });
    await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><head><style>body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`));
    const centeredSVG = await window.webContents.executeJavaScript(`(async()=>{
      await document.fonts.ready;
      const letter=document.getElementById('letter'),dot=document.getElementById('dot');
      const original=letter.getBBox();
      letter.setAttribute('x',28+30-(original.x+original.width/2));
      // The bundled bitmap glyph's visible ink sits 2px above its SVG box.
      letter.setAttribute('y',32+30-(original.y+original.height/2));
      const bounds=letter.getBBox(),point=dot.getBBox();
      dot.setAttribute('x',42+bounds.x+bounds.width-point.x);
      dot.setAttribute('y',30+bounds.y+bounds.height-(point.y+point.height));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return document.querySelector('svg').outerHTML;
    })()`);
    fs.writeFileSync(path.join(directory, 'dayflow-d.svg'), centeredSVG);
    const image = await window.webContents.capturePage({x:0,y:0,width:64,height:64},{stayHidden:true});
    fs.writeFileSync(path.join(directory, 'dayflow-d-64.png'),image.toPNG());
  } catch(error) { console.error(error);app.exitCode=1; }
  finally { if(window)window.destroy();app.quit(); }
});
