import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { FileText, Folder, SearchIcon, Settings, Home, ChevronDown, Plus, Save } from 'lucide-react'
import ScrollArea from '../ui/scroll-area'
import TrayCodeEditor from './TrayCodeEditor'
import { DEFAULT_LANGUAGES } from './Edit/types'

interface CodeSnippet {
  id: string
  title: string
  code: string
  language: string
  updatedAt?: string
}

type TabType = 'browse' | 'create'

const TrayWindow: React.FC = () => {
  const [snippets, setSnippets] = useState<CodeSnippet[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('browse')
  const [isLoading, setIsLoading] = useState(false)

  // 创建表单状态
  const [newTitle, setNewTitle] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newLanguage, setNewLanguage] = useState('javascript')
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)

  // 加载代码片段
  const loadSnippets = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.snippetsGetForTray()
      setSnippets(result)
    } catch (error) {
      console.error('Failed to load snippets:', error)
    }
  }, [])

  useEffect(() => {
    // 初始加载
    loadSnippets()

    // 监听来自主进程的代码片段数据（保持兼容）
    const unsubscribe = window.api.onTraySnippets((data) => {
      setSnippets(data)
    })
    return () => unsubscribe()
  }, [loadSnippets])

  // 过滤搜索结果
  const filteredSnippets = useMemo(() => {
    if (!searchQuery.trim()) return snippets
    const query = searchQuery.toLowerCase()
    return snippets.filter(
      (s) => s.title.toLowerCase().includes(query) || s.language.toLowerCase().includes(query)
    )
  }, [snippets, searchQuery])

  const handleItemClick = (snippet: CodeSnippet): void => {
    setSelectedId(snippet.id)
    window.api.copySnippet(snippet.code, snippet.title)
  }

  const handleOpenMain = (): void => {
    window.api.openMainWindow()
  }

  const handleOpenSettings = (): void => {
    window.api.openSettingsWindow()
  }

  const handleSaveSnippet = async (): Promise<void> => {
    if (!newTitle.trim() || !newCode.trim() || isLoading) return

    setIsLoading(true)
    try {
      // 保存到数据库
      await window.api.notesCreate({
        title: newTitle,
        content: newCode,
        type: 'snippet',
        language: newLanguage
      })

      // 重新加载列表
      await loadSnippets()

      // 清空表单并切换到浏览
      setNewTitle('')
      setNewCode('')
      setNewLanguage('javascript')
      setActiveTab('browse')
    } catch (error) {
      console.error('Failed to save snippet:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedLanguage = DEFAULT_LANGUAGES.find((l) => l.id === newLanguage)

  // 渲染浏览标签页
  const renderBrowseTab = (): React.JSX.Element => (
    <>
      {/* 搜索框 */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 border border-border/50">
          <SearchIcon size={14} className="text-muted-foreground" />
          <ChevronDown size={12} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      {/* 列表区域 */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2">
          {filteredSnippets.length > 0 ? (
            filteredSnippets.map((snippet) => (
              <div
                key={snippet.id}
                onClick={() => handleItemClick(snippet)}
                className={`group px-3 py-2 rounded-md cursor-pointer transition-all duration-150 mb-0.5 ${
                  selectedId === snippet.id ? 'bg-blue-500 text-white' : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium text-sm truncate">{snippet.title}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1.5">
                    <Folder
                      size={12}
                      className={
                        selectedId === snippet.id ? 'text-white/80' : 'text-muted-foreground'
                      }
                    />
                    <span
                      className={`text-xs ${selectedId === snippet.id ? 'text-white/80' : 'text-muted-foreground'}`}
                    >
                      {snippet.language}
                    </span>
                  </div>
                  <span
                    className={`text-xs ${selectedId === snippet.id ? 'text-white/80' : 'text-muted-foreground'}`}
                  >
                    {snippet.updatedAt}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Folder size={32} className="mb-2 opacity-50" />
              <span className="text-sm">{searchQuery ? '未找到匹配项' : '暂无代码片段'}</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  )

  // 渲染创建标签页
  const renderCreateTab = (): React.JSX.Element => (
    <div className="flex-1 flex flex-col min-h-0 px-3 py-2 gap-2">
      {/* 标题输入 */}
      <input
        type="text"
        placeholder="标题..."
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-md bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
      />

      {/* 语言选择 */}
      <div className="relative">
        <button
          onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md bg-muted/50 border border-border/50 text-foreground hover:bg-muted transition-colors"
        >
          <span>{selectedLanguage?.name || 'JavaScript'}</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>

        {showLanguageDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-32 overflow-y-auto">
            {DEFAULT_LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => {
                  setNewLanguage(lang.id)
                  setShowLanguageDropdown(false)
                }}
                className={`w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors ${
                  newLanguage === lang.id ? 'bg-accent text-foreground' : 'text-muted-foreground'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 代码编辑器 */}
      <div className="flex-1 min-h-0">
        <TrayCodeEditor
          value={newCode}
          onChange={setNewCode}
          language={newLanguage}
          placeholder="输入代码..."
        />
      </div>

      {/* 保存按钮 */}
      <button
        onClick={handleSaveSnippet}
        disabled={!newTitle.trim() || !newCode.trim() || isLoading}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save size={14} />
        {isLoading ? '保存中...' : '保存'}
      </button>
    </div>
  )

  return (
    <div className="w-full h-screen bg-background flex flex-col rounded-xl border border-border/50 shadow-2xl overflow-hidden">
      {/* 顶部 Tab 栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'browse'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText size={14} />
            浏览
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'create'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Plus size={14} />
            创建
          </button>
        </div>
        <button
          onClick={handleOpenMain}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Home size={16} />
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === 'browse' ? renderBrowseTab() : renderCreateTab()}

      {/* 底部操作栏 */}
      <div className="flex items-center px-3 py-2 border-t border-border flex-shrink-0">
        <button
          onClick={handleOpenSettings}
          className="flex items-center gap-1.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="打开设置"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  )
}

export default TrayWindow
