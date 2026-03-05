import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '@renderer/provider/ThemeProvider'
import { THEME } from '../../../../../constants'
import { useAIConfig } from '@renderer/hooks/useAI'
import { AIProvider } from '@renderer/types/ai'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  Settings,
  Sun,
  Moon,
  Sparkles,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

interface AppSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek'
}

interface ProviderSummary {
  provider: AIProvider
  label: string
  total: number
  enabled: number
  isActive: boolean
}

export function AppSettings({ open, onOpenChange }: AppSettingsProps) {
  const { theme, setTheme } = useTheme()
  const { models, loadAllModels, updateModel, toggleModel, testModel, error } = useAIConfig()
  const [testingProvider, setTestingProvider] = useState<AIProvider | null>(null)
  const [providerTestResults, setProviderTestResults] = useState<
    Record<string, { success: boolean; error?: string }>
  >({})
  const [providerSearchQuery, setProviderSearchQuery] = useState('')
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [baseURLDraft, setBaseURLDraft] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasInconsistentProviderConfig, setHasInconsistentProviderConfig] = useState(false)

  useEffect(() => {
    if (open) {
      loadAllModels()
    }
  }, [open, loadAllModels])

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

  const handleSaveProviderConfig = async (): Promise<boolean> => {
    if (!selectedProvider || selectedProviderModels.length === 0) return false

    setIsSaving(true)
    const updatePayload = {
      apiKey: apiKeyDraft.trim() || undefined,
      baseURL: baseURLDraft.trim() || undefined
    }

    const results = await Promise.all(
      selectedProviderModels.map((model) => updateModel(model.id, updatePayload))
    )
    setIsSaving(false)

    if (results.every(Boolean)) {
      setIsDirty(false)
      setHasInconsistentProviderConfig(false)
      return true
    }
    return false
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            设置
          </DialogTitle>
          <DialogDescription>配置应用主题和 AI 模型</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <Tabs defaultValue="general" className="w-full flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              常规
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI 模型
            </TabsTrigger>
          </TabsList>

          {/* 常规设置 */}
          <TabsContent value="general" className="space-y-4">
            <div className="rounded-lg border p-4 space-y-4">
              <div>
                <p className="font-medium">外观主题</p>
                <p className="text-sm text-muted-foreground mt-1">选择应用主题外观</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    setTheme(THEME.LIGHT)
                    window.api.changeTheme(THEME.LIGHT)
                  }}
                  className={`p-6 rounded-lg border-2 transition-colors ${
                    theme === 'light'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Sun className="w-8 h-8" />
                    <div className="font-medium">浅色模式</div>
                    <div className="text-xs text-muted-foreground">明亮清爽</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setTheme(THEME.DARK)
                    window.api.changeTheme(THEME.DARK)
                  }}
                  className={`p-6 rounded-lg border-2 transition-colors ${
                    theme === 'dark'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Moon className="w-8 h-8" />
                    <div className="font-medium">深色模式</div>
                    <div className="text-xs text-muted-foreground">护眼舒适</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setTheme(THEME.SYSTEM)
                    window.api.changeTheme(THEME.SYSTEM)
                  }}
                  className={`p-6 rounded-lg border-2 transition-colors ${
                    theme === 'system'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Settings className="w-8 h-8" />
                    <div className="font-medium">跟随系统</div>
                    <div className="text-xs text-muted-foreground">自动切换</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              后续可在“常规”下扩展更多配置项，如编辑器偏好、快捷键、启动行为等。
            </div>
          </TabsContent>

          {/* AI 模型设置 */}
          <TabsContent value="ai" className="space-y-4 h-[56vh] min-h-[420px] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-0">
              {/* 左：Provider 列表 */}
              <div className="lg:col-span-4 border rounded-lg overflow-hidden flex flex-col bg-muted/20 min-h-0">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={providerSearchQuery}
                      onChange={(e) => setProviderSearchQuery(e.target.value)}
                      placeholder="搜索提供商..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="p-2 space-y-2">
                    {visibleProviders.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-10">
                        未找到匹配提供商
                      </div>
                    ) : (
                      visibleProviders.map((provider) => (
                        <button
                          key={provider.provider}
                          onClick={() => setSelectedProvider(provider.provider)}
                          className={cn(
                            'w-full text-left border rounded-lg p-3 transition-colors',
                            selectedProvider === provider.provider
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-accent/40'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{provider.label}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {provider.total} 个模型
                              </p>
                            </div>
                            <span
                              className={cn(
                                'text-[10px] px-2 py-0.5 rounded-full shrink-0',
                                provider.isActive
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {provider.isActive ? `${provider.enabled} 启用` : '未启用'}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 右：Provider 配置 + 模型列表 */}
              <div className="lg:col-span-8 border rounded-lg overflow-hidden min-h-0">
                <div className="h-full overflow-y-auto p-4">
                  {!selectedProvider || !selectedProviderSummary ? (
                    <div className="h-full min-h-[320px] flex items-center justify-center text-sm text-muted-foreground">
                      请选择一个提供商进行配置
                    </div>
                  ) : (
                    <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">{selectedProviderSummary.label}</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedProviderSummary.total} 个模型，已启用{' '}
                          {selectedProviderSummary.enabled} 个
                        </p>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {selectedProvider}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleProvider(false)}
                          disabled={selectedProviderSummary.enabled === 0}
                        >
                          全部禁用
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleToggleProvider(true)}
                          disabled={selectedProviderSummary.enabled === selectedProviderSummary.total}
                        >
                          全部启用
                        </Button>
                      </div>
                    </div>

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

                    {(selectedProvider === 'openai' || selectedProvider === 'deepseek') && (
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
                              : 'https://api.deepseek.com'
                          }
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={handleSaveProviderConfig}
                        disabled={!isDirty || isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            保存中...
                          </>
                        ) : isDirty ? (
                          '保存配置'
                        ) : (
                          '已保存'
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
                        disabled={testingProvider === selectedProvider || !apiKeyDraft.trim()}
                      >
                        {testingProvider === selectedProvider ? '测试中...' : '测试连接'}
                      </Button>
                    </div>

                    {hasInconsistentProviderConfig && (
                      <div className="text-xs rounded-md px-3 py-2 bg-amber-50 text-amber-700">
                        当前 Provider 下模型配置不一致，保存后会统一覆盖为当前值。
                      </div>
                    )}

                    {providerTestResults[selectedProvider] && (
                      <div
                        className={cn(
                          'flex items-center gap-2 text-sm rounded-md px-3 py-2',
                          providerTestResults[selectedProvider].success
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        )}
                      >
                        {providerTestResults[selectedProvider].success ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                        <span>
                          {providerTestResults[selectedProvider].success
                            ? '连接成功'
                            : providerTestResults[selectedProvider].error || '连接失败'}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Models</p>
                        <span className="text-xs text-muted-foreground">
                          显示 {visibleModels.length}/{selectedProviderModels.length}
                        </span>
                      </div>
                      <div className="relative">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          value={modelSearchQuery}
                          onChange={(e) => setModelSearchQuery(e.target.value)}
                          placeholder="搜索 models..."
                          className="pl-9"
                        />
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        {visibleModels.length === 0 ? (
                          <div className="text-sm text-muted-foreground text-center py-8">
                            未找到匹配模型
                          </div>
                        ) : (
                          visibleModels.map((model) => (
                            <div
                              key={model.id}
                              className="px-3 py-2.5 border-b last:border-b-0 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="font-medium truncate">{model.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{model.model}</p>
                              </div>
                              <Button
                                size="sm"
                                variant={model.enabled ? 'default' : 'outline'}
                                onClick={() => handleToggleModel(model.id, !model.enabled)}
                              >
                                {model.enabled ? '已启用' : '已禁用'}
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
