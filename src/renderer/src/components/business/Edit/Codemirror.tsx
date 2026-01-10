import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { go } from '@codemirror/lang-go'
import { rust } from '@codemirror/lang-rust'
import { cpp } from '@codemirror/lang-cpp'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { useTheme } from '@renderer/provider/ThemeProvider'
import { CodeMirrorConfig, DEFAULT_CODEMIRROR_CONFIG } from './types'
import { Extension } from '@codemirror/state'
import { highlightActiveLine } from '@codemirror/view'
import { bracketMatching } from '@codemirror/language'
import { EditorView } from '@codemirror/view'

interface CodemirrorProps {
  value?: string
  onChange?: (value: string) => void
  language?: string
  config?: CodeMirrorConfig
}

// 语言扩展映射
const getLanguageExtension = (lang: string): Extension | null => {
  const langMap: Record<string, () => Extension> = {
    javascript: () => javascript({ jsx: true }),
    typescript: () => javascript({ jsx: true, typescript: true }),
    python: () => python(),
    java: () => java(),
    go: () => go(),
    rust: () => rust(),
    c: () => cpp(),
    cpp: () => cpp(),
    csharp: () => cpp(), // 使用 cpp 作为 C# 的近似
    html: () => html(),
    css: () => css(),
    json: () => json(),
    markdown: () => markdown(),
    sql: () => sql()
  }

  const factory = langMap[lang]
  return factory ? factory() : null
}

function Editor({
  value = `class Tree {\n  constructor() {\n    this.root = null;\n  }\n}`,
  onChange,
  language = 'javascript',
  config = DEFAULT_CODEMIRROR_CONFIG
}: CodemirrorProps) {
  const { theme } = useTheme()

  // 获取实际的主题（处理 system 情况）
  const isDark = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return theme === 'dark'
  }, [theme])

  // 构建扩展列表
  const extensions = useMemo(() => {
    const exts: Extension[] = []

    // 添加语言扩展
    const langExt = getLanguageExtension(language)
    if (langExt) {
      exts.push(langExt)
    }

    // 高亮当前行
    if (config.highlightActiveLine) {
      exts.push(highlightActiveLine())
    }

    // 括号匹配
    if (config.bracketMatching) {
      exts.push(bracketMatching())
    }

    // 自动换行
    if (config.lineWrapping) {
      exts.push(EditorView.lineWrapping)
    }

    return exts
  }, [language, config.highlightActiveLine, config.bracketMatching, config.lineWrapping])

  return (
    <div className="h-full w-full">
      <CodeMirror
        value={value}
        onChange={onChange}
        height="100%"
        width="100%"
        extensions={extensions}
        theme={isDark ? oneDark : 'light'}
        basicSetup={{
          lineNumbers: config.lineNumbers,
          foldGutter: config.foldGutter,
          autocompletion: config.autocompletion,
          highlightActiveLine: false, // 我们在 extensions 中手动处理
          bracketMatching: false // 我们在 extensions 中手动处理
        }}
        className="h-full"
      />
    </div>
  )
}

export default Editor
