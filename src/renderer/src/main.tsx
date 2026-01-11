import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './provider/ThemeProvider'
import App from './App'
import TrayWindow from './components/business/TrayWindow'
import '@/styles/globals.css'
import '@/assets/main.css'

// 判断是否是托盘窗口
const isTrayWindow = window.location.hash === '#/tray'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      {isTrayWindow ? <TrayWindow /> : <App />}
    </ThemeProvider>
  </StrictMode>
)
