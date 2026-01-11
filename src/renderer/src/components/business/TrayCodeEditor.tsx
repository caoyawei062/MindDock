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
import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

interface TrayCodeEditorProps {
    value?: string
    onChange?: (value: string) => void
    language?: string
    placeholder?: string
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
        csharp: () => cpp(),
        html: () => html(),
        css: () => css(),
        json: () => json(),
        markdown: () => markdown(),
        sql: () => sql()
    }

    const factory = langMap[lang]
    return factory ? factory() : null
}

function TrayCodeEditor({
    value = '',
    onChange,
    language = 'javascript',
    placeholder = '输入代码...'
}: TrayCodeEditorProps) {
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

        // 自动换行
        exts.push(EditorView.lineWrapping)

        // placeholder 样式
        exts.push(
            EditorView.theme({
                '.cm-content': {
                    fontSize: '13px',
                    padding: '8px 0'
                },
                '.cm-placeholder': {
                    color: 'var(--muted-foreground)'
                },
                '&.cm-focused': {
                    outline: 'none'
                }
            })
        )

        return exts
    }, [language])

    return (
        <div className="h-full w-full rounded-md overflow-hidden bg-muted/30 border border-border/50">
            <CodeMirror
                value={value}
                onChange={onChange}
                height="100%"
                width="100%"
                extensions={extensions}
                theme={isDark ? oneDark : 'light'}
                placeholder={placeholder}
                basicSetup={{
                    lineNumbers: false,
                    foldGutter: false,
                    autocompletion: true,
                    highlightActiveLine: false,
                    bracketMatching: true,
                    closeBrackets: true,
                    indentOnInput: true
                }}
                className="h-full text-sm"
            />
        </div>
    )
}

export default TrayCodeEditor
