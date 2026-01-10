// CodeMirror 配置类型
export interface CodeMirrorConfig {
  lineNumbers: boolean
  foldGutter: boolean
  autocompletion: boolean
  highlightActiveLine: boolean
  bracketMatching: boolean
  lineWrapping: boolean
}

// 默认 CodeMirror 配置
export const DEFAULT_CODEMIRROR_CONFIG: CodeMirrorConfig = {
  lineNumbers: true,
  foldGutter: true,
  autocompletion: true,
  highlightActiveLine: true,
  bracketMatching: true,
  lineWrapping: false
}

// 语言配置类型
export interface LanguageConfig {
  id: string
  name: string
  icon?: string
}

// 默认语言列表
export const DEFAULT_LANGUAGES: LanguageConfig[] = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'python', name: 'Python' },
  { id: 'java', name: 'Java' },
  { id: 'go', name: 'Go' },
  { id: 'rust', name: 'Rust' },
  { id: 'c', name: 'C' },
  { id: 'cpp', name: 'C++' },
  { id: 'csharp', name: 'C#' },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'json', name: 'JSON' },
  { id: 'markdown', name: 'Markdown' },
  { id: 'sql', name: 'SQL' },
  { id: 'shell', name: 'Shell' }
]

// 编辑模式类型
export type EditorMode = 'word' | 'code'
