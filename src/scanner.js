const scanner = {
  stream: null,
  workerReady: false
};

const scanEls = () => ({
  modal: document.getElementById('scannerModal'),
  openBtn: document.getElementById('scannerBtn'),
  closeBtn: document.getElementById('closeScannerBtn'),
  stopBtn: document.getElementById('stopCameraBtn'),
  video: document.getElementById('cameraVideo'),
  canvas: document.getElementById('scanCanvas'),
  scanNowBtn: document.getElementById('scanNowBtn'),
  manualInput: document.getElementById('manualCodeInput'),
  manualBtn: document.getElementById('manualCodeBtn'),
  result: document.getElementById('scannerResult')
});

function extractStickerCode(text) {
  const cleaned = String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');

  const matches = cleaned.match(/\b[A-Z]{2,5}\s*\d{1,3}\b/g) || [];
  if (!matches.length) return null;

  return matches[0].replace(/\s+/g, '');
}

async function startCamera() {
  const { modal, video, result } = scanEls();

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  result.textContent = 'Abrindo câmera...';

  if (!navigator.mediaDevices?.getUserMedia) {
    result.textContent = 'Este navegador não liberou acesso à câmera. Abra pelo Safari em HTTPS.';
    return;
  }

  try {
    scanner.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 1920 }
      },
      audio: false
    });

    video.srcObject = scanner.stream;
    result.textContent = 'Câmera aberta. Aponte para o código e toque em Ler código.';
  } catch (err) {
    console.error(err);
    result.textContent = 'Não consegui abrir a câmera. Verifique a permissão do Safari.';
  }
}

function stopCamera() {
  const { video } = scanEls();
  if (scanner.stream) {
    scanner.stream.getTracks().forEach(track => track.stop());
    scanner.stream = null;
  }
  video.srcObject = null;
}

function closeScanner() {
  const { modal } = scanEls();
  stopCamera();
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

async function scanFrame() {
  const { video, canvas, result } = scanEls();

  if (!scanner.stream || !video.videoWidth) {
    result.textContent = 'A câmera ainda não está pronta.';
    return;
  }

  result.textContent = 'Lendo código... mantenha a figurinha parada.';

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // Recorte aproximado do topo direito, onde o código costuma aparecer.
  const sx = Math.floor(vw * 0.52);
  const sy = Math.floor(vh * 0.02);
  const sw = Math.floor(vw * 0.46);
  const sh = Math.floor(vh * 0.24);

  canvas.width = sw * 2;
  canvas.height = sh * 2;

  ctx.filter = 'contrast(160%) grayscale(100%)';
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';

  try {
    if (!window.Tesseract) {
      result.textContent = 'OCR não carregou. Verifique a internet e recarregue o app.';
      return;
    }

    const output = await Tesseract.recognize(canvas, 'eng', {
      logger: () => {}
    });

    const text = output?.data?.text || '';
    const code = extractStickerCode(text);

    if (!code) {
      result.innerHTML = `Não consegui identificar o código.<br><small>Texto lido: ${text.replace(/</g, '&lt;')}</small>`;
      return;
    }

    result.textContent = `Código encontrado: ${code}`;
    window.dispatchEvent(new CustomEvent('scanner:code', { detail: { code } }));
  } catch (err) {
    console.error(err);
    result.textContent = 'Erro ao fazer OCR. Tente digitar o código manualmente.';
  }
}

function manualSearch() {
  const { manualInput, result } = scanEls();
  const code = extractStickerCode(manualInput.value);
  if (!code) {
    result.textContent = 'Digite um código válido, exemplo ARG4.';
    return;
  }
  window.dispatchEvent(new CustomEvent('scanner:code', { detail: { code } }));
}

function setupScanner() {
  const { openBtn, closeBtn, stopBtn, scanNowBtn, manualBtn, manualInput } = scanEls();

  openBtn.addEventListener('click', startCamera);
  closeBtn.addEventListener('click', closeScanner);
  stopBtn.addEventListener('click', stopCamera);
  scanNowBtn.addEventListener('click', scanFrame);
  manualBtn.addEventListener('click', manualSearch);
  manualInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') manualSearch();
  });
}

setupScanner();
