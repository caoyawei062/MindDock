import puppeteer from 'puppeteer'

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\son\w+=\{[^}]*\}/gi, '')
    .replace(/javascript:/gi, '')
}

/**
 * 将 HTML 内容转换为 PDF
 */
export async function exportToPDF(htmlContent: string, title: string): Promise<Buffer> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()

    // 设置 HTML 内容
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    })

    // 生成 PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; color: #666; padding: 10px 20px; width: 100%;">
          <span class="title">${title}</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 10px; color: #666; padding: 10px 20px; width: 100%; text-align: center;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `
    })

    return Buffer.from(pdfBuffer)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

/**
 * 将 HTML 内容转换为图片 (PNG)
 */
export async function exportToImage(htmlContent: string): Promise<Buffer> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()

    // 设置视口大小
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 2 // 高清
    })

    // 设置 HTML 内容
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    })

    // 获取页面实际高度
    const bodyHeight = await page.evaluate(() => {
      return document.body.scrollHeight
    })

    // 重新设置视口高度以适应整个内容
    await page.setViewport({
      width: 1200,
      height: bodyHeight,
      deviceScaleFactor: 2
    })

    // 截图
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png'
    })

    return screenshot as Buffer
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

/**
 * 将 Markdown/富文本内容转换为 HTML
 */
export function contentToHTML(title: string, content: string): string {
  // 简单的 Markdown 转 HTML (如果是 Markdown 内容)
  // 这里假设 content 是 HTML 或者 Markdown
  // 我们可以添加一个简单的 Markdown 解析器

  const htmlContent = content
    // 标题
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    // 粗体和斜体
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // 代码块
    .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    // 链接
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
    // 图片
    .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img src="$2" alt="$1" />')
    // 列表
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    // 换行
    .replace(/\n/gim, '<br />')
  const safeTitle = escapeHtml(title)
  const safeContent = sanitizeHtml(htmlContent)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }

    h1, h2, h3, h4, h5, h6 {
      margin: 24px 0 16px;
      font-weight: 600;
      line-height: 1.25;
    }

    h1 {
      font-size: 2em;
      border-bottom: 2px solid #eee;
      padding-bottom: 8px;
    }

    h2 {
      font-size: 1.5em;
      border-bottom: 1px solid #eee;
      padding-bottom: 6px;
    }

    h3 {
      font-size: 1.25em;
    }

    p {
      margin: 16px 0;
    }

    strong {
      font-weight: 600;
    }

    em {
      font-style: italic;
    }

    code {
      background: #f6f8fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.9em;
    }

    pre {
      background: #f6f8fa;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 16px 0;
    }

    pre code {
      background: none;
      padding: 0;
    }

    a {
      color: #0969da;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 16px 0;
    }

    ul, ol {
      margin: 16px 0;
      padding-left: 32px;
    }

    li {
      margin: 8px 0;
    }

    blockquote {
      border-left: 4px solid #ddd;
      padding: 0 16px;
      margin: 16px 0;
      color: #666;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }

    table th,
    table td {
      border: 1px solid #ddd;
      padding: 8px 12px;
    }

    table th {
      background: #f6f8fa;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="content">
    ${safeContent}
  </div>
</body>
</html>`
}
