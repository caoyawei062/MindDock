import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@renderer/provider/ThemeProvider'
import { THEME } from '../../../../constants'
import { useAIConfig } from '@renderer/hooks/useAI'
import { AIProvider } from '@renderer/types/ai'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import ScrollArea from '@renderer/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  Bot,
  Brain,
  Cable,
  CheckCircle2,
  Chrome,
  Folder,
  Globe,
  Loader2,
  MessageSquare,
  Mic,
  Moon,
  Palette,
  Plug,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  WandSparkles,
  Waves,
  Wrench,
  X
} from 'lucide-react'

type SettingsSection =
  | 'general'
  | 'providers'
  | 'projects'
  | 'chat'
  | 'prompts'
  | 'memory'
  | 'mcp'
  | 'skills'
  | 'plugins'
  | 'hooks'
  | 'voice'
  | 'tts'
  | 'people'
  | 'channels'
  | 'web-search'
  | 'chrome-relay'
  | 'ui'

interface ProviderSummary {
  provider: AIProvider
  label: string
  total: number
  enabled: number
  isActive: boolean
}

interface NavItem {
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
  keywords?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: '通用', icon: Settings, keywords: ['theme', 'general'] },
  { id: 'providers', label: '提供商', icon: Bot, keywords: ['model', 'api'] },
  { id: 'projects', label: '项目', icon: Folder },
  { id: 'chat', label: '聊天', icon: MessageSquare },
  { id: 'prompts', label: '快捷提示', icon: Sparkles },
  { id: 'memory', label: '记忆', icon: Brain },
  { id: 'mcp', label: 'MCP 服务', icon: Cable },
  { id: 'skills', label: '技能', icon: Wrench },
  { id: 'plugins', label: 'Plugins', icon: Plug },
  { id: 'hooks', label: '钩子', icon: WandSparkles },
  { id: 'voice', label: '语音', icon: Mic },
  { id: 'tts', label: 'Text-to-Speech', icon: Waves, keywords: ['tts'] },
  { id: 'people', label: 'People', icon: Users },
  { id: 'channels', label: '渠道', icon: Cable },
  { id: 'web-search', label: '网络搜索', icon: Globe },
  { id: 'chrome-relay', label: 'Chrome Relay', icon: Chrome },
  { id: 'ui', label: '用户界面', icon: Palette }
]

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek'
}

function SettingsWindow(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const { models, loading, loadAllModels, updateModel, toggleModel, testModel, error } = useAIConfig()

  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [navSearchQuery, setNavSearchQuery] = useState('')
  const [providerSearchQuery, setProviderSearchQuery] = useState('')
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [baseURLDraft, setBaseURLDraft] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasInconsistentProviderConfig, setHasInconsistentProviderConfig] = useState(false)
  const [testingProvider, setTestingProvider] = useState<AIProvider | null>(null)
  const [providerTestResults, setProviderTestResults] = useState<
    Record<string, { success: boolean; error?: string }>
  >({})

  useEffect(() => {
    loadAllModels()
  }, [loadAllModels])

  const visibleNavItems = useMemo(() => {
    const query = navSearchQuery.trim().toLowerCase()
    if (!query) return NAV_ITEMS
    return NAV_ITEMS.filter((item) => {
      if (item.label.toLowerCase().includes(query)) return true
      return item.keywords?.some((keyword) => keyword.toLowerCase().includes(query))
    })
  }, [navSearchQuery])

  const providerSummaries = useMemo(() => {
    return (Object.keys(PROVIDER_LABELS) as AIProvider[])
      .map((provider) => {
        const providerModels = models.filter((model) => model.provider === provider)
        return {
          provider,
          label: PROVIDER_LABELS[provider],
          total: providerModels.length,
          enabled: providerModels.filter((model) => model.enabled).length,
          isActive: providerModels.some((model) => model.enabled)
        } satisfies ProviderSummary
      })
      .filter((summary) => summary.total > 0)
  }, [models])

  const visibleProviders = useMemo(() => {
    const query = providerSearchQuery.trim().toLowerCase()
    return providerSummaries.filter((summary) => {
      if (!query) return true
      return (
        summary.label.toLowerCase().includes(query) ||
        summary.provider.toLowerCase().includes(query)
      )
    })
  }, [providerSearchQuery, providerSummaries])

  const selectedProviderSummary = useMemo(() => {
    if (!selectedProvider) return null
    return providerSummaries.find((item) => item.provider === selectedProvider) || null
  }, [providerSummaries, selectedProvider])

  const selectedProviderModels = useMemo(() => {
    if (!selectedProvider) return []
    return models
      .filter((model) => model.provider === selectedProvider)
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name))
  }, [models, selectedProvider])

  const visibleModels = useMemo(() => {
    const query = modelSearchQuery.trim().toLowerCase()
    return selectedProviderModels.filter((model) => {
      if (!query) return true
      return model.name.toLowerCase().includes(query) || model.model.toLowerCase().includes(query)
    })
  }, [selectedProviderModels, modelSearchQuery])

  useEffect(() => {
    if (visibleProviders.length === 0) {
      setSelectedProvider(null)
      return
    }

    if (
      !selectedProvider ||
      !visibleProviders.some((provider) => provider.provider === selectedProvider)
    ) {
      setSelectedProvider(visibleProviders[0].provider)
    }
  }, [visibleProviders, selectedProvider])

  useEffect(() => {
    if (!selectedProvider || selectedProviderModels.length === 0) {
      setApiKeyDraft('')
      setBaseURLDraft('')
      setIsDirty(false)
      setHasInconsistentProviderConfig(false)
      return
    }

    const apiKeys = selectedProviderModels.map((model) => model.apiKey || '')
    const baseURLs = selectedProviderModels.map((model) => model.baseURL || '')
    const hasConsistentApiKey = apiKeys.every((key) => key === apiKeys[0])
    const hasConsistentBaseURL = baseURLs.every((url) => url === baseURLs[0])

    setApiKeyDraft(hasConsistentApiKey ? apiKeys[0] : '')
    setBaseURLDraft(hasConsistentBaseURL ? baseURLs[0] : '')
    setHasInconsistentProviderConfig(!hasConsistentApiKey || !hasConsistentBaseURL)
    setIsDirty(false)
  }, [selectedProvider, selectedProviderModels])

  const providerEnabled = (selectedProviderSummary?.enabled || 0) > 0
  const canTestProvider = Boolean(apiKeyDraft.trim()) || selectedProviderModels.some((m) => Boolean(m.apiKey))

  const settingsStatusText = useMemo(() => {
    if (activeSection === 'providers') {
      if (isSaving) return '正在保存提供商配置...'
      if (isDirty) return '提供商配置有未保存更改'
      return '提供商配置已保存'
    }
    return '当前分区配置可继续扩展'
  }, [activeSection, isDirty, isSaving])

  const handleSaveProviderConfig = async (): Promise<boolean> => {
    if (!selectedProvider || selectedProviderModels.length === 0) return false

    setIsSaving(true)
    try {
      const updatePayload = {
        apiKey: apiKeyDraft.trim() || undefined,
        baseURL: baseURLDraft.trim() || undefined
      }

      const results = await Promise.all(
        selectedProviderModels.map((model) => updateModel(model.id, updatePayload))
      )

      if (results.every(Boolean)) {
        setIsDirty(false)
        setHasInconsistentProviderConfig(false)
        return true
      }
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetDraft = () => {
    if (!selectedProvider || selectedProviderModels.length === 0) return
    const apiKeys = selectedProviderModels.map((model) => model.apiKey || '')
    const baseURLs = selectedProviderModels.map((model) => model.baseURL || '')
    setApiKeyDraft(apiKeys.every((key) => key === apiKeys[0]) ? apiKeys[0] : '')
    setBaseURLDraft(baseURLs.every((url) => url === baseURLs[0]) ? baseURLs[0] : '')
    setIsDirty(false)
  }

  const handleToggleProvider = async (enabled: boolean) => {
    if (!selectedProvider || selectedProviderModels.length === 0) return
    await Promise.all(selectedProviderModels.map((model) => toggleModel(model.id, enabled)))
  }

  const handleToggleModel = async (modelId: string, enabled: boolean) => {
    await toggleModel(modelId, enabled)
  }

  const handleTestProvider = async () => {
    if (!selectedProvider || selectedProviderModels.length === 0) return

    if (isDirty) {
      const saved = await handleSaveProviderConfig()
      if (!saved) return
    }

    const targetModel =
      selectedProviderModels.find((model) => model.enabled) || selectedProviderModels[0]
    if (!targetModel) return

    setTestingProvider(selectedProvider)
    const result = await testModel(targetModel.id)
    setProviderTestResults((prev) => ({ ...prev, [selectedProvider]: result }))
    setTestingProvider(null)
  }

  const renderGeneralSection = () => {
    return (
      <ScrollArea className="h-full pr-1">
        <div className="space-y-4 pb-2">
          <section className="rounded-2xl border bg-card p-6">
            <div className="mb-5">
              <h3 className="text-xl font-semibold">外观主题</h3>
              <p className="mt-1 text-sm text-muted-foreground">选择应用主题外观，设置会即时生效。</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <button
                onClick={() => {
                  setTheme(THEME.LIGHT)
                  window.api.changeTheme(THEME.LIGHT)
                }}
                className={cn(
                  'rounded-xl border-2 p-5 text-left transition-colors',
                  theme === 'light' ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                )}
              >
                <div className="flex items-center gap-3">
                  <Sun className="size-5" />
                  <div>
                    <p className="font-medium">浅色模式</p>
                    <p className="text-xs text-muted-foreground">明亮风格</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  setTheme(THEME.DARK)
                  window.api.changeTheme(THEME.DARK)
                }}
                className={cn(
                  'rounded-xl border-2 p-5 text-left transition-colors',
                  theme === 'dark' ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                )}
              >
                <div className="flex items-center gap-3">
                  <Moon className="size-5" />
                  <div>
                    <p className="font-medium">深色模式</p>
                    <p className="text-xs text-muted-foreground">护眼风格</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  setTheme(THEME.SYSTEM)
                  window.api.changeTheme(THEME.SYSTEM)
                }}
                className={cn(
                  'rounded-xl border-2 p-5 text-left transition-colors',
                  theme === 'system' ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                )}
              >
                <div className="flex items-center gap-3">
                  <Settings className="size-5" />
                  <div>
                    <p className="font-medium">跟随系统</p>
                    <p className="text-xs text-muted-foreground">自动切换</p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-dashed p-6">
            <h3 className="text-lg font-semibold">预留配置位</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              后续可在“通用”下继续增加编辑器偏好、快捷键、启动行为等配置。
            </p>
          </section>
        </div>
      </ScrollArea>
    )
  }

  const renderProvidersSection = () => {
    return (
      <div className="h-full min-h-0">
        <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col rounded-2xl border bg-muted/15">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={providerSearchQuery}
                  onChange={(e) => setProviderSearchQuery(e.target.value)}
                  placeholder="搜索提供商..."
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1 p-2">
              {visibleProviders.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">未找到匹配提供商</div>
              ) : (
                <div className="space-y-2">
                  {visibleProviders.map((provider) => (
                    <button
                      key={provider.provider}
                      onClick={() => setSelectedProvider(provider.provider)}
                      className={cn(
                        'w-full rounded-xl border p-3 text-left transition-colors',
                        selectedProvider === provider.provider
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-accent/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{provider.label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {provider.total} 个模型，启用 {provider.enabled} 个
                          </p>
                        </div>
                        <span
                          className={cn(
                            'mt-1 inline-block size-2.5 rounded-full shrink-0',
                            provider.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                          )}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </section>

          <section className="min-h-0 overflow-hidden rounded-2xl border bg-card">
            {!selectedProvider || !selectedProviderSummary ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                请选择一个提供商进行配置
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-semibold">{selectedProviderSummary.label}</h3>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            providerEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {providerEnabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedProviderSummary.total} 个模型，已启用 {selectedProviderSummary.enabled} 个
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={providerEnabled}
                      onClick={() => handleToggleProvider(!providerEnabled)}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        providerEnabled ? 'bg-primary' : 'bg-muted'
                      )}
                    >
                      <span
                        className={cn(
                          'size-5 rounded-full bg-background shadow transition-transform',
                          providerEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                </div>

                <ScrollArea className="min-h-0 flex-1 p-4">
                  <div className="space-y-4">
                    {error ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Provider API Key</label>
                        <Input
                          type="password"
                          value={apiKeyDraft}
                          onChange={(e) => {
                            setApiKeyDraft(e.target.value)
                            setIsDirty(true)
                          }}
                          placeholder="输入 API Key"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Provider Base URL (可选)</label>
                        <Input
                          type="text"
                          value={baseURLDraft}
                          onChange={(e) => {
                            setBaseURLDraft(e.target.value)
                            setIsDirty(true)
                          }}
                          placeholder={
                            selectedProvider === 'openai'
                              ? 'https://api.openai.com/v1'
                              : selectedProvider === 'deepseek'
                                ? 'https://api.deepseek.com'
                                : '默认网关'
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={handleSaveProviderConfig} disabled={!isDirty || isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          '保存配置'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!isDirty || isSaving}
                        onClick={handleResetDraft}
                      >
                        重置
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTestProvider}
                        disabled={testingProvider === selectedProvider || !canTestProvider}
                      >
                        {testingProvider === selectedProvider ? '测试中...' : '测试连接'}
                      </Button>
                    </div>

                    {hasInconsistentProviderConfig ? (
                      <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        当前 Provider 下模型配置不一致，保存后会统一覆盖为当前值。
                      </div>
                    ) : null}

                    {providerTestResults[selectedProvider] ? (
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                          providerTestResults[selectedProvider].success
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        )}
                      >
                        {providerTestResults[selectedProvider].success ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <AlertCircle className="size-4" />
                        )}
                        <span>
                          {providerTestResults[selectedProvider].success
                            ? '连接成功'
                            : providerTestResults[selectedProvider].error || '连接失败'}
                        </span>
                      </div>
                    ) : null}

                    <section className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border">
                      <div className="space-y-3 border-b p-3">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-lg font-semibold">Models</h4>
                          <span className="text-xs text-muted-foreground">
                            显示 {visibleModels.length}/{selectedProviderModels.length}
                          </span>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={modelSearchQuery}
                            onChange={(e) => setModelSearchQuery(e.target.value)}
                            placeholder="搜索 models..."
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <ScrollArea className="min-h-0 flex-1">
                        {loading ? (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            加载模型列表中...
                          </div>
                        ) : visibleModels.length === 0 ? (
                          <div className="py-10 text-center text-sm text-muted-foreground">
                            未找到匹配模型
                          </div>
                        ) : (
                          visibleModels.map((model) => (
                            <div
                              key={model.id}
                              className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{model.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{model.model}</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={model.enabled}
                                onClick={() => handleToggleModel(model.id, !model.enabled)}
                                className={cn(
                                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                  model.enabled ? 'bg-primary' : 'bg-muted'
                                )}
                              >
                                <span
                                  className={cn(
                                    'size-5 rounded-full bg-background shadow transition-transform',
                                    model.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                  )}
                                />
                              </button>
                            </div>
                          ))
                        )}
                      </ScrollArea>
                    </section>
                  </div>
                </ScrollArea>
              </div>
            )}
          </section>
        </div>
      </div>
    )
  }

  const renderPlaceholderSection = (title: string) => {
    return (
      <ScrollArea className="h-full pr-1">
        <section className="rounded-2xl border border-dashed p-8 text-center">
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">该设置分区正在规划中，后续可继续扩展。</p>
        </section>
      </ScrollArea>
    )
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSection()
      case 'providers':
        return renderProvidersSection()
      case 'projects':
        return renderPlaceholderSection('项目')
      case 'chat':
        return renderPlaceholderSection('聊天')
      case 'prompts':
        return renderPlaceholderSection('快捷提示')
      case 'memory':
        return renderPlaceholderSection('记忆')
      case 'mcp':
        return renderPlaceholderSection('MCP 服务')
      case 'skills':
        return renderPlaceholderSection('技能')
      case 'plugins':
        return renderPlaceholderSection('Plugins')
      case 'hooks':
        return renderPlaceholderSection('钩子')
      case 'voice':
        return renderPlaceholderSection('语音')
      case 'tts':
        return renderPlaceholderSection('Text-to-Speech')
      case 'people':
        return renderPlaceholderSection('People')
      case 'channels':
        return renderPlaceholderSection('渠道')
      case 'web-search':
        return renderPlaceholderSection('网络搜索')
      case 'chrome-relay':
        return renderPlaceholderSection('Chrome Relay')
      case 'ui':
        return renderPlaceholderSection('用户界面')
      default:
        return null
    }
  }

  const activeNav = NAV_ITEMS.find((item) => item.id === activeSection)

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="drag h-10 shrink-0 border-b bg-background/90" />
      <div className="grid h-[calc(100%-2.5rem)] grid-cols-[280px_1fr]">
        <aside className="flex min-h-0 flex-col border-r bg-muted/25">
          <div className="border-b px-4 py-4">
            <h1 className="text-xl font-semibold">设置</h1>
          </div>
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={navSearchQuery}
                onChange={(e) => setNavSearchQuery(e.target.value)}
                placeholder="搜索设置项..."
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 p-2">
            {visibleNavItems.length === 0 ? (
              <div className="px-2 py-8 text-sm text-muted-foreground">未找到匹配设置项</div>
            ) : (
              <div className="space-y-1">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                        activeSection === item.id
                          ? 'border-primary/25 bg-primary/10 text-foreground'
                          : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </aside>

        <main className="flex min-h-0 flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-2">
              {activeNav ? <activeNav.icon className="size-5 text-muted-foreground" /> : null}
              <h2 className="text-2xl font-semibold">{activeNav?.label || '设置'}</h2>
            </div>
            {activeSection === 'providers' && isDirty ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">未保存</span>
            ) : null}
          </header>
          <div className="min-h-0 flex-1 overflow-hidden p-6">{renderContent()}</div>
          <footer className="flex items-center justify-between border-t px-6 py-3">
            <p className="text-sm text-muted-foreground">{settingsStatusText}</p>
            <div className="flex items-center gap-2">
              {activeSection === 'providers' ? (
                <Button size="sm" onClick={handleSaveProviderConfig} disabled={!isDirty || isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存'
                  )}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => window.close()}>
                <X className="size-4" />
                关闭
              </Button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default SettingsWindow
