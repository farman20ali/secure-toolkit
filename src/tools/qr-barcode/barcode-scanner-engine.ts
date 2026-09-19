import jsQR from 'jsqr'
import {
  MultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
} from '@zxing/library'

export interface ScanResult {
  text: string
  format: string
  engine: string
  durationMs: number
}

// Global ZXing reader instance with TRY_HARDER hint enabled
let cachedZxingReader: MultiFormatReader | null = null

function getZxingReader(): MultiFormatReader {
  if (!cachedZxingReader) {
    const reader = new MultiFormatReader()
    const hints = new Map<DecodeHintType, any>()
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.AZTEC,
      BarcodeFormat.PDF_417,
    ])
    reader.setHints(hints)
    cachedZxingReader = reader
  }
  return cachedZxingReader
}

/**
 * Normalizes any image input (File, Blob, Image, Canvas) to an HTMLCanvasElement
 * with a maximum dimension (default 1000px) for high-speed JS parsing.
 */
export async function sourceToNormalizedCanvas(
  input: File | Blob | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  maxDimension = 1000
): Promise<HTMLCanvasElement> {
  let imgElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | null = null

  if (input instanceof File || input instanceof Blob) {
    if (typeof createImageBitmap !== 'undefined') {
      try {
        imgElement = await createImageBitmap(input)
      } catch {
        // Fallback to FileReader
      }
    }

    if (!imgElement) {
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            imgElement = img
            resolve()
          }
          img.onerror = () => reject(new Error('Failed to load image file'))
          img.src = e.target?.result as string
        }
        reader.onerror = () => reject(new Error('Failed to read image file'))
        reader.readAsDataURL(input)
      })
    }
  } else {
    imgElement = input
  }

  if (!imgElement) {
    throw new Error('Failed to load image element')
  }

  const origWidth =
    imgElement instanceof HTMLVideoElement ? imgElement.videoWidth : imgElement.width
  const origHeight =
    imgElement instanceof HTMLVideoElement ? imgElement.videoHeight : imgElement.height

  if (!origWidth || !origHeight) {
    throw new Error('Invalid image dimensions')
  }


  let targetWidth = origWidth
  let targetHeight = origHeight

  if (origWidth > maxDimension || origHeight > maxDimension) {
    if (origWidth > origHeight) {
      targetWidth = maxDimension
      targetHeight = Math.round((origHeight * maxDimension) / origWidth)
    } else {
      targetHeight = maxDimension
      targetWidth = Math.round((origWidth * maxDimension) / origHeight)
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create 2D canvas context')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(imgElement, 0, 0, targetWidth, targetHeight)

  return canvas
}

/**
 * Creates a high-contrast binarized canvas to sharpen faint/blurry linear barcodes.
 */
export function createContrastBoostedCanvas(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = sourceCanvas.width
  canvas.height = sourceCanvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.drawImage(sourceCanvas, 0, 0)
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imgData.data

  for (let i = 0; i < data.length; i += 4) {
    // Luminance calculation
    const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
    // Boost contrast with simple threshold curve
    const v = gray > 128 ? Math.min(255, gray * 1.2) : Math.max(0, gray * 0.8)
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas
}

/**
 * Inverts light and dark pixels for dark mode / white-on-black barcodes.
 */
export function createInvertedCanvas(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = sourceCanvas.width
  canvas.height = sourceCanvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.drawImage(sourceCanvas, 0, 0)
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imgData.data

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]!
    data[i + 1] = 255 - data[i + 1]!
    data[i + 2] = 255 - data[i + 2]!
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas
}

/**
 * Rotates a canvas by 90 degrees to decode vertical barcodes.
 */
export function createRotatedCanvas(
  sourceCanvas: HTMLCanvasElement,
  degrees = 90
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  if (degrees === 90 || degrees === 270) {
    canvas.width = sourceCanvas.height
    canvas.height = sourceCanvas.width
  } else {
    canvas.width = sourceCanvas.width
    canvas.height = sourceCanvas.height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2)
  return canvas
}


/**
 * Stage 1: Try Native Browser BarcodeDetector (Chrome, Edge, Android)
 */
async function tryNativeBarcodeDetector(
  input: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement
): Promise<{ text: string; format: string } | null> {
  if (typeof window === 'undefined') return null
  const BarcodeDetectorClass = (window as any).BarcodeDetector
  if (!BarcodeDetectorClass) return null

  try {
    const formats =
      (await BarcodeDetectorClass.getSupportedFormats?.()) || [
        'qr_code',
        'ean_13',
        'ean_8',
        'upc_a',
        'upc_e',
        'code_128',
        'code_39',
        'code_93',
        'itf',
        'codabar',
        'data_matrix',
        'aztec',
        'pdf417',
      ]
    const detector = new BarcodeDetectorClass({ formats })
    const results = await detector.detect(input)

    if (results && results.length > 0 && results[0]?.rawValue) {
      const match = results[0]
      const formatStr = (match.format || 'BARCODE').toUpperCase().replace(/_/g, '-')
      return {
        text: match.rawValue,
        format: formatStr,
      }
    }
  } catch {
    // Native BarcodeDetector failed or unsupported format
  }
  return null
}

/**
 * Stage 2: Try jsQR for fast QR decoding
 */
function tryJsQr(canvas: HTMLCanvasElement): { text: string; format: string } | null {
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const qrResult = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: 'attemptBoth',
    })
    if (qrResult && qrResult.data) {
      return { text: qrResult.data, format: 'QR_CODE' }
    }
  } catch {
    // jsQR failed
  }
  return null
}

/**
 * Stage 3: Try ZXing MultiFormatReader on a given canvas
 */
function tryZxingOnCanvas(canvas: HTMLCanvasElement): { text: string; format: string } | null {
  try {
    const reader = getZxingReader()
    const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas)
    const binarizer = new HybridBinarizer(luminanceSource)
    const bitmap = new BinaryBitmap(binarizer)
    const result = reader.decode(bitmap)
    if (result && result.getText()) {
      return {
        text: result.getText(),
        format: result.getBarcodeFormat().toString(),
      }
    }
  } catch {
    // ZXing decode failed on this canvas frame
  } finally {
    getZxingReader().reset()
  }
  return null
}

/**
 * Main function: Scans any image/file/canvas with ultra-fast multi-engine fallback.
 */
export async function scanBarcodeFromImage(
  input: File | Blob | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<ScanResult> {
  const startTime = performance.now()

  // Step 1: Scale down image to ~1000px max edge (increases JS speed by up to 50x)
  const normCanvas = await sourceToNormalizedCanvas(input, 1000)

  // Step 2: Native BarcodeDetector API (Hardware Accelerated GPU)
  const nativeRes = await tryNativeBarcodeDetector(normCanvas)
  if (nativeRes) {
    return {
      text: nativeRes.text,
      format: nativeRes.format,
      engine: 'Native BarcodeDetector (GPU)',
      durationMs: Math.round(performance.now() - startTime),
    }
  }

  // Step 3: jsQR Engine (Fast QR)
  const jsQrRes = tryJsQr(normCanvas)
  if (jsQrRes) {
    return {
      text: jsQrRes.text,
      format: jsQrRes.format,
      engine: 'jsQR Engine',
      durationMs: Math.round(performance.now() - startTime),
    }
  }

  // Step 4: Multi-pass pre-processed ZXing
  // Pass 4a: Standard scaled image
  const zxingStandard = tryZxingOnCanvas(normCanvas)
  if (zxingStandard) {
    return {
      text: zxingStandard.text,
      format: zxingStandard.format,
      engine: 'ZXing (Standard)',
      durationMs: Math.round(performance.now() - startTime),
    }
  }

  // Pass 4b: Contrast Boosted Canvas
  const contrastCanvas = createContrastBoostedCanvas(normCanvas)
  const zxingContrast = tryZxingOnCanvas(contrastCanvas)
  if (zxingContrast) {
    return {
      text: zxingContrast.text,
      format: zxingContrast.format,
      engine: 'ZXing (Contrast Boosted)',
      durationMs: Math.round(performance.now() - startTime),
    }
  }

  // Pass 4c: Inverted Canvas (white on dark background)
  const invertedCanvas = createInvertedCanvas(normCanvas)
  const zxingInverted = tryZxingOnCanvas(invertedCanvas)
  if (zxingInverted) {
    return {
      text: zxingInverted.text,
      format: zxingInverted.format,
      engine: 'ZXing (Inverted)',
      durationMs: Math.round(performance.now() - startTime),
    }
  }

  // Pass 4d: Rotated 90° Canvas (vertical barcodes)
  const rotatedCanvas = createRotatedCanvas(normCanvas, 90)
  const zxingRotated = tryZxingOnCanvas(rotatedCanvas)
  if (zxingRotated) {
    return {
      text: zxingRotated.text,
      format: zxingRotated.format,
      engine: 'ZXing (Rotated 90°)',
      durationMs: Math.round(performance.now() - startTime),
    }
  }

  throw new Error('No QR code or barcode detected after multi-engine analysis.')
}

/**
 * Fast single-frame scanner optimized for live camera feeds.
 */
export async function scanCameraFrame(videoElement: HTMLVideoElement): Promise<ScanResult | null> {
  const startTime = performance.now()
  if (!videoElement || videoElement.readyState < 2) return null

  // 1. Try Native BarcodeDetector directly on video
  const nativeRes = await tryNativeBarcodeDetector(videoElement)
  if (nativeRes) {
    return {
      text: nativeRes.text,
      format: nativeRes.format,
      engine: 'Native BarcodeDetector (GPU Live)',
      durationMs: Math.round(performance.now() - startTime),
    }
  }

  // 2. Fall back to frame canvas
  try {
    const normCanvas = await sourceToNormalizedCanvas(videoElement, 700)
    const jsQrRes = tryJsQr(normCanvas)
    if (jsQrRes) {
      return {
        text: jsQrRes.text,
        format: jsQrRes.format,
        engine: 'jsQR Engine',
        durationMs: Math.round(performance.now() - startTime),
      }
    }

    const zxingRes = tryZxingOnCanvas(normCanvas)
    if (zxingRes) {
      return {
        text: zxingRes.text,
        format: zxingRes.format,
        engine: 'ZXing Engine',
        durationMs: Math.round(performance.now() - startTime),
      }
    }
  } catch {
    // Frame failed
  }
  return null
}
