export interface DiffLine {
  type: 'context' | 'removed' | 'added'
  content: string
}

export interface SearchReplaceBlock {
  search: string
  replace: string
}

export interface FencedCodeBlock {
  language: string
  content: string
}

export type AgentToolName =
  | 'modify_current_file'
  | 'replace_current_file'
  | 'request_user_input'
  | 'apply_patch'
  | 'apply_diff'
  | 'replace_file'
  | 'needs_input'

interface AgentToolArguments {
  summary?: string
  mode?: 'unified_diff' | 'replace_file'
  diff?: string
  changes?: AgentChangePreview[]
  content?: string
  patches?: SearchReplaceBlock[]
  missing?: string[]
}

export interface AgentToolCall {
  name: AgentToolName
  summary?: string
  arguments?: AgentToolArguments
}

export interface AgentChangePreview {
  title: string
  diff: string
}

export interface AgentResponseParts {
  summaryLines: string[]
  code: string
  body: string
  patches: SearchReplaceBlock[]
  unifiedDiff: string
  changePreviews: AgentChangePreview[]
  toolCall: AgentToolCall | null
  actionable: boolean
}

export function buildCodeAgentSystemPrompt(params: {
  title: string
  language: string
  currentDocument: string
}): string {
  const { title, language, currentDocument } = params

  return (
    `你现在处于代码 Edit 模式，是当前代码内容的单文件修改助手。` +
    `你需要优先完成用户目标，而不是机械地修改代码。` +
    `如果用户只是提问、解释、排查思路或询问概念，请直接回答，不要调用修改工具。` +
    `只有当用户明确要求修改、修复、重构、优化、替换、删除、新增或应用代码变更时，才调用 modify_current_file 工具。\n\n` +
    `写权限边界：你只能修改当前代码内容，不能假设自己可以读取或改写其他文件。` +
    `当前内容标题：${title}；语言：${language}。\n\n` +
    `可用工具声明：\n` +
    `1. modify_current_file(arguments)\n` +
    `   用途：修改当前代码草稿，并返回待本地执行的修改参数。\n` +
    `   arguments schema：{"summary": "一句话说明正在改什么", "mode": "unified_diff|replace_file", "diff": "mode 为 unified_diff 时必填，可应用到当前草稿的 unified diff", "content": "mode 为 replace_file 时必填，替换后的完整文件内容", "changes": [{"title": "改动标题", "diff": "该改动的 diff 片段"}]}\n\n` +
    `下面是当前代码内容的完整文本，这是你唯一允许修改的对象：\n\n` +
    `${currentDocument}\n\n` +
    `其他规则：\n` +
    `- 询问/分析类请求必须直接自然语言回答，不要生成 diff。\n` +
    `- 需要修改时优先用 unified_diff，改动很大时再用 replace_file。\n` +
    `- 工具执行结果会返回给你，不满足要求时可以继续修改。\n` +
    `- 信息不足时说明缺什么，不要猜测。`
  )
}

function extractFencedCodeBlocks(content: string): FencedCodeBlock[] {
  const matches = content.matchAll(/```([\w-]*)\n?([\s\S]*?)```/g)
  return Array.from(matches, (match) => ({
    language: match[1]?.trim() ?? '',
    content: match[2].trim()
  })).filter((item) => item.content.length > 0)
}

function extractCodeBlocks(content: string): string[] {
  return extractFencedCodeBlocks(content).map((item) => item.content)
}

function extractExecutableCodeBlocks(content: string): string[] {
  return extractFencedCodeBlocks(content)
    .filter((item) => item.language !== 'tool_call' && item.language !== 'diff')
    .map((item) => item.content)
}

export function extractBodyContent(content: string): string {
  return content
    .replace(/```tool_call\n?[\s\S]*?```/g, '')
    .replace(/```diff\n?[\s\S]*?```/g, '')
    .replace(/<<<<<<< SEARCH\r?\n[\s\S]*?\r?\n=======\r?\n[\s\S]*?\r?\n>>>>>>> REPLACE/g, '')
    .replace(/```tool_call[\s\S]*$/, '')
    .replace(/```diff[\s\S]*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractSearchReplaceBlocks(content: string): SearchReplaceBlock[] {
  const matches = content.matchAll(
    /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g
  )

  return Array.from(matches, (match) => ({
    search: match[1],
    replace: match[2]
  })).filter((item) => item.search.length > 0 || item.replace.length > 0)
}

function extractUnifiedDiff(content: string): string {
  const diffBlocks = extractFencedCodeBlocks(content).filter((block) => block.language === 'diff')
  if (diffBlocks.length > 0) {
    return diffBlocks[diffBlocks.length - 1]?.content ?? ''
  }

  const body = extractBodyContent(content)
  const hunkMatch = body.match(/@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@[\s\S]*/)
  return hunkMatch?.[0]?.trim() ?? ''
}

function extractChangePreviews(content: string): AgentChangePreview[] {
  const matches = content.matchAll(/(?:^|\n)###\s*CHANGE:\s*(.+?)\n```diff\n([\s\S]*?)```/g)

  return Array.from(matches, (match) => ({
    title: match[1]?.trim() ?? '未命名改动',
    diff: match[2]?.trim() ?? ''
  })).filter((item) => item.title.length > 0 && item.diff.length > 0)
}

export function extractToolCall(content: string): AgentToolCall | null {
  const jsonBlock = extractFencedCodeBlocks(content).find((block) => block.language === 'tool_call')
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock.content) as AgentToolCall
      if (
        parsed &&
        (parsed.name === 'modify_current_file' ||
          parsed.name === 'replace_current_file' ||
          parsed.name === 'request_user_input' ||
          parsed.name === 'apply_patch' ||
          parsed.name === 'apply_diff' ||
          parsed.name === 'replace_file' ||
          parsed.name === 'needs_input')
      ) {
        return parsed
      }
    } catch (error) {
      console.error('Failed to parse tool_call block:', error)
    }
  }

  if (extractSearchReplaceBlocks(content).length > 0) {
    return { name: 'apply_patch', summary: 'Apply search/replace patch blocks' }
  }
  if (extractUnifiedDiff(content)) {
    return { name: 'apply_diff', summary: 'Apply unified diff hunks' }
  }
  if (extractCodeBlocks(content)[0]) {
    return { name: 'replace_file', summary: 'Replace current file with generated output' }
  }

  return null
}

export function getToolCallSummary(toolCall: AgentToolCall | null): string {
  return toolCall?.arguments?.summary?.trim() || toolCall?.summary?.trim() || ''
}

function getToolCallDiff(toolCall: AgentToolCall | null): string {
  return toolCall?.arguments?.diff?.trim() || ''
}

function getToolCallContent(toolCall: AgentToolCall | null): string {
  return toolCall?.arguments?.content?.trim() || ''
}

function getToolCallChanges(toolCall: AgentToolCall | null): AgentChangePreview[] {
  const changes = toolCall?.arguments?.changes
  if (!Array.isArray(changes)) return []

  return changes
    .map((change) => ({
      title: change.title?.trim() || '未命名改动',
      diff: change.diff?.trim() || ''
    }))
    .filter((change) => change.diff.length > 0)
}

function getToolCallPatches(toolCall: AgentToolCall | null): SearchReplaceBlock[] {
  const patches = toolCall?.arguments?.patches
  if (!Array.isArray(patches)) return []

  return patches.filter(
    (patch) => (patch.search?.length ?? 0) > 0 || (patch.replace?.length ?? 0) > 0
  )
}

export function isNonActionableToolCall(toolCall: AgentToolCall | null): boolean {
  if (!toolCall) return false
  if (toolCall.name === 'needs_input' || toolCall.name === 'request_user_input') return true
  const summary = getToolCallSummary(toolCall)
  if (!summary) return false

  return /等待用户|请提供|需要更多|缺少|缺失|不足以|需要补充|请补充|补充信息|补充细节|进一步信息|更多信息/.test(summary)
}

export function parseAgentResponse(content: string): AgentResponseParts {
  const toolCall = extractToolCall(content)
  const body = extractBodyContent(content)
  const executableCodeBlocks = extractExecutableCodeBlocks(content)
  const fallbackCode = toolCall || !body ? executableCodeBlocks[0] || '' : ''
  const code = getToolCallContent(toolCall) || fallbackCode
  const patches = getToolCallPatches(toolCall)
  const unifiedDiff = getToolCallDiff(toolCall) || extractUnifiedDiff(content)
  const changePreviews = getToolCallChanges(toolCall)
  const fallbackPatches = extractSearchReplaceBlocks(content)
  const fallbackChangePreviews = extractChangePreviews(content)
  const finalPatches = patches.length > 0 ? patches : fallbackPatches
  const finalChangePreviews = changePreviews.length > 0 ? changePreviews : fallbackChangePreviews
  const summaryLines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, ''))
    .slice(0, 6)
  const actionable =
    !isNonActionableToolCall(toolCall) &&
    (finalPatches.length > 0 || Boolean(unifiedDiff) || Boolean(code))

  return {
    summaryLines,
    code,
    body,
    patches: finalPatches,
    unifiedDiff,
    changePreviews: finalChangePreviews,
    toolCall,
    actionable
  }
}

export function resolveDraftDocument(
  source: string,
  response: AgentResponseParts
): { draftDocument: string | null; previewIssue?: string } {
  if (
    response.toolCall?.name === 'needs_input' ||
    response.toolCall?.name === 'request_user_input'
  ) {
    return {
      draftDocument: null,
      previewIssue: getToolCallSummary(response.toolCall) || '需要补充信息后才能继续。'
    }
  }

  const attempts: Array<() => string> = []
  const errors: string[] = []

  const pushPatchAttempt = (): void => {
    if (!response.patches.length) return
    attempts.push(() => applySearchReplaceBlocks(source, response.patches))
  }

  const pushDiffAttempt = (): void => {
    if (!response.unifiedDiff) return
    attempts.push(() => applyUnifiedDiff(source, response.unifiedDiff))
  }

  const pushReplaceAttempt = (): void => {
    if (!response.code) return
    attempts.push(() => response.code)
  }

  switch (response.toolCall?.name) {
    case 'apply_patch':
      pushPatchAttempt()
      pushDiffAttempt()
      pushReplaceAttempt()
      break
    case 'modify_current_file':
    case 'apply_diff':
      pushDiffAttempt()
      pushPatchAttempt()
      pushReplaceAttempt()
      break
    case 'replace_current_file':
    case 'replace_file':
      pushReplaceAttempt()
      pushPatchAttempt()
      pushDiffAttempt()
      break
    default:
      pushPatchAttempt()
      pushDiffAttempt()
      pushReplaceAttempt()
      break
  }

  for (const attempt of attempts) {
    try {
      return { draftDocument: attempt() }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '无法解析当前 diff。')
    }
  }

  return {
    draftDocument: null,
    previewIssue: errors[0] || '模型没有返回可应用的单文件修改结果。'
  }
}

function applyUnifiedDiff(source: string, diffText: string): string {
  const lines = diffText.replace(/\r/g, '').split('\n')
  const hunks: Array<{ oldStart: number; lines: string[] }> = []
  let currentHunk: { oldStart: number; lines: string[] } | null = null

  lines.forEach((line) => {
    const headerMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (headerMatch) {
      if (currentHunk) hunks.push(currentHunk)
      currentHunk = {
        oldStart: Number(headerMatch[1]),
        lines: []
      }
      return
    }

    if (!currentHunk) return
    if (line.startsWith('\\ No newline at end of file')) return
    if (/^[ +-]/.test(line)) {
      currentHunk.lines.push(line)
    }
  })

  if (currentHunk) {
    hunks.push(currentHunk)
  }

  if (hunks.length === 0) {
    throw new Error('未找到可应用的 unified diff hunk。')
  }

  const sourceLines = source.replace(/\r/g, '').split('\n')
  const result: string[] = []
  let sourceIndex = 0

  hunks.forEach((hunk, hunkIndex) => {
    const hunkStart = Math.max(0, hunk.oldStart - 1)
    while (sourceIndex < hunkStart) {
      result.push(sourceLines[sourceIndex])
      sourceIndex += 1
    }

    hunk.lines.forEach((line) => {
      const prefix = line[0]
      const contentLine = line.slice(1)

      if (prefix === ' ') {
        if (sourceLines[sourceIndex] !== contentLine) {
          throw new Error(`第 ${hunkIndex + 1} 个 diff hunk 的上下文与当前内容不匹配。`)
        }
        result.push(contentLine)
        sourceIndex += 1
        return
      }

      if (prefix === '-') {
        if (sourceLines[sourceIndex] !== contentLine) {
          throw new Error(`第 ${hunkIndex + 1} 个 diff hunk 的删除行与当前内容不匹配。`)
        }
        sourceIndex += 1
        return
      }

      if (prefix === '+') {
        result.push(contentLine)
      }
    })
  })

  while (sourceIndex < sourceLines.length) {
    result.push(sourceLines[sourceIndex])
    sourceIndex += 1
  }

  return result.join('\n')
}

function countOccurrences(source: string, needle: string): number {
  if (!needle) return 0

  let count = 0
  let index = 0
  while (index <= source.length) {
    const nextIndex = source.indexOf(needle, index)
    if (nextIndex === -1) break
    count += 1
    index = nextIndex + needle.length
  }
  return count
}

function applySearchReplaceBlocks(source: string, patches: SearchReplaceBlock[]): string {
  let nextSource = source

  patches.forEach((patch, index) => {
    const occurrences = countOccurrences(nextSource, patch.search)
    if (occurrences === 0) {
      throw new Error(`第 ${index + 1} 个补丁的 SEARCH 块未在当前内容中找到。`)
    }
    if (occurrences > 1) {
      throw new Error(`第 ${index + 1} 个补丁的 SEARCH 块在当前内容中出现了多次，无法安全应用。`)
    }
    nextSource = nextSource.replace(patch.search, patch.replace)
  })

  return nextSource
}

export function buildLineDiff(previousText: string, nextText: string): DiffLine[] {
  const previousLines = previousText.split('\n')
  const nextLines = nextText.split('\n')

  let prefix = 0
  while (
    prefix < previousLines.length &&
    prefix < nextLines.length &&
    previousLines[prefix] === nextLines[prefix]
  ) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix < previousLines.length - prefix &&
    suffix < nextLines.length - prefix &&
    previousLines[previousLines.length - 1 - suffix] === nextLines[nextLines.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const diff: DiffLine[] = []

  previousLines.slice(0, prefix).forEach((line) => {
    diff.push({ type: 'context', content: line })
  })
  previousLines.slice(prefix, previousLines.length - suffix).forEach((line) => {
    diff.push({ type: 'removed', content: line })
  })
  nextLines.slice(prefix, nextLines.length - suffix).forEach((line) => {
    diff.push({ type: 'added', content: line })
  })
  nextLines.slice(nextLines.length - suffix).forEach((line) => {
    diff.push({ type: 'context', content: line })
  })

  return diff
}

export function getToolCallLabel(name: AgentToolCall['name']): string {
  if (name === 'modify_current_file') return 'modify_current_file'
  if (name === 'replace_current_file') return 'replace_current_file'
  if (name === 'request_user_input') return 'request_user_input'
  if (name === 'apply_patch') return 'Patch'
  if (name === 'apply_diff') return 'Diff'
  if (name === 'needs_input') return 'Reply'
  return 'Replace File'
}

export function countDiffStats(lines: DiffLine[]): { added: number; removed: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.type === 'added') acc.added += 1
      if (line.type === 'removed') acc.removed += 1
      return acc
    },
    { added: 0, removed: 0 }
  )
}
