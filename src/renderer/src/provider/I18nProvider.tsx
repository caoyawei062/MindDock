import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from 'date-fns'
import { enUS, ja, ru, zhCN } from 'date-fns/locale'
import { AppLocale, messages } from '@renderer/i18n/messages'

const DEFAULT_STORAGE_KEY = 'minddock-locale'
const LOCALE_BROADCAST_CHANNEL = 'minddock-locale-sync'

interface I18nProviderProps {
  children: React.ReactNode
  defaultLocale?: AppLocale
  storageKey?: string
}

interface I18nContextValue {
  locale: AppLocale
  localeTag: string
  dateFnsLocale: Locale
  setLocale: (locale: AppLocale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  formatNumber: (value: number) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

const detectLocale = (): AppLocale => {
  if (typeof navigator === 'undefined') return 'zh-CN'
  const language = navigator.language.toLowerCase()
  if (language.startsWith('zh')) return 'zh-CN'
  if (language.startsWith('ja')) return 'ja-JP'
  if (language.startsWith('ru')) return 'ru-RU'
  return 'en-US'
}

const isAppLocale = (value: string): value is AppLocale => {
  return value === 'zh-CN' || value === 'en-US' || value === 'ja-JP' || value === 'ru-RU'
}

const interpolate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) return template

  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, String(value))
  }, template)
}

export function I18nProvider({
  children,
  defaultLocale = 'zh-CN',
  storageKey = DEFAULT_STORAGE_KEY
}: I18nProviderProps): React.JSX.Element {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    const stored = localStorage.getItem(storageKey) as AppLocale | null
    return stored || detectLocale() || defaultLocale
  })

  useEffect(() => {
    window.document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== storageKey || !event.newValue || !isAppLocale(event.newValue)) return
      setLocaleState(event.newValue)
    }

    window.addEventListener('storage', handleStorage)

    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(LOCALE_BROADCAST_CHANNEL)
      channelRef.current = channel
      channel.onmessage = (event: MessageEvent<string>): void => {
        if (!isAppLocale(event.data)) return
        localStorage.setItem(storageKey, event.data)
        setLocaleState(event.data)
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorage)
      channelRef.current?.close()
      channelRef.current = null
    }
  }, [storageKey])

  const value = useMemo<I18nContextValue>(() => {
    const localeTag = locale
    const dateFnsLocale =
      locale === 'zh-CN' ? zhCN : locale === 'ja-JP' ? ja : locale === 'ru-RU' ? ru : enUS

    return {
      locale,
      localeTag,
      dateFnsLocale,
      setLocale: (nextLocale: AppLocale) => {
        if (nextLocale === locale) return
        localStorage.setItem(storageKey, nextLocale)
        setLocaleState(nextLocale)
        channelRef.current?.postMessage(nextLocale)
      },
      t: (key: string, params?: Record<string, string | number>) => {
        const template = messages[locale][key] || messages['zh-CN'][key] || key
        return interpolate(template, params)
      },
      formatNumber: (value: number) => value.toLocaleString(localeTag)
    }
  }, [locale, storageKey])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }

  return context
}
