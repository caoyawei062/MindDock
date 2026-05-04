import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './provider/ThemeProvider'
import { I18nProvider } from './provider/I18nProvider'
import App from './App'
import TrayWindow from './components/business/TrayWindow'
import SettingsWindow from './components/business/SettingsWindow'
import '@/styles/globals.css'
import '@/assets/main.css'

// 判断是否是托盘窗口
const isTrayWindow = window.location.hash === '#/tray'
const isSettingsWindow = window.location.hash === '#/settings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider defaultLocale="zh-CN" storageKey="minddock-locale">
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        {isTrayWindow ? <TrayWindow /> : isSettingsWindow ? <SettingsWindow /> : <App />}
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>
)
