const OCR_SCRIPT_URLS = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.4/dist/tesseract.min.js',
  'https://unpkg.com/tesseract.js@4.1.4/dist/tesseract.min.js',
];

const AUTO_SCAN_INTERVAL = 1600;

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

    showScannerResult('Enquadre a figurinha inteira. O sistema vai ler só a área clara do código.');
    startAutoScan();
  } catch (error) {
    console.error(error);
    showScannerResult('Não consegui abrir a câmera. Verifique a permissão do navegador.');
  }
}

function closeScanner() {
  scannerState.isOpen = false;
  scannerState.foundCode = false;

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
  }, 800);
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
    if (manual) showScannerResult('Já estou tentando reconhecer o código...');
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
        : 'Procurando código automaticamente... mantenha a figurinha inteira no guia.'
    );

    const croppedCanvas = captureCodeArea();
    const preparedCanvas = prepareForOCR(croppedCanvas);

    const text = await recognizeText(preparedCanvas);

    if (!scannerState.isOpen) return;

    const code = extractStickerCode(text);

    if (code) {
      scannerState.foundCode = true;
      stopAutoScan();

      showScannerResult(`Código reconhecido: ${code}`);
      dispatchScannerCode(code);

      window.setTimeout(() => {
        closeScanner();
      }, 650);

      return;
    }

    showScannerResult(
      manual
        ? 'Não consegui ler o código. Tente manter a figurinha inteira no guia ou digite manualmente.'
        : 'Ainda procurando... mantenha a figurinha inteira visível e o código no quadro claro.'
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

function captureCodeArea() {
  const video = getEl('cameraVideo');
  const frame = document.querySelector('.scan-frame');

  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  let sx = sourceWidth * 0.60;
  let sy = sourceHeight * 0.12;
  let sw = sourceWidth * 0.25;
  let sh = sourceHeight * 0.12;

  if (frame) {
    const videoRect = video.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();

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
  const paddingY = sh * 0.18;

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

function prepareForOCR(sourceCanvas) {
  const upscale = 2.2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceCanvas.width * upscale));
  canvas.height = Math.max(1, Math.round(sourceCanvas.height * upscale));

  const context = canvas.getContext('2d', { willReadFrequently: true });

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];

    let gray = red * 0.299 + green * 0.587 + blue * 0.114;
    gray = (gray - 128) * 1.9 + 128;
    gray = clamp(gray, 0, 255);

    const binary = gray > 150 ? 255 : 0;

    data[index] = binary;
    data[index + 1] = binary;
    data[index + 2] = binary;
  }

  context.putImageData(imageData, 0, 0);

  return canvas;
}

async function recognizeText(canvas) {
  const worker = await getOCRWorker();
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

  await worker.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    tessedit_pageseg_mode: '7',
    preserve_interword_spaces: '0',
  });

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

  const compact = original
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');

  for (const prefix of VALID_PREFIXES.sort((a, b) => b.length - a.length)) {
    const match = compact.match(new RegExp(`${prefix}([0-9]{1,3})`));

    if (match) {
      return `${prefix}${fixNumberOCR(match[1])}`;
    }
  }

  const spaced = original
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  const genericMatch = spaced.match(/\b([A-Z]{2,5})\s*([0-9]{1,3})\b/);

  if (genericMatch) {
    const prefix = genericMatch[1];
    const number = fixNumberOCR(genericMatch[2]);

    if (!['CODIGO', 'CAMERA', 'SCAN', 'OCR', 'FIFAWORLDCUP'].includes(prefix)) {
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
