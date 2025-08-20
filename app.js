// app.js

// Elements
const canvas = document.getElementById('photoCanvas');
const ctx = canvas.getContext('2d');
const frameImg = document.getElementById('frame');
const fileInput = document.getElementById('fileInput');
const scaleSlider = document.getElementById('scaleRange');
const downloadBtn = document.getElementById('downloadBtn');
const msgBox = document.getElementById('msg');
const rotateButtons = document.querySelectorAll('.rotate-row .btn-ghost');
const imgSrc = document.getElementById('sourceImage');
const videoSrc = document.getElementById('sourceVideo');

// Constants
const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;

// State
let mediaType = null;     // "image" | "video"
let mediaLoaded = false;
let scale = 1;
let rotationDeg = 0;
let posX = 0;
let posY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Utils
function showMsg(text) {
  if (msgBox) msgBox.textContent = text || '';
}

function toCanvasPoint(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left) * (CANVAS_W / r.width),
    y: (clientY - r.top) * (CANVAS_H / r.height)
  };
}

// Touch helper (gets first touch point)
function touchPoint(e) {
  const t = (e.touches && e.touches[0]) ? e.touches : (e.changedTouches && e.changedTouches);
  return t ? { x: t.clientX, y: t.clientY } : { x: 0, y: 0 };
}

// Fit cover
function fitCover(w, h) {
  const s = Math.max(CANVAS_W / w, CANVAS_H / h);
  return { scale: s, x: (CANVAS_W - w * s) / 2, y: (CANVAS_H - h * s) / 2 };
}

// Draw
function drawFrame() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (!mediaLoaded) return;

  const isImage = mediaType === 'image';
  const w = isImage ? imgSrc.naturalWidth : videoSrc.videoWidth;
  const h = isImage ? imgSrc.naturalHeight : videoSrc.videoHeight;

  if (w && h) {
    const dw = w * scale;
    const dh = h * scale;
    const cx = posX + dw / 2;
    const cy = posY + dh / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationDeg * Math.PI / 180);
    if (isImage) {
      ctx.drawImage(imgSrc, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(videoSrc, -dw / 2, -dh / 2, dw, dh);
    }
    ctx.restore();
  }

  // Overlay frame
  if (frameImg && frameImg.naturalWidth) {
    ctx.drawImage(frameImg, 0, 0, CANVAS_W, CANVAS_H);
  }
}

function startLoop() {
  function loop() {
    drawFrame();
    requestAnimationFrame(loop);
  }
  loop();
}

// Upload handler
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
    try { await videoSrc.play(); } catch {}
    const cover = fitCover(videoSrc.videoWidth || 1, videoSrc.videoHeight || 1);
    scale = cover.scale;
    posX = cover.x;
    posY = cover.y;
    rotationDeg = 0;
    mediaLoaded = true;
    startLoop();
    videoSrc.pause();
  } else {
    imgSrc.onload = () => {
      const cover = fitCover(imgSrc.naturalWidth || 1, imgSrc.naturalHeight || 1);
      scale = cover.scale;
      posX = cover.x;
      posY = cover.y;
      rotationDeg = 0;
      mediaLoaded = true;
      startLoop();
      URL.revokeObjectURL(url);
    };
    imgSrc.onerror = () => {
      showMsg('Could not load the selected image.');
      URL.revokeObjectURL(url);
    };
    imgSrc.src = url;
  }
});

// Mouse dragging
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

// Touch dragging (prevents page scroll)
canvas.addEventListener('touchstart', (e) => {
  if (!mediaLoaded || (e.touches && e.touches.length !== 1)) return;
  const { x, y } = touchPoint(e);
  const p = toCanvasPoint(x, y);
  isDragging = true;
  dragStartX = p.x - posX;
  dragStartY = p.y - posY;
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (!isDragging || (e.touches && e.touches.length !== 1)) return;
  const { x, y } = touchPoint(e);
  const p = toCanvasPoint(x, y);
  posX = p.x - dragStartX;
  posY = p.y - dragStartY;
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  isDragging = false;
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchcancel', (e) => {
  isDragging = false;
  e.preventDefault();
}, { passive: false });

// Zoom
scaleSlider.addEventListener('input', (e) => {
  if (!mediaLoaded) return;
  const newScale = parseFloat(e.target.value);
  scale = newScale;
});

// Rotate
rotateButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!mediaLoaded) return;
    const val = btn.getAttribute('data-rot');
    rotationDeg = Number(val) || 0;
  });
});

// Export image as JPEG
async function exportImage() {
  const out = document.createElement('canvas');
  out.width = CANVAS_W;
  out.height = CANVAS_H;
  const octx = out.getContext('2d');
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Draw current canvas into out
  drawFrame();
  octx.drawImage(canvas, 0, 0);
  const url = out.toDataURL('image/jpeg', 0.92);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'framed-image.jpg';
  a.click();
}

// Export video via server (keep your existing backend URL/logic)
async function exportVideo() {
  showMsg('Processing video on server…');
  const file = fileInput.files && fileInput.files[0];
  if (!file || !file.type.startsWith('video/')) {
    showMsg('Please upload a video first.');
    return;
  }

  const params = {
    posX, posY, scale, rotationDeg,
    canvasW: CANVAS_W,
    canvasH: CANVAS_H,
    frameUrl: new URL(frameImg.src, location.href).href
  };

  const form = new FormData();
  form.append('video', file);
  form.append('params', JSON.stringify(params));

  try {
    // Keep your current endpoint here (Netlify, Flask, etc.)
    // Example for Netlify Functions:
    // const endpoint = '/.netlify/functions/export-mp4';
    // Example for Flask (PythonAnywhere):
    // const endpoint = 'https://your-username.pythonanywhere.com/export-mp4';

    const endpoint = '/.netlify/functions/export-mp4'; // <- replace if you’re using Flask

    const res = await fetch(endpoint, { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'framed-video.mp4';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showMsg('');
  } catch (err) {
    console.error(err);
    showMsg('Video export failed on server.');
  }
}

// Download button
downloadBtn.addEventListener('click', () => {
  if (!mediaLoaded) {
    showMsg('Please upload an image or video first.');
    return;
  }
  if (mediaType === 'image') {
    exportImage();
  } else {
    exportVideo();
  }
});
