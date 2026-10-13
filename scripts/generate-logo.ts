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
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 1024px;
            height: 1024px;
            background-color: #f8f9fa;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: 'Plus Jakarta Sans', -apple-system, system-ui, sans-serif;
            overflow: hidden;
            position: relative;
          }
          .ambient-glow {
            position: absolute;
            top: -100px;
            right: -100px;
            width: 800px;
            height: 800px;
            border-radius: 50%;
            background: radial-gradient(circle at center, rgba(225, 29, 72, 0.04) 0%, rgba(245, 158, 11, 0.02) 40%, transparent 70%);
            pointer-events: none;
          }
          .ambient-glow-left {
            position: absolute;
            bottom: -150px;
            left: -150px;
            width: 700px;
            height: 700px;
            border-radius: 50%;
            background: radial-gradient(circle at center, rgba(16, 185, 129, 0.04) 0%, transparent 60%);
            pointer-events: none;
          }
          .card {
            position: relative;
            z-index: 10;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .icon-squircle {
            width: 320px;
            height: 320px;
            border-radius: 80px;
            background: #ffffff;
            border: 2px solid #e2e8f0;
            box-shadow: 
              0 30px 60px -12px rgba(15, 23, 42, 0.08),
              0 12px 24px -8px rgba(15, 23, 42, 0.04),
              0 0 0 1px rgba(15, 23, 42, 0.02);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 44px;
            position: relative;
          }
          .icon-badge {
            width: 220px;
            height: 220px;
            border-radius: 56px;
            background: #fff1f2;
            border: 2px solid #fecdd3;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .title {
            font-size: 88px;
            font-weight: 800;
            letter-spacing: -0.045em;
            color: #0f172a;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 16px;
            line-height: 1;
          }
          .subtitle {
            font-family: 'JetBrains Mono', monospace;
            font-size: 19px;
            font-weight: 600;
            letter-spacing: 0.3em;
            text-transform: uppercase;
            color: #64748b;
          }
          .badge {
            margin-top: 36px;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
            padding: 10px 24px;
            border-radius: 9999px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 14px;
            font-weight: 600;
            color: #334155;
            letter-spacing: 0.12em;
          }
          .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #e11d48;
            box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.2);
          }
        </style>
      </head>
      <body>
        <div class="ambient-glow"></div>
        <div class="ambient-glow-left"></div>
        <div class="card">
          <div class="icon-squircle">
            <div class="icon-badge">
              <svg width="130" height="130" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="m9 12 2 2 4-4" stroke="#059669" stroke-width="2.4" />
              </svg>
            </div>
          </div>
          <div class="title">Aver</div>
          <div class="subtitle">Proof of Funds</div>
          <div class="badge">
            <div class="dot"></div>
            MONAD TESTNET · MIP-8
          </div>
        </div>
      </body>
    </html>
  `

  await page.setContent(html, { waitUntil: 'domcontentloaded' })
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
