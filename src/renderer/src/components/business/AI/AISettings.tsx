import { useEffect, useState } from 'react'
import { useAIConfig } from '@renderer/hooks/useAI'
import { AIModelConfig, AIProvider } from '@renderer/types/ai'
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

interface AISettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Provider names for reference
// const PROVIDER_NAMES: Record<AIProvider, string> = {
//   openai: 'OpenAI',
//   anthropic: 'Anthropic',
//   google: 'Google',
//   deepseek: 'DeepSeek'
// }

export function AISettings({ open, onOpenChange }: AISettingsProps) {
  const { models, loadAllModels, updateModel, toggleModel, testModel, error } =
    useAIConfig()
  const [testingModel, setTestingModel] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({})

  useEffect(() => {
    if (open) {
      loadAllModels()
    }
  }, [open, loadAllModels])

  const handleApiKeyChange = async (modelId: string, apiKey: string) => {
    await updateModel(modelId, { apiKey })
  }

  const handleBaseURLChange = async (modelId: string, baseURL: string) => {
    await updateModel(modelId, { baseURL })
  }

  const handleToggleModel = async (modelId: string, enabled: boolean) => {
    await toggleModel(modelId, enabled)
  }

  const handleTestModel = async (modelId: string) => {
    setTestingModel(modelId)
    const result = await testModel(modelId)
    setTestResults((prev) => ({ ...prev, [modelId]: result }))
    setTestingModel(null)
  }

  const groupedModels = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = []
    }
    acc[model.provider].push(model)
    return acc
  }, {} as Record<AIProvider, AIModelConfig[]>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI 设置</DialogTitle>
          <DialogDescription>
            配置 AI 模型提供商和 API 密钥。您的密钥仅存储在本地。
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <Tabs defaultValue="openai" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="openai">OpenAI</TabsTrigger>
            <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
            <TabsTrigger value="google">Google</TabsTrigger>
            <TabsTrigger value="deepseek">DeepSeek</TabsTrigger>
          </TabsList>

          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <TabsContent key={provider} value={provider} className="space-y-4">
              <div className="space-y-4">
                {providerModels.map((model) => (
                  <div key={model.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{model.name}</h3>
                        <p className="text-sm text-muted-foreground">{model.model}</p>
                      </div>
                      <Button
                        variant={model.enabled ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleModel(model.id, !model.enabled)}
                      >
                        {model.enabled ? '已启用' : '已禁用'}
                      </Button>
                    </div>

                    {model.enabled && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">API Key</label>
                          <Input
                            type="password"
                            placeholder="输入 API Key"
                            defaultValue={model.apiKey || ''}
                            onChange={(e) => handleApiKeyChange(model.id, e.target.value)}
                          />
                        </div>

                        {model.provider === 'openai' && (
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Base URL (可选)</label>
                            <Input
                              type="text"
                              placeholder="https://api.openai.com/v1"
                              defaultValue={model.baseURL || ''}
                              onChange={(e) => handleBaseURLChange(model.id, e.target.value)}
                            />
                          </div>
                        )}

                        {model.provider === 'deepseek' && (
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Base URL (可选)</label>
                            <Input
                              type="text"
                              placeholder="https://api.deepseek.com"
                              defaultValue={model.baseURL || ''}
                              onChange={(e) => handleBaseURLChange(model.id, e.target.value)}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestModel(model.id)}
                            disabled={testingModel === model.id || !model.apiKey}
                          >
                            {testingModel === model.id ? '测试中...' : '测试连接'}
                          </Button>

                          {testResults[model.id] && (
                            <span
                              className={
                                testResults[model.id].success
                                  ? 'text-green-600 text-sm'
                                  : 'text-red-600 text-sm'
                              }
                            >
                              {testResults[model.id].success
                                ? '连接成功'
                                : testResults[model.id].error || '连接失败'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
