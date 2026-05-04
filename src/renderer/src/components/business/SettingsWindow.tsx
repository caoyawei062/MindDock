import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@renderer/provider/ThemeProvider'
import { THEME } from '../../../../constants'
import { useAIConfig } from '@renderer/hooks/useAI'
import { AIProvider } from '@renderer/types/ai'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import ScrollArea from '@renderer/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { AppLocale } from '@renderer/i18n/messages'
import { useI18n } from '@renderer/provider/I18nProvider'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  Languages,
  Moon,
  Search,
  Settings,
  Sun,
  X
} from 'lucide-react'

type SettingsSection = 'general' | 'providers'

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

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek'
}

function SettingsWindow(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const { locale, setLocale, t } = useI18n()
  const { models, loading, loadAllModels, updateModel, toggleModel, testModel, error } =
    useAIConfig()

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

  const navItems = useMemo<NavItem[]>(
    () => [
      {
        id: 'general',
        label: t('settings.nav.general'),
        icon: Settings,
        keywords: ['theme', 'general']
      },
      {
        id: 'providers',
        label: t('settings.nav.providers'),
        icon: Bot,
        keywords: ['model', 'api', 'provider']
      }
    ],
    [t]
  )

  useEffect(() => {
    loadAllModels()
  }, [loadAllModels])

  const visibleNavItems = useMemo(() => {
    const query = navSearchQuery.trim().toLowerCase()
    if (!query) return navItems
    return navItems.filter((item) => {
      if (item.label.toLowerCase().includes(query)) return true
      return item.keywords?.some((keyword) => keyword.toLowerCase().includes(query))
    })
  }, [navItems, navSearchQuery])

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
  const canTestProvider =
    Boolean(apiKeyDraft.trim()) || selectedProviderModels.some((m) => Boolean(m.apiKey))

  const settingsStatusText = useMemo(() => {
    if (activeSection === 'providers') {
      if (isSaving) return t('settings.status.providers.saving')
      if (isDirty) return t('settings.status.providers.dirty')
      return t('settings.status.providers.clean')
    }
    return t('settings.status.general')
  }, [activeSection, isDirty, isSaving, t])

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

  const handleResetDraft = (): void => {
    if (!selectedProvider || selectedProviderModels.length === 0) return
    const apiKeys = selectedProviderModels.map((model) => model.apiKey || '')
    const baseURLs = selectedProviderModels.map((model) => model.baseURL || '')
    setApiKeyDraft(apiKeys.every((key) => key === apiKeys[0]) ? apiKeys[0] : '')
    setBaseURLDraft(baseURLs.every((url) => url === baseURLs[0]) ? baseURLs[0] : '')
    setIsDirty(false)
  }

  const handleToggleProvider = async (enabled: boolean): Promise<void> => {
    if (!selectedProvider || selectedProviderModels.length === 0) return
    await Promise.all(selectedProviderModels.map((model) => toggleModel(model.id, enabled)))
  }

  const handleToggleModel = async (modelId: string, enabled: boolean): Promise<void> => {
    await toggleModel(modelId, enabled)
  }

  const handleTestProvider = async (): Promise<void> => {
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

  const renderGeneralSection = (): React.JSX.Element => {
    return (
      <ScrollArea className="h-full pr-1">
        <div className="space-y-4 pb-2">
          <section className="rounded-2xl border bg-card p-6">
            <div className="mb-5">
              <h3 className="text-xl font-semibold">{t('settings.general.theme.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('settings.general.theme.description')}
              </p>
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
                    <p className="font-medium">{t('settings.general.theme.light')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.general.theme.lightDesc')}
                    </p>
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
                    <p className="font-medium">{t('settings.general.theme.dark')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.general.theme.darkDesc')}
                    </p>
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
                    <p className="font-medium">{t('settings.general.theme.system')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.general.theme.systemDesc')}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6">
            <div className="mb-5">
              <h3 className="text-xl font-semibold">{t('settings.general.language.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('settings.general.language.description')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  { id: 'zh-CN', badge: '简' },
                  { id: 'en-US', badge: 'EN' },
                  { id: 'ja-JP', badge: '日' },
                  { id: 'ru-RU', badge: 'RU' }
                ] satisfies Array<{ id: AppLocale; badge: string }>
              ).map((option) => {
                const selected = locale === option.id

                return (
                  <button
                    key={option.id}
                    onClick={() => setLocale(option.id)}
                    className={cn(
                      'rounded-xl border-2 p-5 text-left transition-colors',
                      selected ? 'border-primary bg-primary/10 shadow-sm' : 'hover:bg-accent'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                            selected
                              ? 'border-primary/30 bg-primary/15 text-primary'
                              : 'border-border bg-muted text-muted-foreground'
                          )}
                        >
                          {option.badge}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Languages className="size-4 text-primary" />
                            <p className="font-medium">
                              {t(`settings.general.language.${option.id}`)}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{option.id}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t(`settings.general.language.${option.id}Hint`)}
                          </p>
                        </div>
                      </div>
                      {selected ? <CheckCircle2 className="mt-0.5 size-4 text-primary" /> : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-dashed p-6">
            <h3 className="text-lg font-semibold">{t('settings.general.scope.title')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('settings.general.scope.description')}
            </p>
          </section>
        </div>
      </ScrollArea>
    )
  }

  const renderProvidersSection = (): React.JSX.Element => {
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
                  placeholder={t('settings.providers.searchPlaceholder')}
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1 p-2">
              {visibleProviders.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {t('settings.providers.noMatches')}
                </div>
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
                            {t('settings.providers.modelsSummary', {
                              total: provider.total,
                              enabled: provider.enabled
                            })}
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
                {t('settings.providers.selectPrompt')}
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
                            providerEnabled
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {providerEnabled ? t('common.active') : t('common.inactive')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('settings.providers.modelsSummary', {
                          total: selectedProviderSummary.total,
                          enabled: selectedProviderSummary.enabled
                        })}
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
                        <label className="text-sm font-medium">
                          {t('settings.providers.apiKey')}
                        </label>
                        <Input
                          type="password"
                          value={apiKeyDraft}
                          onChange={(e) => {
                            setApiKeyDraft(e.target.value)
                            setIsDirty(true)
                          }}
                          placeholder={t('settings.providers.apiKey')}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          {t('settings.providers.baseUrl')}
                        </label>
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
                                : t('settings.providers.defaultGateway')
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveProviderConfig}
                        disabled={!isDirty || isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            {t('settings.providers.saving')}
                          </>
                        ) : (
                          t('settings.providers.saveConfig')
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!isDirty || isSaving}
                        onClick={handleResetDraft}
                      >
                        {t('common.reset')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTestProvider}
                        disabled={testingProvider === selectedProvider || !canTestProvider}
                      >
                        {testingProvider === selectedProvider
                          ? t('settings.providers.testing')
                          : t('settings.providers.testConnection')}
                      </Button>
                    </div>

                    {hasInconsistentProviderConfig ? (
                      <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        {t('settings.providers.inconsistentConfig')}
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
                            ? t('settings.providers.connectionSuccess')
                            : providerTestResults[selectedProvider].error ||
                              t('settings.providers.connectionFailed')}
                        </span>
                      </div>
                    ) : null}

                    <section className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border">
                      <div className="space-y-3 border-b p-3">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-lg font-semibold">
                            {t('settings.providers.modelsTitle')}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {t('settings.providers.modelsVisible', {
                              visible: visibleModels.length,
                              total: selectedProviderModels.length
                            })}
                          </span>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={modelSearchQuery}
                            onChange={(e) => setModelSearchQuery(e.target.value)}
                            placeholder={t('settings.providers.modelsSearchPlaceholder')}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <ScrollArea className="min-h-0 flex-1">
                        {loading ? (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            {t('settings.providers.loadingModels')}
                          </div>
                        ) : visibleModels.length === 0 ? (
                          <div className="py-10 text-center text-sm text-muted-foreground">
                            {t('settings.providers.noMatchingModels')}
                          </div>
                        ) : (
                          visibleModels.map((model) => (
                            <div
                              key={model.id}
                              className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{model.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {model.model}
                                </p>
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

  const renderContent = (): React.JSX.Element | null => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSection()
      case 'providers':
        return renderProvidersSection()
      default:
        return null
    }
  }

  const activeNav = navItems.find((item) => item.id === activeSection)

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="drag h-10 shrink-0 border-b bg-background/90" />
      <div className="grid h-[calc(100%-2.5rem)] grid-cols-[280px_1fr]">
        <aside className="flex min-h-0 flex-col border-r bg-muted/25">
          <div className="border-b px-4 py-4">
            <h1 className="text-xl font-semibold">{t('settings.title')}</h1>
          </div>
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={navSearchQuery}
                onChange={(e) => setNavSearchQuery(e.target.value)}
                placeholder={t('settings.searchPlaceholder')}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 p-2">
            {visibleNavItems.length === 0 ? (
              <div className="px-2 py-8 text-sm text-muted-foreground">
                {t('settings.noMatchingSettings')}
              </div>
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
              <h2 className="text-2xl font-semibold">{activeNav?.label || t('settings.title')}</h2>
            </div>
            {activeSection === 'providers' && isDirty ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">
                {t('settings.unsaved')}
              </span>
            ) : null}
          </header>
          <div className="min-h-0 flex-1 overflow-hidden p-6">{renderContent()}</div>
          <footer className="flex items-center justify-between border-t px-6 py-3">
            <p className="text-sm text-muted-foreground">{settingsStatusText}</p>
            <div className="flex items-center gap-2">
              {activeSection === 'providers' ? (
                <Button
                  size="sm"
                  onClick={handleSaveProviderConfig}
                  disabled={!isDirty || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('settings.providers.saving')}
                    </>
                  ) : (
                    t('common.save')
                  )}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => window.close()}>
                <X className="size-4" />
                {t('common.close')}
              </Button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default SettingsWindow
