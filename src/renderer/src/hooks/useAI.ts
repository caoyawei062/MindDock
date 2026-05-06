import { useState, useCallback, useRef, useEffect, type RefObject } from 'react'
import {
  AIModelConfig,
  AIMessage,
  AICompletionOptions
} from '../types/ai'

export interface UseAIStreamResult {
  isStreaming: boolean
  error: string | null
  startStream: (
    modelId: string,
    messages: AIMessage[],
    options?: AICompletionOptions
  ) => Promise<void>
  stopStream: () => void
  reset: () => void
}

export function useAIStream(
  onChunk: (chunk: string) => void,
  onComplete?: () => void
): UseAIStreamResult {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string>('')
  const cleanupRef = useRef<(() => void)[]>([])

  const onChunkRef: RefObject<(chunk: string) => void> = useRef(onChunk)
  const onCompleteRef: RefObject<(() => void) | undefined> = useRef(onComplete)

  useEffect(() => {
    onChunkRef.current = onChunk
    onCompleteRef.current = onComplete
  }, [onChunk, onComplete])

  const stopStream = useCallback(() => {
    if (sessionIdRef.current) {
      void window.api.aiCancelStream(sessionIdRef.current)
      sessionIdRef.current = ''
    }
    cleanupRef.current.forEach((cleanup) => cleanup())
    cleanupRef.current = []
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    setError(null)
  }, [])

  const startStream = useCallback(
    async (modelId: string, messages: AIMessage[], options: Partial<AICompletionOptions> = {}) => {
      try {
        setIsStreaming(true)
        setError(null)

        const sessionId = `stream-${Date.now()}-${Math.random()}`
        sessionIdRef.current = sessionId

        const unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, (chunk) => {
          onChunkRef.current(chunk)
        })
        const unsubscribeComplete = window.api.aiOnStreamComplete(sessionId, () => {
          onCompleteRef.current?.()
          sessionIdRef.current = ''
          setIsStreaming(false)
        })
        const unsubscribeError = window.api.aiOnStreamError(sessionId, (errorMessage) => {
          setError(errorMessage)
          sessionIdRef.current = ''
          setIsStreaming(false)
        })

        cleanupRef.current = [unsubscribeChunk, unsubscribeComplete, unsubscribeError]

        const result = await window.api.aiStreamCompletion(modelId, messages, options, sessionId)

        if (!result.success) {
          setError(result.error || 'Stream failed')
          sessionIdRef.current = ''
          setIsStreaming(false)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        sessionIdRef.current = ''
        setIsStreaming(false)
      }
    },
    []
  )

  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [stopStream])

  return {
    isStreaming,
    error,
    startStream,
    stopStream,
    reset
  }
}

export function useAIConfig(): {
  models: AIModelConfig[]
  loading: boolean
  error: string | null
  loadAllModels: () => Promise<void>
  loadEnabledModels: () => Promise<void>
  updateModel: (id: string, updates: Partial<AIModelConfig>) => Promise<AIModelConfig | null>
  toggleModel: (id: string, enabled: boolean) => Promise<AIModelConfig | null>
  testModel: (modelId: string) => Promise<{ success: boolean; error?: string }>
} {
  const [models, setModels] = useState<AIModelConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAllModels = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.api.aiGetAllModels()
      setModels(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load models'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEnabledModels = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.api.aiGetEnabledModels()
      setModels(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load models'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateModel = useCallback(async (id: string, updates: Partial<AIModelConfig>) => {
    try {
      setError(null)
      const result = await window.api.aiUpdateModel(id, updates)
      if (result) {
        setModels((prev) => prev.map((m) => (m.id === id ? result : m)))
      }
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update model'
      setError(errorMessage)
      return null
    }
  }, [])

  const toggleModel = useCallback(async (id: string, enabled: boolean) => {
    try {
      setError(null)
      const result = await window.api.aiToggleModel(id, enabled)
      if (result) {
        setModels((prev) => prev.map((m) => (m.id === id ? result : m)))
      }
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle model'
      setError(errorMessage)
      return null
    }
  }, [])

  const testModel = useCallback(async (modelId: string) => {
    try {
      setError(null)
      const result = await window.api.aiTestModel(modelId)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test model'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [])

  return {
    models,
    loading,
    error,
    loadAllModels,
    loadEnabledModels,
    updateModel,
    toggleModel,
    testModel
  }
}
