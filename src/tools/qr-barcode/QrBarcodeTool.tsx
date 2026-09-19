import { useState, useRef, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import JsBarcode from 'jsbarcode'
import { CopyButton } from '../../components/CopyButton'
import {
  analyzeQrSecurity,
  validateBarcode,
  buildWifiQrPayload,
  buildTotpQrPayload,
  buildVCardQrPayload,
  buildEmailQrPayload,
  buildSmsQrPayload,
  buildCryptoQrPayload,
} from './qr-barcode-logic'

export default function QrBarcodeTool() {
  const [activeTab, setActiveTab] = useState<'qr-studio' | 'qr-scan' | 'barcode' | 'batch'>('qr-studio')

  // ─── Tab 1: QR Designer Studio State ──────────────────────────────────────
  const [qrPayloadType, setQrPayloadType] = useState<
    'url' | 'wifi' | 'totp' | 'vcard' | 'email' | 'sms' | 'crypto' | 'text'
  >('url')

  // Inputs
  const [urlInput, setUrlInput] = useState('https://example.com/login')
  const [wifiSsid, setWifiSsid] = useState('MyOffice_5G')
  const [wifiPass, setWifiPass] = useState('SuperSecretPass2026!')
  const [wifiType, setWifiType] = useState('WPA')
  const [totpLabel, setTotpLabel] = useState('user@example.com')
  const [totpSecret, setTotpSecret] = useState('JBSWY3DPEHPK3PXP')
  const [totpIssuer, setTotpIssuer] = useState('SecureToolkit')
  const [vcardName, setVcardName] = useState('Jane Developer')
  const [vcardTel, setVcardTel] = useState('+1-555-019-2831')
  const [vcardEmail, setVcardEmail] = useState('jane.dev@example.com')
  const [vcardOrg, setVcardOrg] = useState('CyberSec Labs')
  const [vcardTitle, setVcardTitle] = useState('Security Architect')
  const [emailTo, setEmailTo] = useState('contact@example.com')
  const [emailSubject, setEmailSubject] = useState('Security Inquiry')
  const [emailBody, setEmailBody] = useState('Hello Team, please check...')
  const [smsNum, setSmsNum] = useState('+1-555-019-9999')
  const [smsMsg, setSmsMsg] = useState('Emergency Security Alert!')
  const [cryptoCoin, setCryptoCoin] = useState<'bitcoin' | 'ethereum' | 'solana'>('bitcoin')
  const [cryptoAddr, setCryptoAddr] = useState('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
  const [cryptoAmount, setCryptoAmount] = useState('0.05')
  const [textInput, setTextInput] = useState('Hello from Secure Toolkit! 🔐')

  // QR Customization - Theme, Shapes & Gradients
  const [fgColor, setFgColor] = useState('#09090b')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [eccLevel, setEccLevel] = useState<'L' | 'M' | 'Q' | 'H'>('H')
  const [qrSize, setQrSize] = useState<number>(320)

  // Module Shapes & Finder Corner Styling
  const [dotStyle, setDotStyle] = useState<'square' | 'dots' | 'rounded' | 'diamond'>('square')
  const [cornerFrameStyle, setCornerFrameStyle] = useState<'square' | 'rounded' | 'circle' | 'octagon'>('rounded')
  const [cornerEyeballStyle, setCornerEyeballStyle] = useState<'square' | 'circle' | 'diamond'>('circle')
  const [cornerColor, setCornerColor] = useState<string>('#09090b')
  const [useCustomCornerColor, setUseCustomCornerColor] = useState<boolean>(false)

  // Gradients
  const [gradientType, setGradientType] = useState<'none' | 'linear' | 'radial'>('none')
  const [gradientColor2, setGradientColor2] = useState<string>('#10b981')
  const [gradientAngle, setGradientAngle] = useState<number>(135)

  // Outer Frames & Banners
  const [framePreset, setFramePreset] = useState<'none' | 'bottom-banner' | 'top-banner' | 'box-frame'>('none')
  const [frameText, setFrameText] = useState<string>('SCAN ME 📱')
  const [frameColor, setFrameColor] = useState<string>('#10b981')
  const [frameTextColor, setFrameTextColor] = useState<string>('#ffffff')

  // Logo Overlay & Badge Pad
  const [logoPreset, setLogoPreset] = useState<'none' | 'lock' | 'wifi' | 'web' | 'flash' | 'shield' | 'custom'>('none')
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null)
  const [logoScale, setLogoScale] = useState<number>(22)
  const [logoBadgeShape, setLogoBadgeShape] = useState<'circle' | 'rounded' | 'none'>('circle')

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Compute live payload
  const computePayload = useCallback(() => {
    switch (qrPayloadType) {
      case 'url':
        return urlInput
      case 'wifi':
        return buildWifiQrPayload(wifiSsid, wifiPass, wifiType)
      case 'totp':
        return buildTotpQrPayload(totpLabel, totpSecret, totpIssuer)
      case 'vcard':
        return buildVCardQrPayload({ fn: vcardName, tel: vcardTel, email: vcardEmail, org: vcardOrg, title: vcardTitle })
      case 'email':
        return buildEmailQrPayload(emailTo, emailSubject, emailBody)
      case 'sms':
        return buildSmsQrPayload(smsNum, smsMsg)
      case 'crypto':
        return buildCryptoQrPayload(cryptoCoin, cryptoAddr, cryptoAmount)
      default:
        return textInput
    }
  }, [
    qrPayloadType,
    urlInput,
    wifiSsid,
    wifiPass,
    wifiType,
    totpLabel,
    totpSecret,
    totpIssuer,
    vcardName,
    vcardTel,
    vcardEmail,
    vcardOrg,
    vcardTitle,
    emailTo,
    emailSubject,
    emailBody,
    smsNum,
    smsMsg,
    cryptoCoin,
    cryptoAddr,
    cryptoAmount,
    textInput,
  ])

  const payload = computePayload()

  // Advanced Canvas Custom Vector QR Renderer
  useEffect(() => {
    if (activeTab !== 'qr-studio' || !qrCanvasRef.current || !payload) return
    const canvas = qrCanvasRef.current

    try {
      // 1. Generate QR matrix data structure
      const qr = QRCode.create(payload, {
        errorCorrectionLevel: logoPreset !== 'none' ? 'H' : eccLevel,
      })
      const moduleCount = qr.modules.size

      // Quiet zone border (modules)
      const marginModules = 2
      const totalModules = moduleCount + marginModules * 2
      const tileSize = qrSize / totalModules

      // 2. Compute Frame Margins & Canvas Size
      let padTop = 0
      let padBottom = 0
      let padLeft = 0
      let padRight = 0

      if (framePreset === 'bottom-banner') {
        padLeft = padRight = padTop = 24
        padBottom = 76
      } else if (framePreset === 'top-banner') {
        padLeft = padRight = padBottom = 24
        padTop = 76
      } else if (framePreset === 'box-frame') {
        padLeft = padRight = padTop = 24
        padBottom = 64
      }

      const canvasWidth = Math.round(qrSize + padLeft + padRight)
      const canvasHeight = Math.round(qrSize + padTop + padBottom)

      canvas.width = canvasWidth
      canvas.height = canvasHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Clear & Fill Frame Outer Box
      if (framePreset !== 'none') {
        ctx.fillStyle = frameColor
        ctx.beginPath()
        ctx.roundRect(0, 0, canvasWidth, canvasHeight, 20)
        ctx.fill()

        // Inner White QR Card Box
        ctx.fillStyle = bgColor
        ctx.beginPath()
        ctx.roundRect(padLeft, padTop, qrSize, qrSize, 16)
        ctx.fill()
      } else {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      }

      // QR Origin coordinates
      const qrStartX = padLeft + marginModules * tileSize
      const qrStartY = padTop + marginModules * tileSize

      // 3. Create Main Fill Style (Solid, Linear Gradient, or Radial Gradient)
      let mainStyle: string | CanvasGradient = fgColor
      if (gradientType === 'linear') {
        const angleRad = (gradientAngle * Math.PI) / 180
        const r = qrSize / 2
        const cx = padLeft + qrSize / 2
        const cy = padTop + qrSize / 2
        const x1 = cx - r * Math.cos(angleRad)
        const y1 = cy - r * Math.sin(angleRad)
        const x2 = cx + r * Math.cos(angleRad)
        const y2 = cy + r * Math.sin(angleRad)

        const grad = ctx.createLinearGradient(x1, y1, x2, y2)
        grad.addColorStop(0, fgColor)
        grad.addColorStop(1, gradientColor2)
        mainStyle = grad
      } else if (gradientType === 'radial') {
        const cx = padLeft + qrSize / 2
        const cy = padTop + qrSize / 2
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, qrSize / 1.4)
        grad.addColorStop(0, fgColor)
        grad.addColorStop(1, gradientColor2)
        mainStyle = grad
      }

      // Helper to identify finder pattern areas (7x7 modules at top-left, top-right, bottom-left)
      const isFinderArea = (r: number, c: number) => {
        const isTL = r <= 6 && c <= 6
        const isTR = r <= 6 && c >= moduleCount - 7
        const isBL = r >= moduleCount - 7 && c <= 6
        return isTL || isTR || isBL
      }

      // 4. Render Data Module Shapes
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (isFinderArea(r, c)) continue
          if (!qr.modules.get(r, c)) continue

          const x = qrStartX + c * tileSize
          const y = qrStartY + r * tileSize

          ctx.fillStyle = mainStyle

          if (dotStyle === 'square') {
            ctx.fillRect(x, y, tileSize + 0.3, tileSize + 0.3)
          } else if (dotStyle === 'dots') {
            const radius = (tileSize / 2) * 0.88
            ctx.beginPath()
            ctx.arc(x + tileSize / 2, y + tileSize / 2, radius, 0, Math.PI * 2)
            ctx.fill()
          } else if (dotStyle === 'rounded') {
            const radius = tileSize * 0.4
            ctx.beginPath()
            ctx.roundRect(x, y, tileSize, tileSize, radius)
            ctx.fill()
          } else if (dotStyle === 'diamond') {
            ctx.beginPath()
            ctx.moveTo(x + tileSize / 2, y)
            ctx.lineTo(x + tileSize, y + tileSize / 2)
            ctx.lineTo(x + tileSize / 2, y + tileSize)
            ctx.lineTo(x, y + tileSize / 2)
            ctx.closePath()
            ctx.fill()
          }
        }
      }

      // 5. Render Custom Styled Finder Corner Frames & Eyeballs
      const finderColor = useCustomCornerColor ? cornerColor : mainStyle
      const finderCoords = [
        { r: 0, c: 0 },
        { r: 0, c: moduleCount - 7 },
        { r: moduleCount - 7, c: 0 },
      ]

      finderCoords.forEach(({ r, c }) => {
        const fx = qrStartX + c * tileSize
        const fy = qrStartY + r * tileSize
        const outerSize = 7 * tileSize
        const innerOffset = 1 * tileSize
        const innerSize = 5 * tileSize
        const eyeballOffset = 2 * tileSize
        const eyeballSize = 3 * tileSize

        ctx.fillStyle = finderColor

        // Outer Finder Ring Shape
        if (cornerFrameStyle === 'square') {
          ctx.fillRect(fx, fy, outerSize, outerSize)
        } else if (cornerFrameStyle === 'rounded') {
          ctx.beginPath()
          ctx.roundRect(fx, fy, outerSize, outerSize, tileSize * 2)
          ctx.fill()
        } else if (cornerFrameStyle === 'circle') {
          ctx.beginPath()
          ctx.arc(fx + outerSize / 2, fy + outerSize / 2, outerSize / 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (cornerFrameStyle === 'octagon') {
          const cut = tileSize * 1.5
          ctx.beginPath()
          ctx.moveTo(fx + cut, fy)
          ctx.lineTo(fx + outerSize - cut, fy)
          ctx.lineTo(fx + outerSize, fy + cut)
          ctx.lineTo(fx + outerSize, fy + outerSize - cut)
          ctx.lineTo(fx + outerSize - cut, fy + outerSize)
          ctx.lineTo(fx + cut, fy + outerSize)
          ctx.lineTo(fx, fy + outerSize - cut)
          ctx.lineTo(fx, fy + cut)
          ctx.closePath()
          ctx.fill()
        }

        // Inner Cutout Space (using Background Color)
        ctx.fillStyle = bgColor
        if (cornerFrameStyle === 'square') {
          ctx.fillRect(fx + innerOffset, fy + innerOffset, innerSize, innerSize)
        } else if (cornerFrameStyle === 'rounded') {
          ctx.beginPath()
          ctx.roundRect(fx + innerOffset, fy + innerOffset, innerSize, innerSize, tileSize * 1.2)
          ctx.fill()
        } else if (cornerFrameStyle === 'circle') {
          ctx.beginPath()
          ctx.arc(fx + outerSize / 2, fy + outerSize / 2, innerSize / 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (cornerFrameStyle === 'octagon') {
          const cut = tileSize * 1.0
          ctx.beginPath()
          ctx.moveTo(fx + innerOffset + cut, fy + innerOffset)
          ctx.lineTo(fx + innerOffset + innerSize - cut, fy + innerOffset)
          ctx.lineTo(fx + innerOffset + innerSize, fy + innerOffset + cut)
          ctx.lineTo(fx + innerOffset + innerSize, fy + innerOffset + innerSize - cut)
          ctx.lineTo(fx + innerOffset + innerSize - cut, fy + innerOffset + innerSize)
          ctx.lineTo(fx + innerOffset + cut, fy + innerOffset + innerSize)
          ctx.lineTo(fx + innerOffset, fy + innerOffset + innerSize - cut)
          ctx.lineTo(fx + innerOffset, fy + innerOffset + cut)
          ctx.closePath()
          ctx.fill()
        }

        // Eyeball Center
        ctx.fillStyle = finderColor
        const ex = fx + eyeballOffset
        const ey = fy + eyeballOffset

        if (cornerEyeballStyle === 'square') {
          ctx.fillRect(ex, ey, eyeballSize, eyeballSize)
        } else if (cornerEyeballStyle === 'circle') {
          ctx.beginPath()
          ctx.arc(ex + eyeballSize / 2, ey + eyeballSize / 2, eyeballSize / 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (cornerEyeballStyle === 'diamond') {
          ctx.beginPath()
          ctx.moveTo(ex + eyeballSize / 2, ey)
          ctx.lineTo(ex + eyeballSize, ey + eyeballSize / 2)
          ctx.lineTo(ex + eyeballSize / 2, ey + eyeballSize)
          ctx.lineTo(ex, ey + eyeballSize / 2)
          ctx.closePath()
          ctx.fill()
        }
      })

      // 6. Render Text Banner in Frame Presets
      if (framePreset !== 'none' && frameText) {
        ctx.fillStyle = frameTextColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        if (framePreset === 'bottom-banner') {
          ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
          const bannerY = canvasHeight - padBottom / 2
          const textMetrics = ctx.measureText(frameText)
          const pillW = Math.max(textMetrics.width + 36, 160)
          const pillH = 38

          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
          ctx.beginPath()
          ctx.roundRect(canvasWidth / 2 - pillW / 2, bannerY - pillH / 2, pillW, pillH, 19)
          ctx.fill()

          ctx.fillStyle = frameTextColor
          ctx.fillText(frameText, canvasWidth / 2, bannerY)
        } else if (framePreset === 'top-banner') {
          ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
          const bannerY = padTop / 2
          const textMetrics = ctx.measureText(frameText)
          const pillW = Math.max(textMetrics.width + 36, 160)
          const pillH = 38

          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
          ctx.beginPath()
          ctx.roundRect(canvasWidth / 2 - pillW / 2, bannerY - pillH / 2, pillW, pillH, 19)
          ctx.fill()

          ctx.fillStyle = frameTextColor
          ctx.fillText(frameText, canvasWidth / 2, bannerY)
        } else if (framePreset === 'box-frame') {
          ctx.font = 'bold 17px system-ui, -apple-system, sans-serif'
          const bannerY = canvasHeight - padBottom / 2
          ctx.fillText(frameText, canvasWidth / 2, bannerY)
        }
      }

      // 7. Logo Center Overlay
      let logoSrc: string | null = null
      if (logoPreset === 'custom' && customLogoUrl) {
        logoSrc = customLogoUrl
      } else if (logoPreset === 'lock') {
        logoSrc =
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981"><path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 5a3 3 0 116 0v3H9V7z"/></svg>'
      } else if (logoPreset === 'wifi') {
        logoSrc =
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981"><path d="M12 3c-4.97 0-9.47 2.01-12.73 5.27l2.12 2.12C4.1 7.68 7.85 6 12 6s7.9 1.68 10.61 4.39l2.12-2.12C21.47 5.01 16.97 3 12 3zm0 6c-3.31 0-6.31 1.34-8.49 3.51l2.12 2.12C7.2 13.06 9.45 12 12 12s4.8 1.06 6.37 2.63l2.12-2.12C18.31 10.34 15.31 9 12 9zm0 6c-1.66 0-3.16.67-4.24 1.76l4.24 4.24 4.24-4.24C15.16 15.67 13.66 15 12 15z"/></svg>'
      } else if (logoPreset === 'web') {
        logoSrc =
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
      } else if (logoPreset === 'flash') {
        logoSrc =
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>'
      } else if (logoPreset === 'shield') {
        logoSrc =
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>'
      }

      if (logoSrc) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const logoSize = Math.floor(qrSize * (logoScale / 100))
          const cx = padLeft + qrSize / 2
          const cy = padTop + qrSize / 2
          const lx = cx - logoSize / 2
          const ly = cy - logoSize / 2

          // Background Badge Pad under Logo
          if (logoBadgeShape === 'circle') {
            const radius = logoSize / 2 + 5
            ctx.fillStyle = bgColor
            ctx.beginPath()
            ctx.arc(cx, cy, radius, 0, Math.PI * 2)
            ctx.fill()
          } else if (logoBadgeShape === 'rounded') {
            const pad = 5
            ctx.fillStyle = bgColor
            ctx.beginPath()
            ctx.roundRect(lx - pad, ly - pad, logoSize + pad * 2, logoSize + pad * 2, 8)
            ctx.fill()
          }

          ctx.drawImage(img, lx, ly, logoSize, logoSize)
        }
        img.src = logoSrc
      }
    } catch (err) {
      console.error('Error rendering custom QR canvas:', err)
    }
  }, [
    activeTab,
    payload,
    fgColor,
    bgColor,
    eccLevel,
    qrSize,
    dotStyle,
    cornerFrameStyle,
    cornerEyeballStyle,
    cornerColor,
    useCustomCornerColor,
    gradientType,
    gradientColor2,
    gradientAngle,
    framePreset,
    frameText,
    frameColor,
    frameTextColor,
    logoPreset,
    customLogoUrl,
    logoScale,
    logoBadgeShape,
  ])

  const handleDownloadQr = (format: 'png' | 'jpeg' | 'webp') => {
    if (!qrCanvasRef.current) return
    const canvas = qrCanvasRef.current
    const dataUrl = canvas.toDataURL(`image/${format}`, 1.0)
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-code-${Date.now()}.${format}`
    a.click()
  }

  // ─── Shared clipboard copy toast state ─────────────────────────────────────
  const [copyToast, setCopyToast] = useState<string | null>(null)
  const showCopyToast = (label: string) => {
    setCopyToast(label)
    setTimeout(() => setCopyToast(null), 2000)
  }

  const handleCopyQr = async () => {
    if (!qrCanvasRef.current) return
    try {
      const canvas = qrCanvasRef.current
      canvas.toBlob(async (blob) => {
        if (!blob) return
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        showCopyToast('QR Code copied!')
      }, 'image/png')
    } catch {
      showCopyToast('Copy not supported in this browser.')
    }
  }

  // ─── Tab 2: Scanner & Security State ─────────────────────────────────────
  const [scannedText, setScannedText] = useState<string>('')
  const [scanError, setScanError] = useState<string>('')
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processImageFile(file)
  }

  const processImageFile = (file: File) => {
    setScanError('')
    setScannedText('')
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setScanError('Failed to initialize canvas context.')
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code) {
          setScannedText(code.data)
        } else {
          setScanError('No readable QR code found in the image.')
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Paste from clipboard support (Ctrl+V or button)
  const handlePasteClipboard = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const file = new File([blob], 'pasted-qr.png', { type })
            processImageFile(file)
            return
          }
        }
      }
      const text = await navigator.clipboard.readText()
      if (text) setScannedText(text)
    } catch {
      setScanError('Could not read image from clipboard. Make sure clipboard access is granted.')
    }
  }

  // Camera Scanning Loop
  const startCamera = async () => {
    setScanError('')
    setIsCameraActive(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        scanCameraFrame()
      }
    } catch {
      setScanError('Camera access denied or unavailable.')
      setIsCameraActive(false)
    }
  }

  const stopCamera = useCallback(() => {
    setIsCameraActive(false)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  const scanCameraFrame = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanCameraFrame)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        setScannedText(code.data)
        stopCamera()
        return
      }
    }
    animFrameRef.current = requestAnimationFrame(scanCameraFrame)
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const securityReport = scannedText ? analyzeQrSecurity(scannedText) : null

  // ─── Tab 3: Barcode Studio State ──────────────────────────────────────────
  const [barcodeFormat, setBarcodeFormat] = useState<
    'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE39' | 'ITF14' | 'MSI' | 'codabar'
  >('CODE128')
  const [barcodeValue, setBarcodeValue] = useState('SECURE-TOOLKIT-2026')
  const [barcodeLineColor, setBarcodeLineColor] = useState('#09090b')
  const [barcodeBgColor, setBarcodeBgColor] = useState('#ffffff')
  const [barcodeHeight, setBarcodeHeight] = useState<number>(80)
  const [barcodeWidth, setBarcodeWidth] = useState<number>(2)
  const [barcodeDisplayValue, setBarcodeDisplayValue] = useState<boolean>(true)

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (activeTab === 'barcode' && barcodeSvgRef.current && barcodeValue) {
      try {
        JsBarcode(barcodeSvgRef.current, barcodeValue, {
          format: barcodeFormat,
          width: barcodeWidth,
          height: barcodeHeight,
          displayValue: barcodeDisplayValue,
          background: barcodeBgColor,
          lineColor: barcodeLineColor,
        })
      } catch {
        // invalid barcode value
      }
    }
  }, [activeTab, barcodeFormat, barcodeValue, barcodeLineColor, barcodeBgColor, barcodeHeight, barcodeWidth, barcodeDisplayValue])

  const barcodeValidation = validateBarcode(barcodeFormat, barcodeValue)

  const handleDownloadBarcode = (format: 'svg' | 'png' | 'jpeg') => {
    const svg = barcodeSvgRef.current
    if (!svg) return

    if (format === 'svg') {
      const serializer = new XMLSerializer()
      const svgStr = serializer.serializeToString(svg)
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `barcode-${barcodeFormat}-${Date.now()}.svg`
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    // Rasterize SVG → Canvas → PNG/JPEG
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svg)
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || svg.clientWidth || 600
      canvas.height = img.naturalHeight || svg.clientHeight || 160
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = barcodeBgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL(`image/${format}`, 1.0)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `barcode-${barcodeFormat}-${Date.now()}.${format === 'jpeg' ? 'jpg' : format}`
      a.click()
      URL.revokeObjectURL(svgUrl)
    }
    img.src = svgUrl
  }

  // ─── Tab 4: Bulk Batch Generator State ─────────────────────────────────────
  const [batchText, setBatchText] = useState(
    'https://example.com/item/1\nhttps://example.com/item/2\nhttps://example.com/item/3',
  )
  const [batchList, setBatchList] = useState<{ id: string; val: string; qrUrl: string }[]>([])

  const handleGenerateBatch = async () => {
    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const items: { id: string; val: string; qrUrl: string }[] = []
    for (const l of lines) {
      try {
        const url = await QRCode.toDataURL(l, { width: 250, margin: 2 })
        items.push({ id: Math.random().toString(36).substring(2), val: l, qrUrl: url })
      } catch {
        // error
      }
    }
    setBatchList(items)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>📱</span>
          <span>Master QR &amp; Barcode Security Studio</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-400">
          Design custom QR codes with logo overlays, scan live via camera or clipboard, analyze security risks, generate 9 barcode formats, and bulk batch export.
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 overflow-x-auto no-scrollbar gap-2">
        {[
          { id: 'qr-studio', label: '🎨 QR Studio & Logos' },
          { id: 'qr-scan', label: '📷 Camera & Forensics' },
          { id: 'barcode', label: '📊 Barcode Studio' },
          { id: 'batch', label: '⚡ Bulk Batch Generator' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id as any)
              if (t.id !== 'qr-scan') stopCamera()
            }}
            className={`border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: MASTER QR STUDIO ───────────────────────────────────────── */}
      {activeTab === 'qr-studio' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            {/* Payload Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Payload Type Builder
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'url', label: '🌐 Link / URL' },
                  { id: 'wifi', label: '📶 Wi-Fi Point' },
                  { id: 'totp', label: '🔐 2FA TOTP' },
                  { id: 'vcard', label: '👤 vCard Contact' },
                  { id: 'email', label: '✉️ Email' },
                  { id: 'sms', label: '📱 SMS / Tel' },
                  { id: 'crypto', label: '💰 Crypto Wallet' },
                  { id: 'text', label: '📝 Plain Text' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setQrPayloadType(item.id as any)}
                    className={`rounded-lg p-2.5 text-xs font-bold transition border text-left ${
                      qrPayloadType === item.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Builder Forms */}
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-zinc-800">
              {qrPayloadType === 'url' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Destination URL</label>
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/login"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              )}

              {qrPayloadType === 'wifi' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Network SSID</label>
                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Wi-Fi Password</label>
                    <input
                      type="password"
                      value={wifiPass}
                      onChange={(e) => setWifiPass(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Encryption</label>
                    <select
                      value={wifiType}
                      onChange={(e) => setWifiType(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      <option value="WPA">WPA / WPA2 / WPA3</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">Open (No Password)</option>
                    </select>
                  </div>
                </div>
              )}

              {qrPayloadType === 'totp' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Account Label</label>
                    <input
                      type="text"
                      value={totpLabel}
                      onChange={(e) => setTotpLabel(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Base32 Secret</label>
                    <input
                      type="text"
                      value={totpSecret}
                      onChange={(e) => setTotpSecret(e.target.value.toUpperCase())}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Issuer</label>
                    <input
                      type="text"
                      value={totpIssuer}
                      onChange={(e) => setTotpIssuer(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
              )}

              {qrPayloadType === 'vcard' && (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Full Name *</label>
                    <input
                      type="text"
                      value={vcardName}
                      onChange={(e) => setVcardName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Phone</label>
                    <input
                      type="text"
                      value={vcardTel}
                      onChange={(e) => setVcardTel(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Email</label>
                    <input
                      type="email"
                      value={vcardEmail}
                      onChange={(e) => setVcardEmail(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Organization</label>
                    <input
                      type="text"
                      value={vcardOrg}
                      onChange={(e) => setVcardOrg(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Job Title</label>
                    <input
                      type="text"
                      value={vcardTitle}
                      onChange={(e) => setVcardTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
              )}

              {qrPayloadType === 'email' && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Recipient Email</label>
                      <input
                        type="email"
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Subject</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Body</label>
                    <textarea
                      rows={2}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
              )}

              {qrPayloadType === 'sms' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Phone Number</label>
                    <input
                      type="text"
                      value={smsNum}
                      onChange={(e) => setSmsNum(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Message Payload</label>
                    <input
                      type="text"
                      value={smsMsg}
                      onChange={(e) => setSmsMsg(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
              )}

              {qrPayloadType === 'crypto' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Coin</label>
                    <select
                      value={cryptoCoin}
                      onChange={(e) => setCryptoCoin(e.target.value as any)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      <option value="bitcoin">Bitcoin (BTC)</option>
                      <option value="ethereum">Ethereum (ETH)</option>
                      <option value="solana">Solana (SOL)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Wallet Address</label>
                    <input
                      type="text"
                      value={cryptoAddr}
                      onChange={(e) => setCryptoAddr(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Amount (Optional)</label>
                    <input
                      type="text"
                      value={cryptoAmount}
                      onChange={(e) => setCryptoAmount(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
              )}

              {qrPayloadType === 'text' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Plain Text Payload</label>
                  <textarea
                    rows={3}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              )}
            </div>

            {/* Visual Styling Customizer */}
            <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-2">
                <span>🎨</span>
                <span>Visual Studio Customizer</span>
              </h3>

              {/* 1. Module & Corner Shapes Panel */}
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  1. Module &amp; Finder Shapes
                </span>

                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Module Shape */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Data Modules</label>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'square', label: '⬛ Square' },
                        { id: 'dots', label: '🔴 Dots' },
                        { id: 'rounded', label: '▢ Rounded' },
                        { id: 'diamond', label: '🔷 Diamond' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDotStyle(item.id as any)}
                          className={`rounded-md p-1.5 text-xs font-bold transition border ${
                            dotStyle === item.id
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Corner Outer Ring */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Finder Outer Frame</label>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'square', label: '⏹ Square' },
                        { id: 'rounded', label: '▢ Rounded' },
                        { id: 'circle', label: '⭕ Circle' },
                        { id: 'octagon', label: '🛑 Octagon' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCornerFrameStyle(item.id as any)}
                          className={`rounded-md p-1.5 text-xs font-bold transition border ${
                            cornerFrameStyle === item.id
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Corner Eyeball */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Finder Inner Eyeball</label>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'square', label: '⬛ Square' },
                        { id: 'circle', label: '● Circle' },
                        { id: 'diamond', label: '◆ Diamond' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCornerEyeballStyle(item.id as any)}
                          className={`rounded-md p-1.5 text-xs font-bold transition border text-center ${
                            cornerEyeballStyle === item.id
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Finder Color Override */}
                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={useCustomCornerColor}
                      onChange={(e) => setUseCustomCornerColor(e.target.checked)}
                      className="rounded border-slate-300 accent-emerald-600"
                    />
                    <span>Custom Finder Corner Color</span>
                  </label>
                  {useCustomCornerColor && (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={cornerColor}
                        onChange={(e) => setCornerColor(e.target.value)}
                        className="h-7 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <span className="font-mono text-xs text-slate-700 dark:text-zinc-300">{cornerColor}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Color & Gradients Panel */}
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  2. Color Palette &amp; Linear/Radial Gradients
                </span>

                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  {/* Palette Mode */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Gradient Type</label>
                    <select
                      value={gradientType}
                      onChange={(e) => setGradientType(e.target.value as any)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="none">Solid Color</option>
                      <option value="linear">Linear Gradient</option>
                      <option value="radial">Radial Gradient</option>
                    </select>
                  </div>

                  {/* Primary Color */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      {gradientType !== 'none' ? 'Color 1 (Start)' : 'Foreground Color'}
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <span className="font-mono text-xs text-slate-700 dark:text-zinc-300">{fgColor}</span>
                    </div>
                  </div>

                  {/* Secondary Gradient Color */}
                  {gradientType !== 'none' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Color 2 (End)</label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          type="color"
                          value={gradientColor2}
                          onChange={(e) => setGradientColor2(e.target.value)}
                          className="h-8 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                        <span className="font-mono text-xs text-slate-700 dark:text-zinc-300">{gradientColor2}</span>
                      </div>
                    </div>
                  )}

                  {/* Background Color */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Background Color</label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <span className="font-mono text-xs text-slate-700 dark:text-zinc-300">{bgColor}</span>
                    </div>
                  </div>
                </div>

                {/* Gradient Angle Slider if linear */}
                {gradientType === 'linear' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Linear Angle ({gradientAngle}°)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={15}
                      value={gradientAngle}
                      onChange={(e) => setGradientAngle(Number(e.target.value))}
                      className="mt-1 w-full accent-emerald-600"
                    />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Resolution Size</label>
                    <input
                      type="range"
                      min={200}
                      max={600}
                      step={20}
                      value={qrSize}
                      onChange={(e) => setQrSize(Number(e.target.value))}
                      className="mt-1.5 w-full accent-emerald-600"
                    />
                    <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block text-right">{qrSize} × {qrSize} px</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Error Correction Level</label>
                    <select
                      value={eccLevel}
                      onChange={(e) => setEccLevel(e.target.value as any)}
                      disabled={logoPreset !== 'none'}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                    >
                      <option value="L">Low (7%)</option>
                      <option value="M">Medium (15%)</option>
                      <option value="Q">Quartile (25%)</option>
                      <option value="H">High (30% - Recommended for Logos)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Outer Frame & Text Banner Panel */}
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  3. Outer Frame &amp; Scan Me Banner
                </span>

                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { id: 'none', label: '🚫 No Frame' },
                    { id: 'bottom-banner', label: '🏷️ Bottom Banner' },
                    { id: 'top-banner', label: '🏷️ Top Banner' },
                    { id: 'box-frame', label: '📦 Box Frame' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setFramePreset(preset.id as any)}
                      className={`rounded-lg p-2 text-xs font-bold transition border text-center ${
                        framePreset === preset.id
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {framePreset !== 'none' && (
                  <div className="grid gap-3 sm:grid-cols-3 pt-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Banner Text Callout</label>
                      <input
                        type="text"
                        value={frameText}
                        onChange={(e) => setFrameText(e.target.value)}
                        placeholder="SCAN ME 📱"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    <div className="flex gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Frame Color</label>
                        <input
                          type="color"
                          value={frameColor}
                          onChange={(e) => setFrameColor(e.target.value)}
                          className="mt-1 h-8 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Text Color</label>
                        <input
                          type="color"
                          value={frameTextColor}
                          onChange={(e) => setFrameTextColor(e.target.value)}
                          className="mt-1 h-8 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Logo Overlay & Badge Pad Panel */}
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  4. Center Logo Badge Overlay
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'none', label: 'None' },
                    { id: 'lock', label: '🔐 Lock' },
                    { id: 'wifi', label: '📶 Wi-Fi' },
                    { id: 'web', label: '🌐 Web' },
                    { id: 'flash', label: '⚡ Bolt' },
                    { id: 'shield', label: '🛡️ Shield' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setLogoPreset(preset.id as any)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition ${
                        logoPreset === preset.id
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}

                  <label className="rounded-lg px-3 py-1.5 text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer">
                    + Custom Logo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (evt) => {
                          setCustomLogoUrl(evt.target?.result as string)
                          setLogoPreset('custom')
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                  </label>
                </div>

                {logoPreset !== 'none' && (
                  <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Logo Scale ({logoScale}%)
                      </label>
                      <input
                        type="range"
                        min={15}
                        max={30}
                        step={1}
                        value={logoScale}
                        onChange={(e) => setLogoScale(Number(e.target.value))}
                        className="mt-1 w-full accent-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Badge Background Pad
                      </label>
                      <div className="mt-1 flex gap-2">
                        {[
                          { id: 'circle', label: '⭕ Circle Pad' },
                          { id: 'rounded', label: '▢ Square Pad' },
                          { id: 'none', label: '🚫 No Pad' },
                        ].map((pad) => (
                          <button
                            key={pad.id}
                            type="button"
                            onClick={() => setLogoBadgeShape(pad.id as any)}
                            className={`rounded-md px-2.5 py-1 text-xs font-bold border transition ${
                              logoBadgeShape === pad.id
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                            }`}
                          >
                            {pad.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Live Canvas Preview Column */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 text-center flex items-center justify-center gap-2">
              <span>✨</span>
              <span>Live Preview</span>
            </h3>

            {/* Canvas Area */}
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-950 flex items-center justify-center overflow-hidden">
              <canvas ref={qrCanvasRef} className="max-w-full h-auto rounded-lg shadow-sm" />
            </div>

            {/* Active Style Badges */}
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-900">
                {dotStyle === 'square' ? '⬛' : dotStyle === 'dots' ? '🔴' : dotStyle === 'rounded' ? '▢' : '🔷'} {dotStyle}
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:ring-blue-900">
                {cornerFrameStyle} frame
              </span>
              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:ring-violet-900">
                {gradientType === 'none' ? 'solid' : gradientType + ' grad'}
              </span>
              {framePreset !== 'none' && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-900">
                  🏷️ {framePreset}
                </span>
              )}
              {logoPreset !== 'none' && (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-900">
                  🎯 logo
                </span>
              )}
            </div>

            {/* Payload Snippet */}
            <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-zinc-950">
              <span className="block font-mono text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                {payload || 'No payload entered'}
              </span>
            </div>

            {/* Download Buttons */}
            <div className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Download</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadQr('png')}
                  className="rounded-lg bg-emerald-600 px-2 py-2 text-xs font-bold text-white hover:bg-emerald-500 active:scale-95 transition-all text-center shadow-sm"
                >
                  ⬇ PNG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadQr('jpeg')}
                  className="rounded-lg bg-emerald-600 px-2 py-2 text-xs font-bold text-white hover:bg-emerald-500 active:scale-95 transition-all text-center shadow-sm"
                >
                  ⬇ JPG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadQr('webp')}
                  className="rounded-lg bg-slate-600 px-2 py-2 text-xs font-bold text-white hover:bg-slate-500 active:scale-95 transition-all text-center shadow-sm"
                >
                  ⬇ WEBP
                </button>
              </div>

              {/* Copy to Clipboard */}
              <button
                type="button"
                onClick={handleCopyQr}
                className="w-full rounded-lg border-2 border-emerald-500 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 active:scale-95 transition-all flex items-center justify-center gap-2 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-zinc-800"
              >
                {copyToast === 'QR Code copied!' ? (
                  <><span>✓</span><span>Copied to Clipboard!</span></>
                ) : (
                  <><span>📋</span><span>Copy QR Image</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: LIVE CAMERA & FORENSIC SCANNER ─────────────────────────── */}
      {activeTab === 'qr-scan' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Controls: File Upload & Camera Scanner */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Scan Input Source
              </h3>

              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition-colors">
                  <span>📁 Upload Image File</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>

                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition"
                >
                  📋 Paste Clipboard (Ctrl+V)
                </button>

                {!isCameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-500 transition shadow-xs"
                  >
                    📷 Start Live Camera Scan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500 transition shadow-xs"
                  >
                    ⏹️ Stop Camera
                  </button>
                )}
              </div>

              {/* Live Video Feed */}
              {isCameraActive && (
                <div className="relative overflow-hidden rounded-xl border border-sky-500 bg-black aspect-video flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <div className="absolute inset-0 border-2 border-dashed border-emerald-400/70 pointer-events-none rounded-xl m-8 flex items-center justify-center">
                    <span className="bg-black/60 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                      Scanning for QR code…
                    </span>
                  </div>
                </div>
              )}

              {scanError && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-xs font-semibold text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                  ⚠️ {scanError}
                </div>
              )}
            </div>

            {/* Right Results: Raw Content & Decoded Payload Card */}
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Scanned Raw Payload
                  </h3>
                  {scannedText && <CopyButton value={scannedText} label="Copy Payload" />}
                </div>

                {scannedText ? (
                  <div className="rounded-lg bg-slate-100 p-3 font-mono text-xs text-emerald-700 dark:bg-zinc-950 dark:text-emerald-400 break-all border border-slate-200 dark:border-zinc-800">
                    {scannedText}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 italic">No QR code scanned yet.</p>
                )}
              </div>

              {/* Forensic Extractors */}
              {securityReport?.wifiParsed && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-400">
                    📶 Wi-Fi Credentials Extracted
                  </h4>
                  <div className="font-mono text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                    <div>SSID: <span className="font-bold">{securityReport.wifiParsed.ssid}</span></div>
                    <div>Password: <span className="font-bold">{securityReport.wifiParsed.pass}</span></div>
                    <div>Encryption: <span>{securityReport.wifiParsed.type}</span></div>
                  </div>
                </div>
              )}

              {securityReport?.vcardParsed && (
                <div className="rounded-xl border border-sky-300 bg-sky-50 p-4 space-y-2 dark:border-sky-900/50 dark:bg-sky-950/20">
                  <h4 className="text-xs font-bold text-sky-900 dark:text-sky-400">
                    👤 vCard Contact Extracted
                  </h4>
                  <div className="font-mono text-xs text-sky-800 dark:text-sky-300 space-y-1">
                    <div>Name: <span className="font-bold">{securityReport.vcardParsed.fn}</span></div>
                    {securityReport.vcardParsed.tel && <div>Phone: <span>{securityReport.vcardParsed.tel}</span></div>}
                    {securityReport.vcardParsed.email && <div>Email: <span>{securityReport.vcardParsed.email}</span></div>}
                    {securityReport.vcardParsed.org && <div>Org: <span>{securityReport.vcardParsed.org}</span></div>}
                  </div>
                </div>
              )}

              {securityReport?.decodedBase64 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-400">
                    🔓 Decoded Base64 String Found
                  </h4>
                  <div className="font-mono text-xs text-amber-800 dark:text-amber-300 break-all">
                    {securityReport.decodedBase64}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Security Risk Report */}
          {securityReport && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <span>🛡️</span>
                <span>Security &amp; Forensic Risk Report</span>
              </h3>

              <div className="space-y-3">
                {securityReport.issues.map((issue, idx) => {
                  const styles = {
                    danger: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
                    warning: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
                    info: 'bg-slate-100 text-slate-900 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
                    success: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
                  }[issue.level]

                  return (
                    <div key={idx} className={`rounded-lg border p-3.5 ${styles}`}>
                      <div className="font-semibold text-xs">{issue.title}</div>
                      <div className="mt-0.5 text-xs opacity-90">{issue.desc}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: BARCODE STUDIO ─────────────────────────────────────────── */}
      {activeTab === 'barcode' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Barcode Specifications &amp; Styling
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Barcode Format</label>
                <select
                  value={barcodeFormat}
                  onChange={(e) => {
                    const newFmt = e.target.value as any
                    setBarcodeFormat(newFmt)
                    if (newFmt === 'EAN13') setBarcodeValue('4006381333931')
                    else if (newFmt === 'EAN8') setBarcodeValue('73513537')
                    else if (newFmt === 'UPC') setBarcodeValue('012345678905')
                    else if (newFmt === 'CODE39') setBarcodeValue('CODE39-TEST')
                    else setBarcodeValue('SECURE-TOOLKIT-2026')
                  }}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="CODE128">Code 128 (Alphanumeric Standard)</option>
                  <option value="EAN13">EAN-13 (13-Digit International)</option>
                  <option value="EAN8">EAN-8 (8-Digit Compact)</option>
                  <option value="UPC">UPC-A (12-Digit Retail)</option>
                  <option value="CODE39">Code 39 (Alphanumeric/Industrial)</option>
                  <option value="ITF14">ITF-14 (14-Digit Shipping)</option>
                  <option value="MSI">MSI (Mod 10 Checksum)</option>
                  <option value="codabar">Codabar (Libraries/FedEx)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Barcode Value</label>
                <input
                  type="text"
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Styling options */}
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 pt-2 border-t border-slate-200 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Line Color</label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={barcodeLineColor}
                    onChange={(e) => setBarcodeLineColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                  <span className="font-mono text-xs text-slate-700 dark:text-zinc-300">{barcodeLineColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Background Color</label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={barcodeBgColor}
                    onChange={(e) => setBarcodeBgColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                  <span className="font-mono text-xs text-slate-700 dark:text-zinc-300">{barcodeBgColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Bar Height ({barcodeHeight}px)</label>
                <input
                  type="range"
                  min={40}
                  max={160}
                  value={barcodeHeight}
                  onChange={(e) => setBarcodeHeight(Number(e.target.value))}
                  className="mt-2 w-full accent-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Bar Width ({barcodeWidth}px)</label>
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={barcodeWidth}
                  onChange={(e) => setBarcodeWidth(Number(e.target.value))}
                  className="mt-2 w-full accent-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="display-val-cb"
                checked={barcodeDisplayValue}
                onChange={(e) => setBarcodeDisplayValue(e.target.checked)}
                className="rounded accent-emerald-600"
              />
              <label htmlFor="display-val-cb" className="text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer">
                Display Text Value Under Barcode
              </label>
            </div>

            <div className="pt-2">
              {barcodeValidation.valid ? (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 font-semibold">
                  ✓ Valid format &amp; checksum verification passed for {barcodeFormat}.
                </div>
              ) : (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 font-semibold">
                  ⚠️ Format Validation Alert: {barcodeValidation.reason}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 text-center flex items-center justify-center gap-2">
              <span>📊</span>
              <span>Live Barcode Preview</span>
            </h3>

            {/* SVG Preview */}
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950 flex items-center justify-center overflow-x-auto">
              <svg ref={barcodeSvgRef} className="max-w-full" />
            </div>

            {/* Format Badge */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-900">
                {barcodeFormat}
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:ring-blue-900">
                {barcodeHeight}px height
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ${
                barcodeValidation.valid
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-900'
                  : 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-900'
              }`}>
                {barcodeValidation.valid ? '✓ Valid' : '✗ Invalid'}
              </span>
            </div>

            {/* Download Buttons */}
            <div className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Download</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadBarcode('svg')}
                  disabled={!barcodeValidation.valid}
                  className="rounded-lg bg-emerald-600 px-2 py-2 text-xs font-bold text-white hover:bg-emerald-500 active:scale-95 transition-all text-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ⬇ SVG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadBarcode('png')}
                  disabled={!barcodeValidation.valid}
                  className="rounded-lg bg-emerald-600 px-2 py-2 text-xs font-bold text-white hover:bg-emerald-500 active:scale-95 transition-all text-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ⬇ PNG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadBarcode('jpeg')}
                  disabled={!barcodeValidation.valid}
                  className="rounded-lg bg-slate-600 px-2 py-2 text-xs font-bold text-white hover:bg-slate-500 active:scale-95 transition-all text-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ⬇ JPG
                </button>
              </div>
              {!barcodeValidation.valid && (
                <p className="text-[10px] text-red-500 dark:text-red-400">Fix the validation error above to enable downloads.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: BULK BATCH GENERATOR ──────────────────────────────────── */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Bulk Multi-Line / CSV Payload Input
            </h3>

            <textarea
              rows={6}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Paste multiple lines or URLs (one per line)..."
              className="w-full rounded-lg border border-slate-300 bg-white p-4 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 resize-y"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerateBatch}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-xs"
              >
                ⚡ Generate Batch QR Codes
              </button>
            </div>
          </div>

          {batchList.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Generated Batch Output ({batchList.length} items)
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {batchList.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs space-y-3"
                  >
                    <img src={item.qrUrl} alt="Batch QR" className="h-40 w-40 rounded bg-white p-2 border border-slate-200" />
                    <span className="font-mono text-[11px] text-slate-700 dark:text-zinc-300 truncate w-full">
                      {item.val}
                    </span>
                    <a
                      href={item.qrUrl}
                      download={`qr-${item.id}.png`}
                      className="w-full rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition"
                    >
                      Download PNG
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
