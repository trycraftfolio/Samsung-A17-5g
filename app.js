// Elements
const canvas = document.getElementById('photoCanvas');
const ctx = canvas.getContext('2d');
const frameImg = document.getElementById('frame');
const fileInput = document.getElementById('fileInput');
const scaleSlider = document.getElementById('scaleRange');
const downloadBtn = document.getElementById('downloadBtn');
const msgBox = document.getElementById('msg');
const imgSrc = document.getElementById('sourceImage');
const videoSrc = document.getElementById('sourceVideo');

// Constants
const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;

// State
let mediaType = null; // 'image' | 'video'
let mediaLoaded = false;
let scale = 1;
let rotationDeg = 0;
let posX = 0;
let posY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Utils
const showMsg = (t='') => { if (msgBox) msgBox.textContent = t; };
function toCanvasPoint(clientX, clientY){
  const r = canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left) * (CANVAS_W / r.width),
    y: (clientY - r.top)  * (CANVAS_H / r.height),
  };
}
function fitCover(w, h){
  const s = Math.max(CANVAS_W / w, CANVAS_H / h);
  return { scale: s, x: (CANVAS_W - w*s)/2, y: (CANVAS_H - h*s)/2 };
}

// Draw
function drawFrame(){
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  if (!mediaLoaded) return;

  const isImage = mediaType === 'image';
  const w = isImage ? imgSrc.naturalWidth : videoSrc.videoWidth;
  const h = isImage ? imgSrc.naturalHeight : videoSrc.videoHeight;

  if (w && h) {
    const dw = w * scale, dh = h * scale;
    const cx = posX + dw/2, cy = posY + dh/2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationDeg * Math.PI/180);
    if (isImage) ctx.drawImage(imgSrc, -dw/2, -dh/2, dw, dh);
    else         ctx.drawImage(videoSrc, -dw/2, -dh/2, dw, dh);
    ctx.restore();
  }
  if (frameImg && frameImg.naturalWidth) {
    ctx.drawImage(frameImg, 0, 0, CANVAS_W, CANVAS_H);
  }
}
function startLoop(){
  function loop(){ drawFrame(); requestAnimationFrame(loop); }
  loop();
}

// Upload
fileInput.addEventListener('change', async () => {
  showMsg('');
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  const isVideo = file.type.startsWith('video/');
  mediaType = isVideo ? 'video' : 'image';
  mediaLoaded = false;

  const url = URL.createObjectURL(file);

  if (isVideo) {
    videoSrc.pause();
    videoSrc.removeAttribute('src');
    videoSrc.src = url;
    await videoSrc.play().catch(()=>{});
    const cover = fitCover(videoSrc.videoWidth || 1, videoSrc.videoHeight || 1);
    scale = cover.scale; posX = cover.x; posY = cover.y; rotationDeg = 0;
    mediaLoaded = true;
    startLoop();
    videoSrc.pause();
  } else {
    imgSrc.onload = () => {
      const cover = fitCover(imgSrc.naturalWidth || 1, imgSrc.naturalHeight || 1);
      scale = cover.scale; posX = cover.x; posY = cover.y; rotationDeg = 0;
      mediaLoaded = true; startLoop(); URL.revokeObjectURL(url);
    };
    imgSrc.onerror = () => { showMsg('Could not load the selected image.'); URL.revokeObjectURL(url); };
    imgSrc.src = url;
  }
});

// Mouse drag
canvas.addEventListener('mousedown', (e) => {
  if (!mediaLoaded) return;
  isDragging = true;
  const p = toCanvasPoint(e.clientX, e.clientY);
  dragStartX = p.x - posX;
  dragStartY = p.y - posY;
});
canvas.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const p = toCanvasPoint(e.clientX, e.clientY);
  posX = p.x - dragStartX;
  posY = p.y - dragStartY;
});
window.addEventListener('mouseup', () => { isDragging = false; });

// Touch drag
canvas.addEventListener('touchstart', (e) => {
  if (!mediaLoaded || !e.touches || e.touches.length !== 1) return;
  const t = e.touches[0];
  const p = toCanvasPoint(t.clientX, t.clientY);
  isDragging = true;
  dragStartX = p.x - posX;
  dragStartY = p.y - posY;
  e.preventDefault();
}, { passive:false });
canvas.addEventListener('touchmove', (e) => {
  if (!isDragging || !e.touches || e.touches.length !== 1) return;
  const t = e.touches[0];
  const p = toCanvasPoint(t.clientX, t.clientY);
  posX = p.x - dragStartX;
  posY = p.y - dragStartY;
  e.preventDefault();
  drawFrame();
}, { passive:false });
canvas.addEventListener('touchend',   (e)=>{ isDragging = false; e.preventDefault(); }, { passive:false });
canvas.addEventListener('touchcancel',(e)=>{ isDragging = false; e.preventDefault(); }, { passive:false });

// Zoom
scaleSlider.addEventListener('input', (e) => {
  if (!mediaLoaded) return;
  scale = parseFloat(e.target.value);
});

// Single rotate +90°
const btnRotate = document.getElementById('btn-rotate');
if (btnRotate) {
  btnRotate.addEventListener('click', () => {
    if (!mediaLoaded) return;
    rotationDeg = (rotationDeg + 90) % 360;
  });
}

// Joystick continuous movement
const joyUp = document.getElementById('joy-up');
const joyDown = document.getElementById('joy-down');
const joyLeft = document.getElementById('joy-left');
const joyRight = document.getElementById('joy-right');
const joyCenter = document.getElementById('joy-center');

let joy = { up:false, down:false, left:false, right:false, speed:1, raf:0 };

function joyStep(){
  if (!mediaLoaded) { joy.raf = 0; return; }
  const base = 2; // px per frame
  const v = base * joy.speed;
  if (joy.up)    posY -= v;
  if (joy.down)  posY += v;
  if (joy.left)  posX -= v;
  if (joy.right) posX += v;

  // Soft clamp to keep media roughly in view
  const isImage = mediaType === 'image';
  const w = isImage ? imgSrc.naturalWidth : videoSrc.videoWidth;
  const h = isImage ? imgSrc.naturalHeight : videoSrc.videoHeight;
  if (w && h) {
    const dw = w * scale, dh = h * scale;
    const pad = 80;
    const minX = -dw + pad, maxX = CANVAS_W - pad;
    const minY = -dh + pad, maxY = CANVAS_H - pad;
    posX = Math.min(Math.max(posX, minX), maxX);
    posY = Math.min(Math.max(posY, minY), maxY);
  }

  drawFrame();
  joy.raf = requestAnimationFrame(joyStep);
}
function joyStart(dir){
  joy[dir] = true;
  if (!joy.raf) joy.raf = requestAnimationFrame(joyStep);
}
function joyStop(dir){
  joy[dir] = false;
  if (!joy.up && !joy.down && !joy.left && !joy.right && joy.raf){
    cancelAnimationFrame(joy.raf);
    joy.raf = 0;
  }
}
function bindJoy(btn, dir){
  if (!btn) return;
  // Mouse
  btn.addEventListener('mousedown', () => joyStart(dir));
  btn.addEventListener('mouseup',   () => joyStop(dir));
  btn.addEventListener('mouseleave',() => joyStop(dir));
  // Touch
  btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); joyStart(dir); }, { passive:false });
  btn.addEventListener('touchend',   (e)=>{ e.preventDefault(); joyStop(dir);   }, { passive:false });
  btn.addEventListener('touchcancel',(e)=>{ e.preventDefault(); joyStop(dir);   }, { passive:false });
}
bindJoy(joyUp,'up'); bindJoy(joyDown,'down'); bindJoy(joyLeft,'left'); bindJoy(joyRight,'right');

if (joyCenter) {
  joyCenter.title = 'Toggle move speed';
  joyCenter.textContent = '●';
  joyCenter.addEventListener('click', ()=>{
    joy.speed = joy.speed === 1 ? 2 : joy.speed === 2 ? 4 : 1;
    joyCenter.textContent = joy.speed === 1 ? '●' : (joy.speed === 2 ? '●●' : '●●●');
  });
}

// Export image (unchanged)
async function exportImage(){
  const out = document.createElement('canvas');
  out.width = CANVAS_W; out.height = CANVAS_H;
  const octx = out.getContext('2d');
  octx.fillStyle = '#fff'; octx.fillRect(0,0, CANVAS_W, CANVAS_H);
  drawFrame();
  octx.drawImage(canvas, 0, 0);
  const url = out.toDataURL('image/jpeg', 0.92);
  const a = document.createElement('a'); a.href = url; a.download = 'framed-image.jpg'; a.click();
}

// Export video via your existing backend (leave endpoint as you currently use)
async function exportVideo(){
  showMsg('Processing video on server…');
  const file = fileInput.files && fileInput.files[0];
  if (!file || !file.type.startsWith('video/')) { showMsg('Please upload a video first.'); return; }

  const params = {
    posX, posY, scale, rotationDeg,
    canvasW: CANVAS_W, canvasH: CANVAS_H,
    frameUrl: new URL(frameImg.src, location.href).href
  };

  const form = new FormData();
  form.append('video', file);
  form.append('params', JSON.stringify(params));

  try {
    // Replace with your current server endpoint if different:
    const endpoint = '/.netlify/functions/export-mp4';
    const res = await fetch(endpoint, { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'framed-video.mp4'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
    showMsg('');
  } catch (err) {
    console.error(err);
    showMsg('Video export failed on server.');
  }
}

// Download button
downloadBtn.addEventListener('click', () => {
  if (!mediaLoaded) { showMsg('Please upload an image or video first.'); return; }
  if (mediaType === 'image') exportImage();
  else exportVideo();
});
