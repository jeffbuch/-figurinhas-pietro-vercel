const OCR_SCRIPT_URLS = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.4/dist/tesseract.min.js',
  'https://unpkg.com/tesseract.js@4.1.4/dist/tesseract.min.js',
];

const AUTO_SCAN_INTERVAL = 1200;
const CANDIDATE_CONFIRM_HITS = 2;

const VALID_PREFIXES = [
  'FIFA',
  'ARG',
  'BRA',
  'USA',
  'MEX',
  'CAN',
  'GER',
  'FRA',
  'ESP',
  'ENG',
  'POR',
  'ITA',
  'NED',
  'BEL',
  'CRO',
  'URU',
  'COL',
  'ECU',
  'PER',
  'CHI',
  'JPN',
  'KOR',
  'AUS',
  'MAR',
  'SEN',
  'GHA',
  'NGR',
  'RSA',
  'UZB',
  'CC',
];

const scannerState = {
  stream: null,
  worker: null,
  workerReady: false,
  autoTimer: null,
  isScanning: false,
  isOpen: false,
  foundCode: false,
  candidateVotes: new Map(),
};

document.addEventListener('DOMContentLoaded', initScanner);

function initScanner() {
  bindScannerButton('scannerBtn', openScanner);
  bindScannerButton('stopCameraBtn', closeScanner);
  bindScannerButton('stopCameraBtnAlt', closeScanner);
  bindScannerButton('scanNowBtn', () => scanOnce({ manual: true }));
  bindScannerButton('manualCodeBtn', useManualCode);

  const manualInput = getEl('manualCodeInput');

  if (manualInput) {
    manualInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        useManualCode();
      }
    });
  }
}

function bindScannerButton(id, callback) {
  const button = getEl(id);
  if (!button) return;

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    callback();
  });
}

async function openScanner() {
  const modal = getEl('scannerModal');
  const video = getEl('cameraVideo');

  if (!modal || !video) {
    showScannerResult('Scanner não encontrado no HTML.');
    return;
  }

  scannerState.isOpen = true;
  scannerState.foundCode = false;
  scannerState.candidateVotes.clear();

  modal.classList.remove('hidden');
  showScannerResult('Abrindo câmera...');

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Câmera não suportada neste navegador.');
    }

    stopStreamOnly();

    scannerState.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });

    video.srcObject = scannerState.stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');

    await waitForVideo(video);
    await video.play();

    await tuneCameraTrack();

    showScannerResult(
      'Enquadre a figurinha inteira no guia. O sistema vai ler só a caixa do código.'
    );

    startAutoScan();
  } catch (error) {
    console.error(error);
    showScannerResult('Não consegui abrir a câmera. Verifique a permissão do navegador.');
  }
}

async function tuneCameraTrack() {
  try {
    if (!scannerState.stream) return;

    const [track] = scannerState.stream.getVideoTracks();
    if (!track) return;

    const capabilities = track.getCapabilities?.() || {};
    const advanced = [];

    if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' });
    }

    if (capabilities.zoom) {
      const minZoom = capabilities.zoom.min ?? 1;
      const maxZoom = capabilities.zoom.max ?? 1;
      const wantedZoom = Math.min(maxZoom, Math.max(minZoom, 1.35));
      advanced.push({ zoom: wantedZoom });
    }

    if (advanced.length) {
      await track.applyConstraints({ advanced });
    }
  } catch (error) {
    console.warn('Não foi possível ajustar foco/zoom automaticamente.', error);
  }
}

function closeScanner() {
  scannerState.isOpen = false;
  scannerState.foundCode = false;
  scannerState.candidateVotes.clear();

  stopAutoScan();
  stopStreamOnly();

  const video = getEl('cameraVideo');

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  const modal = getEl('scannerModal');
  if (modal) {
    modal.classList.add('hidden');
  }

  showScannerResult('Câmera fechada.');
}

function stopStreamOnly() {
  if (scannerState.stream) {
    scannerState.stream.getTracks().forEach((track) => track.stop());
    scannerState.stream = null;
  }
}

function startAutoScan() {
  stopAutoScan();

  scannerState.autoTimer = window.setInterval(() => {
    scanOnce({ manual: false });
  }, AUTO_SCAN_INTERVAL);

  window.setTimeout(() => {
    scanOnce({ manual: false });
  }, 900);
}

function stopAutoScan() {
  if (scannerState.autoTimer) {
    window.clearInterval(scannerState.autoTimer);
    scannerState.autoTimer = null;
  }
}

async function scanOnce({ manual = false } = {}) {
  if (!scannerState.isOpen) return;
  if (scannerState.foundCode) return;

  if (scannerState.isScanning) {
    if (manual) {
      showScannerResult('Já estou tentando reconhecer o código...');
    }
    return;
  }

  const video = getEl('cameraVideo');

  if (!video || !video.videoWidth || !video.videoHeight) {
    showScannerResult('A câmera ainda está carregando...');
    return;
  }

  scannerState.isScanning = true;

  try {
    showScannerResult(
      manual
        ? 'Escaneando agora...'
        : 'Procurando código automaticamente... mantenha a figurinha dentro do guia.'
    );

    const cropCanvas = captureCodeAreaOnly();
    const result = await recognizeCodeFromCanvas(cropCanvas);

    if (!scannerState.isOpen) return;

    if (result.code) {
      const confirmed = registerCandidate(result.code, manual);

      if (!confirmed) {
        showScannerResult(`Possível código: ${result.code}. Confirmando...`);
        return;
      }

      scannerState.foundCode = true;
      stopAutoScan();

      showScannerResult(`Código reconhecido: ${result.code}`);
      dispatchScannerCode(result.code);

      if (navigator.vibrate) {
        navigator.vibrate(120);
      }

      window.setTimeout(() => {
        closeScanner();
      }, 650);

      return;
    }

    showScannerResult(
      manual
        ? 'Não consegui ler. Tente alinhar melhor a caixa do código ou digite manualmente.'
        : 'Ainda procurando... deixe a figurinha inteira no guia e a caixa do código no quadro verde.'
    );
  } catch (error) {
    console.error(error);

    showScannerResult(
      manual
        ? 'Erro ao escanear. Tente digitar o código manualmente.'
        : 'OCR carregando ou sem leitura ainda. Continue apontando a figurinha.'
    );
  } finally {
    scannerState.isScanning = false;
  }
}

function registerCandidate(code, manual = false) {
  const normalized = normalizeCode(code);
  if (!normalized) return false;

  if (manual) return true;

  const now = Date.now();

  for (const [key, value] of scannerState.candidateVotes.entries()) {
    if (now - value.lastSeen > 5000) {
      scannerState.candidateVotes.delete(key);
    }
  }

  const entry = scannerState.candidateVotes.get(normalized) || { hits: 0, lastSeen: now };
  entry.hits += 1;
  entry.lastSeen = now;
  scannerState.candidateVotes.set(normalized, entry);

  return entry.hits >= CANDIDATE_CONFIRM_HITS;
}

function captureCodeAreaOnly() {
  const video = getEl('cameraVideo');
  const codeFrame = document.querySelector('.scan-frame');

  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  let sx = sourceWidth * 0.58;
  let sy = sourceHeight * 0.26;
  let sw = sourceWidth * 0.18;
  let sh = sourceHeight * 0.08;

  if (codeFrame) {
    const videoRect = video.getBoundingClientRect();
    const frameRect = codeFrame.getBoundingClientRect();

    const scale = Math.max(videoRect.width / sourceWidth, videoRect.height / sourceHeight);
    const displayedWidth = sourceWidth * scale;
    const displayedHeight = sourceHeight * scale;

    const offsetX = (videoRect.width - displayedWidth) / 2;
    const offsetY = (videoRect.height - displayedHeight) / 2;

    sx = (frameRect.left - videoRect.left - offsetX) / scale;
    sy = (frameRect.top - videoRect.top - offsetY) / scale;
    sw = frameRect.width / scale;
    sh = frameRect.height / scale;
  }

  sx = clamp(sx, 0, sourceWidth - 1);
  sy = clamp(sy, 0, sourceHeight - 1);
  sw = clamp(sw, 1, sourceWidth - sx);
  sh = clamp(sh, 1, sourceHeight - sy);

  const paddingX = sw * 0.10;
  const paddingY = sh * 0.20;

  sx = clamp(sx - paddingX, 0, sourceWidth - 1);
  sy = clamp(sy - paddingY, 0, sourceHeight - 1);
  sw = clamp(sw + paddingX * 2, 1, sourceWidth - sx);
  sh = clamp(sh + paddingY * 2, 1, sourceHeight - sy);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);

  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return canvas;
}

async function recognizeCodeFromCanvas(sourceCanvas) {
  const variants = buildOCRVariants(sourceCanvas);
  const texts = [];

  for (const variant of variants) {
    const textPsm7 = await recognizeCanvasText(variant, 7);
    texts.push(textPsm7);

    let code = extractStickerCode(textPsm7);
    if (code) return { code, texts };

    const textPsm8 = await recognizeCanvasText(variant, 8);
    texts.push(textPsm8);

    code = extractStickerCode(textPsm8);
    if (code) return { code, texts };
  }

  const merged = texts.join(' ');
  return {
    code: extractStickerCode(merged),
    texts,
  };
}

function buildOCRVariants(sourceCanvas) {
  return [
    prepareCanvasVariant(sourceCanvas, { scale: 3, threshold: null, contrast: 1.8, sharpen: true }),
    prepareCanvasVariant(sourceCanvas, { scale: 3, threshold: 140, contrast: 2.0, sharpen: true }),
    prepareCanvasVariant(sourceCanvas, { scale: 3, threshold: 165, contrast: 2.2, sharpen: true }),
    prepareCanvasVariant(sourceCanvas, { scale: 4, threshold: 150, contrast: 2.0, sharpen: false }),
  ];
}

function prepareCanvasVariant(sourceCanvas, options = {}) {
  const {
    scale = 3,
    threshold = null,
    contrast = 2,
    sharpen = false,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

  let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  let data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];

    let gray = red * 0.299 + green * 0.587 + blue * 0.114;
    gray = (gray - 128) * contrast + 128;
    gray = clamp(gray, 0, 255);

    if (threshold !== null) {
      gray = gray > threshold ? 255 : 0;
    }

    data[index] = gray;
    data[index + 1] = gray;
    data[index + 2] = gray;
  }

  context.putImageData(imageData, 0, 0);

  if (sharpen) {
    applySharpen(context, canvas.width, canvas.height);
  }

  return canvas;
}

function applySharpen(context, width, height) {
  const src = context.getImageData(0, 0, width, height);
  const dst = context.createImageData(width, height);

  const srcData = src.data;
  const dstData = dst.data;

  const weights = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0,
  ];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        let value = 0;
        let weightIndex = 0;

        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4 + channel;
            value += srcData[pixelIndex] * weights[weightIndex];
            weightIndex += 1;
          }
        }

        const outIndex = (y * width + x) * 4 + channel;
        dstData[outIndex] = clamp(value, 0, 255);
      }

      const alphaIndex = (y * width + x) * 4 + 3;
      dstData[alphaIndex] = 255;
    }
  }

  context.putImageData(dst, 0, 0);
}

async function recognizeCanvasText(canvas, psmMode = 7) {
  const worker = await getOCRWorker();

  await worker.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    tessedit_pageseg_mode: String(psmMode),
    preserve_interword_spaces: '0',
  });

  const result = await worker.recognize(canvas);
  return result?.data?.text || '';
}

async function getOCRWorker() {
  if (scannerState.worker && scannerState.workerReady) {
    return scannerState.worker;
  }

  await loadOCRScript();

  if (!window.Tesseract) {
    throw new Error('Tesseract não carregou.');
  }

  showScannerResult('Carregando OCR pela primeira vez...');

  const worker = window.Tesseract.createWorker({
    logger: () => {},
  });

  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');

  scannerState.worker = worker;
  scannerState.workerReady = true;

  return worker;
}

async function loadOCRScript() {
  if (window.Tesseract) return;

  for (const url of OCR_SCRIPT_URLS) {
    try {
      await injectScript(url);
      if (window.Tesseract) return;
    } catch (error) {
      console.warn(`Falha ao carregar OCR por ${url}`, error);
    }
  }

  throw new Error('Não foi possível carregar o OCR.');
}

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);

    if (existingScript) {
      if (window.Tesseract) {
        resolve();
        return;
      }

      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;

    document.head.appendChild(script);
  });
}

function extractStickerCode(rawText) {
  const original = String(rawText || '').toUpperCase();

  const cleaned = original
    .replace(/\n/g, ' ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const compact = cleaned.replace(/\s+/g, '');

  const sortedPrefixes = [...VALID_PREFIXES].sort((a, b) => b.length - a.length);

  for (const prefix of sortedPrefixes) {
    const regex = new RegExp(`${prefix}\\s*([0-9OILSB]{1,3})`);
    const matchSpaced = cleaned.match(regex);
    if (matchSpaced) {
      return `${prefix}${fixNumberOCR(matchSpaced[1])}`;
    }

    const regexCompact = new RegExp(`${prefix}([0-9OILSB]{1,3})`);
    const matchCompact = compact.match(regexCompact);
    if (matchCompact) {
      return `${prefix}${fixNumberOCR(matchCompact[1])}`;
    }
  }

  const genericMatch = cleaned.match(/\b([A-Z]{2,5})\s*([0-9OILSB]{1,3})\b/);

  if (genericMatch) {
    const prefix = genericMatch[1];
    const number = fixNumberOCR(genericMatch[2]);

    if (
      ![
        'CODIGO',
        'CAMERA',
        'SCAN',
        'OCR',
        'WORLD',
        'CUP',
        'PANINI',
        'FIFA',
      ].includes(prefix)
    ) {
      return `${prefix}${number}`;
    }
  }

  return '';
}

function fixNumberOCR(value) {
  return String(value || '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/L/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
}

function useManualCode() {
  const input = getEl('manualCodeInput');
  const code = normalizeCode(input?.value || '');

  if (!code) {
    showScannerResult('Digite um código, exemplo: ARG4.');
    return;
  }

  showScannerResult(`Código digitado: ${code}`);
  dispatchScannerCode(code);
  closeScanner();
}

function dispatchScannerCode(code) {
  window.dispatchEvent(
    new CustomEvent('scanner:code', {
      detail: { code },
    })
  );
}

function waitForVideo(video) {
  return new Promise((resolve) => {
    if (video.videoWidth && video.videoHeight) {
      resolve();
      return;
    }

    video.addEventListener(
      'loadedmetadata',
      () => {
        resolve();
      },
      { once: true }
    );
  });
}

function showScannerResult(message) {
  const result = getEl('scannerResult');

  if (result) {
    result.textContent = message;
  }

  console.log(`[Scanner] ${message}`);
}

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getEl(id) {
  return document.getElementById(id);
}
