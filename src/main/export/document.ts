import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripTagsPreserveText(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, ''))
}

function normalizeParagraphText(input: string): string {
  return stripTagsPreserveText(input)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function convertListBlock(input: string, ordered: boolean): string {
  const matches = [...input.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  if (matches.length === 0) return ''

  return matches
    .map((match, index) => {
      const item = normalizeHtmlToMarkdown(match[1]).trim()
      const prefix = ordered ? `${index + 1}. ` : '- '
      return item
        .split('\n')
        .map((line, lineIndex) => (lineIndex === 0 ? `${prefix}${line}` : `  ${line}`))
        .join('\n')
    })
    .join('\n')
}

export function normalizeHtmlToMarkdown(html: string): string {
  let markdown = html
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(
      /<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,
      (_m, _tag, text) => `**${normalizeParagraphText(text)}**`
    )
    .replace(
      /<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi,
      (_m, _tag, text) => `*${normalizeParagraphText(text)}*`
    )
    .replace(
      /<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_m, href, text) => `[${normalizeParagraphText(text)}](${href})`
    )
    .replace(
      /<img [^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
      (_m, src, alt) => `![${decodeHtmlEntities(alt)}](${src})`
    )
    .replace(
      /<img [^>]*alt="([^"]*)"[^>]*src="([^"]+)"[^>]*\/?>/gi,
      (_m, alt, src) => `![${decodeHtmlEntities(alt)}](${src})`
    )
    .replace(/<img [^>]*src="([^"]+)"[^>]*\/?>/gi, (_m, src) => `![](${src})`)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, text) =>
      normalizeHtmlToMarkdown(text)
        .split('\n')
        .filter(Boolean)
        .map((line) => `> ${line}`)
        .join('\n')
    )
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, text) => `# ${normalizeParagraphText(text)}\n\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, text) => `## ${normalizeParagraphText(text)}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, text) => `### ${normalizeParagraphText(text)}\n\n`)
    .replace(
      /<h4[^>]*>([\s\S]*?)<\/h4>/gi,
      (_m, text) => `#### ${normalizeParagraphText(text)}\n\n`
    )
    .replace(
      /<h5[^>]*>([\s\S]*?)<\/h5>/gi,
      (_m, text) => `##### ${normalizeParagraphText(text)}\n\n`
    )
    .replace(
      /<h6[^>]*>([\s\S]*?)<\/h6>/gi,
      (_m, text) => `###### ${normalizeParagraphText(text)}\n\n`
    )
    .replace(
      /<pre[^>]*data-language="([^"]+)"[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
      (_m, lang, code) => `\`\`\`${lang}\n${decodeHtmlEntities(code).trim()}\n\`\`\`\n\n`
    )
    .replace(
      /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
      (_m, code) => `\`\`\`\n${decodeHtmlEntities(code).trim()}\n\`\`\`\n\n`
    )
    .replace(
      /<code[^>]*>([\s\S]*?)<\/code>/gi,
      (_m, code) => `\`${decodeHtmlEntities(code).trim()}\``
    )
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, list) => `${convertListBlock(list, false)}\n\n`)
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, list) => `${convertListBlock(list, true)}\n\n`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, text) => `${normalizeParagraphText(text)}\n\n`)
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (_m, text) => `${normalizeHtmlToMarkdown(text)}\n`)

  markdown = decodeHtmlEntities(markdown)
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return markdown
}

export async function createDocxFromHtml(html: string, outputPath: string): Promise<void> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'minddock-docx-'))
  const relsDir = path.join(tempDir, '_rels')
  const wordDir = path.join(tempDir, 'word')
  const wordRelsDir = path.join(wordDir, '_rels')

  await fs.mkdir(relsDir, { recursive: true })
  await fs.mkdir(wordRelsDir, { recursive: true })

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="html" ContentType="text/html"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:altChunk r:id="htmlChunk"/>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="htmlChunk" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/>
</Relationships>`

  await fs.writeFile(path.join(tempDir, '[Content_Types].xml'), contentTypes, 'utf8')
  await fs.writeFile(path.join(relsDir, '.rels'), rootRels, 'utf8')
  await fs.writeFile(path.join(wordDir, 'document.xml'), documentXml, 'utf8')
  await fs.writeFile(path.join(wordRelsDir, 'document.xml.rels'), documentRels, 'utf8')
  await fs.writeFile(path.join(wordDir, 'afchunk.html'), html, 'utf8')

  try {
    await fs.rm(outputPath, { force: true })
    await execFileAsync('/usr/bin/zip', ['-q', '-r', outputPath, '.'], { cwd: tempDir })
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}
