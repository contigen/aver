import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer-core'

const main = async () => {
  const browser = await puppeteer.launch({
    executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 })

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 1024px;
            height: 1024px;
            background: radial-gradient(circle at 50% 30%, #1e1b4b 0%, #0f172a 60%, #020617 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
            overflow: hidden;
            position: relative;
          }
          .glow {
            position: absolute;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(131, 110, 249, 0.25) 0%, rgba(16, 185, 129, 0.15) 50%, transparent 70%);
            filter: blur(60px);
            top: 180px;
          }
          .card {
            position: relative;
            z-index: 10;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .icon-container {
            width: 360px;
            height: 360px;
            border-radius: 96px;
            background: linear-gradient(145deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%);
            border: 2px solid rgba(255, 255, 255, 0.18);
            box-shadow: 
              0 30px 80px -15px rgba(0, 0, 0, 0.7),
              inset 0 1px 2px rgba(255, 255, 255, 0.3),
              0 0 50px rgba(131, 110, 249, 0.2);
            backdrop-filter: blur(20px);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 48px;
          }
          .title {
            font-size: 88px;
            font-weight: 800;
            letter-spacing: -0.04em;
            color: #ffffff;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .subtitle {
            font-family: 'JetBrains Mono', monospace;
            font-size: 20px;
            font-weight: 600;
            letter-spacing: 0.32em;
            text-transform: uppercase;
            color: #94a3b8;
          }
          .badge {
            margin-top: 32px;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            padding: 10px 24px;
            border-radius: 9999px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 15px;
            color: #34d399;
            letter-spacing: 0.1em;
          }
          .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 10px #10b981;
          }
        </style>
      </head>
      <body>
        <div class="glow"></div>
        <div class="card">
          <div class="icon-container">
            <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="url(#shieldGrad)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <defs>
                <linearGradient id="shieldGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#ffffff" />
                  <stop offset="50%" stop-color="#836ef9" />
                  <stop offset="100%" stop-color="#10b981" />
                </linearGradient>
              </defs>
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              <path d="m9 12 2 2 4-4" stroke="#10b981" stroke-width="2.2" />
            </svg>
          </div>
          <div class="title">Aver</div>
          <div class="subtitle">Proof of Funds</div>
          <div class="badge">
            <div class="dot"></div>
            MONAD TESTNET
          </div>
        </div>
      </body>
    </html>
  `

  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.evaluateHandle('document.fonts.ready')

  const publicPath = path.join(process.cwd(), 'public', 'logo.png')
  const desktopPath = '/Users/macbook/Desktop/aver-logo.png'
  const artifactPath =
    '/Users/macbook/.gemini/antigravity/brain/ac3a38c3-722b-4fa8-9709-a0aa4d5f5b4f/aver-logo.png'

  await page.screenshot({ path: publicPath, type: 'png' })
  fs.copyFileSync(publicPath, desktopPath)
  fs.copyFileSync(publicPath, artifactPath)

  await browser.close()
  console.log('Logo generated successfully at:', publicPath)
  console.log('Copied to Desktop at:', desktopPath)
}

main().catch(console.error)
