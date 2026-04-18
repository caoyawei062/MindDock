import type { JSONContent } from '@tiptap/core'

export type AIAction =
  | 'improve'
  | 'shorten'
  | 'expand'
  | 'rewrite'
  | 'summarize'
  | 'translate'
  | 'fixGrammar'

export interface AIActionItem {
  id: AIAction
  label: string
  prompt: string
}

export const AI_ACTIONS: AIActionItem[] = [
  { id: 'improve', label: '优化', prompt: '在不改变原意的前提下优化表达，使内容更清晰专业。' },
  { id: 'shorten', label: '缩短', prompt: '在保留关键信息的前提下精简文本。' },
  { id: 'expand', label: '扩写', prompt: '在保持主题一致的前提下补充必要细节。' },
  { id: 'rewrite', label: '重写', prompt: '使用不同表达方式重写文本，保持原意不变。' },
  { id: 'summarize', label: '总结', prompt: '提炼文本核心要点并压缩为精炼版本。' },
  { id: 'translate', label: '翻译', prompt: '翻译成中文，保持语义准确和术语一致。' },
  { id: 'fixGrammar', label: '修复语法', prompt: '修复语法和标点问题，保持原有语气和含义。' }
]

export const QUICK_ACTIONS: AIAction[] = ['improve', 'shorten', 'expand', 'rewrite']

export function buildAIPrompt(actionPrompt: string, selectedText: string): string {
  return [
    '你是一个文本编辑助手。',
    `任务：${actionPrompt}`,
    '输出规则：',
    '1. 只输出最终结果文本，不要解释、标题、前后缀或额外说明。',
    '2. 不要输出“以下是”“修改后”等引导语。',
    '3. 保留原始段落与换行结构，除非任务本身要求改变。',
    '4. 如果结果是代码，仅输出代码本体，不要使用```代码围栏。',
    '待处理文本：',
    selectedText
  ].join('\n')
}

function buildInlineContent(lines: string[]): JSONContent[] {
  const content: JSONContent[] = []
  lines.forEach((line, index) => {
    if (line.length > 0) {
      content.push({ type: 'text', text: line })
    }
    if (index < lines.length - 1) {
      content.push({ type: 'hardBreak' })
    }
  })
  return content.length > 0 ? content : [{ type: 'text', text: '' }]
}

export function parseAIResultToContent(result: string): JSONContent[] {
  const lines = result.replace(/\r\n/g, '\n').split('\n')
  const blocks: JSONContent[] = []
  let index = 0

  const isBlockBoundary = (line: string): boolean => {
    if (!line.trim()) return true
    if (/^```/.test(line)) return true
    if (/^#{1,6}\s+/.test(line)) return true
    if (/^[-*]\s+/.test(line)) return true
    if (/^\d+\.\s+/.test(line)) return true
    return false
  }

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim() || 'plaintext'
      index += 1
      const codeLines: string[] = []
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) {
        index += 1
      }
      blocks.push({
        type: 'codeBlock',
        attrs: { language },
        content: [{ type: 'text', text: codeLines.join('\n') }]
      })
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        attrs: { level: Math.min(headingMatch[1].length, 6) },
        content: [{ type: 'text', text: headingMatch[2].trim() }]
      })
      index += 1
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: JSONContent[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        const itemText = lines[index].replace(/^[-*]\s+/, '').trim()
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: itemText }] }]
        })
        index += 1
      }
      blocks.push({ type: 'bulletList', content: items })
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: JSONContent[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        const itemText = lines[index].replace(/^\d+\.\s+/, '').trim()
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: itemText }] }]
        })
        index += 1
      }
      blocks.push({ type: 'orderedList', content: items })
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length && !isBlockBoundary(lines[index])) {
      paragraphLines.push(lines[index])
      index += 1
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        content: buildInlineContent(paragraphLines)
      })
    }
  }

  if (blocks.length === 0) {
    return [{ type: 'paragraph', content: [{ type: 'text', text: result.trim() }] }]
  }

  return blocks
}
