import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import type { PublicCertView } from './types'

export const generateCertificatePdf = async (
  cert: PublicCertView,
  verifyUrl: string,
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const { width, height } = page.getSize()

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)

  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: rgb(0.12, 0.14, 0.17),
    borderWidth: 1.5,
  })

  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: rgb(0.85, 0.87, 0.9),
    borderWidth: 0.5,
  })

  page.drawRectangle({
    x: 24,
    y: height - 56,
    width: width - 48,
    height: 32,
    color: rgb(0.96, 0.94, 0.88),
  })

  page.drawText('TESTNET — NO MONETARY VALUE — OFFICIAL TEST DOCUMENT', {
    x: 75,
    y: height - 45,
    size: 10,
    font: fontBold,
    color: rgb(0.65, 0.45, 0.05),
  })

  page.drawText('AVER PROTOCOL', {
    x: 50,
    y: height - 90,
    size: 14,
    font: fontBold,
    color: rgb(0.2, 0.22, 0.26),
  })

  page.drawText('PROOF OF FUNDS CERTIFICATE', {
    x: 50,
    y: height - 120,
    size: 20,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.14),
  })

  page.drawText(
    'Cryptographically anchored on Monad Testnet (Chain ID 10143)',
    {
      x: 50,
      y: height - 138,
      size: 9,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    },
  )

  const formattedAmount = (Number(cert.threshold) / 1e6).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    },
  )

  const windowDays = (cert.windowSeconds / 86400).toFixed(1).replace(/\.0$/, '')
  const issuedDate = new Date(cert.issuedAt * 1000).toUTCString()
  const expiresDate = new Date(cert.expiresAt * 1000).toUTCString()

  const statement =
    cert.mode === 'Locked'
      ? `This certificate formally certifies that ${formattedAmount} ${cert.tokenSymbol} is securely locked in LockVault until ${expiresDate}. Funds cannot be withdrawn or decreased while locked.`
      : `This certificate formally attests that the holder of commitment ${cert.holderCommitment.slice(0, 10)}... continuously maintained a verified minimum balance of ${formattedAmount} ${cert.tokenSymbol} across the ${windowDays}-day observation window ending on ${issuedDate}.`

  const words = statement.split(' ')
  let line = ''
  let yPosition = height - 180

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    const testWidth = fontRegular.widthOfTextAtSize(testLine, 11)
    if (testWidth > width - 100) {
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: 11,
        font: fontRegular,
        color: rgb(0.15, 0.18, 0.22),
      })
      line = word
      yPosition -= 16
    } else {
      line = testLine
    }
  }

  if (line) {
    page.drawText(line, {
      x: 50,
      y: yPosition,
      size: 11,
      font: fontRegular,
      color: rgb(0.15, 0.18, 0.22),
    })
    yPosition -= 24
  }

  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 1,
    color: rgb(0.85, 0.87, 0.9),
  })

  yPosition -= 24

  const metadata: Array<[string, string]> = [
    ['Certificate ID', cert.certId],
    [
      'Mode',
      cert.mode === 'Locked'
        ? 'Locked (Vault Time-Lock Guarantee)'
        : 'Observed (Continuous Monitoring)',
    ],
    ['Threshold Required', `${formattedAmount} ${cert.tokenSymbol}`],
    ['Token Contract', cert.token],
    ['Holder Commitment', cert.holderCommitment],
    ['Issued At', issuedDate],
    ['Expires At', expiresDate],
    ['Anchor Tx Hash', cert.anchorTxHash || 'On-Chain Registry Record'],
  ]

  for (const [key, val] of metadata) {
    page.drawText(key, {
      x: 50,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: rgb(0.35, 0.4, 0.45),
    })

    const isMono = val.startsWith('0x')
    page.drawText(val, {
      x: 180,
      y: yPosition,
      size: isMono ? 8 : 9,
      font: isMono ? fontMono : fontRegular,
      color: rgb(0.1, 0.12, 0.15),
    })

    yPosition -= 18
  }

  yPosition -= 20

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 130,
    color: {
      dark: '#121417',
      light: '#FFFFFF',
    },
  })

  const base64Data = qrDataUrl.split(',')[1]
  const qrBytes = Buffer.from(base64Data, 'base64')
  const qrImage = await pdfDoc.embedPng(qrBytes)

  page.drawImage(qrImage, {
    x: 50,
    y: yPosition - 130,
    width: 120,
    height: 120,
  })

  page.drawText('SCAN TO VERIFY LIVE STATUS', {
    x: 190,
    y: yPosition - 25,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.12, 0.15),
  })

  const qrExplain = [
    'This certificate is living and killable. Scanning this QR code',
    'retrieves real-time status directly from the Monad blockchain.',
    'If holder balance drops below threshold, this certificate',
    'immediately displays BREACHED within 1-2 blocks.',
  ]

  let qrExplainY = yPosition - 45
  for (const exp of qrExplain) {
    page.drawText(exp, {
      x: 190,
      y: qrExplainY,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.45),
    })
    qrExplainY -= 13
  }

  page.drawText('Verify live URL:', {
    x: 190,
    y: qrExplainY - 8,
    size: 8,
    font: fontBold,
    color: rgb(0.2, 0.25, 0.3),
  })

  page.drawText(
    verifyUrl.length > 50 ? `${verifyUrl.slice(0, 48)}...` : verifyUrl,
    {
      x: 190,
      y: qrExplainY - 20,
      size: 7.5,
      font: fontMono,
      color: rgb(0.1, 0.35, 0.7),
    },
  )

  page.drawRectangle({
    x: 50,
    y: 55,
    width: width - 100,
    height: 40,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.88, 0.9, 0.92),
    borderWidth: 0.5,
  })

  page.drawText('Trust Model & Verification Guarantee:', {
    x: 58,
    y: 83,
    size: 7.5,
    font: fontBold,
    color: rgb(0.2, 0.25, 0.3),
  })

  page.drawText(
    'Notarized mode relies on the designated attestor for private address verification. Open mode allows verifiers',
    {
      x: 58,
      y: 72,
      size: 7,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    },
  )

  page.drawText(
    'to independently verify holder address balance history directly via public RPC without trusting any third party.',
    {
      x: 58,
      y: 62,
      size: 7,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    },
  )

  return await pdfDoc.save()
}
