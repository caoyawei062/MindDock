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
import { Extension, RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, DecorationSet, drawSelection, highlightActiveLine } from '@codemirror/view'
import { bracketMatching } from '@codemirror/language'
import { EditorView } from '@codemirror/view'

interface CodemirrorProps {
  value?: string
  onChange?: (value: string) => void
  language?: string
  config?: CodeMirrorConfig
  onSelectionChange?: (selection: string) => void
  onEditorReady?: (view: EditorView) => void
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

const buildPersistentSelectionDecorations = (state: EditorView['state']): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>()
  for (const range of state.selection.ranges) {
    if (range.empty) continue
    builder.add(range.from, range.to, Decoration.mark({ class: 'cm-persistentSelection' }))
  }
  return builder.finish()
}

const persistentSelectionField = StateField.define<DecorationSet>({
  create(state) {
    return buildPersistentSelectionDecorations(state)
  },
  update(_, transaction) {
    if (transaction.selection || transaction.docChanged) {
      return buildPersistentSelectionDecorations(transaction.state)
    }
    return buildPersistentSelectionDecorations(transaction.state)
  },
  provide: (field) => EditorView.decorations.from(field)
})

function Editor({
  value = `class Tree {\n  constructor() {\n    this.root = null;\n  }\n}`,
  onChange,
  language = 'javascript',
  config = DEFAULT_CODEMIRROR_CONFIG,
  onSelectionChange,
  onEditorReady
}: CodemirrorProps): React.JSX.Element {
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
    if (isDark) {
      exts.push(oneDark)
    }

    const backgroundTheme = EditorView.theme(
      {
        '&': {
          backgroundColor: isDark ? '#111315' : '#f7f7f8',
          color: isDark ? '#e5e7eb' : '#111827'
        },
        '.cm-scroller': {
          backgroundColor: isDark ? '#111315' : '#f7f7f8'
        },
        '.cm-content': {
          backgroundColor: isDark ? '#111315' : '#f7f7f8',
          caretColor: isDark ? '#f9fafb' : '#111827',
          position: 'relative',
          zIndex: '2'
        },
        '.cm-selectionLayer': {
          zIndex: '1'
        },
        '.cm-cursorLayer': {
          zIndex: '3'
        },
        '.cm-gutters': {
          backgroundColor: isDark ? '#111315' : '#f3f4f6',
          borderRight: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(17,24,39,0.06)',
          color: isDark ? 'rgba(229,231,235,0.45)' : 'rgba(17,24,39,0.4)'
        },
        '.cm-activeLine': {
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(17,24,39,0.03)'
        },
        '.cm-activeLineGutter': {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,24,39,0.04)'
        },
        '&.cm-focused': {
          outline: 'none'
        },
        '.cm-selectionLayer .cm-selectionBackground': {
          backgroundColor: isDark ? 'rgba(96,165,250,0.28)' : 'rgba(59,130,246,0.22)'
        },
        '.cm-persistentSelection': {
          backgroundColor: isDark ? 'rgba(96,165,250,0.18)' : 'rgba(59,130,246,0.14)',
          borderRadius: '2px'
        },
        '&.cm-focused .cm-selectionLayer .cm-selectionBackground': {
          backgroundColor: isDark ? 'rgba(96,165,250,0.34)' : 'rgba(59,130,246,0.28)'
        },
        '&.cm-focused .cm-persistentSelection': {
          backgroundColor: isDark ? 'rgba(96,165,250,0.24)' : 'rgba(59,130,246,0.18)'
        },
        '.cm-content ::selection': {
          backgroundColor: isDark ? 'rgba(96,165,250,0.28)' : 'rgba(59,130,246,0.22)'
        },
        '&.cm-focused .cm-content ::selection': {
          backgroundColor: isDark ? 'rgba(96,165,250,0.34)' : 'rgba(59,130,246,0.28)'
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: isDark ? '#f9fafb' : '#111827'
        }
      },
      { dark: isDark }
    )

    exts.push(backgroundTheme)
    exts.push(drawSelection())
    exts.push(persistentSelectionField)

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

    if (onSelectionChange) {
      exts.push(
        EditorView.updateListener.of((update) => {
          if (!update.selectionSet && !update.docChanged) return

          const mainSelection = update.state.selection.main
          if (mainSelection.empty) {
            onSelectionChange('')
            return
          }

          const selectedText = update.state.sliceDoc(mainSelection.from, mainSelection.to)
          onSelectionChange(selectedText)
        })
      )
    }

    return exts
  }, [
    language,
    config.highlightActiveLine,
    config.bracketMatching,
    config.lineWrapping,
    onSelectionChange,
    isDark
  ])

  return (
    <div className="h-full w-full">
      <CodeMirror
        value={value}
        onChange={onChange}
        height="100%"
        width="100%"
        extensions={extensions}
        basicSetup={{
          lineNumbers: config.lineNumbers,
          foldGutter: config.foldGutter,
          autocompletion: config.autocompletion,
          highlightActiveLine: false, // 我们在 extensions 中手动处理
          bracketMatching: false // 我们在 extensions 中手动处理
        }}
        onCreateEditor={(view: EditorView) => {
          onEditorReady?.(view)
        }}
        className="h-full"
      />
    </div>
  )
}

export default Editor
