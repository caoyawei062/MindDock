import React from 'react'
import {} from '@/components/ui/tooltip'
import {} from 'lucide-react'
import LogoSrc from '@/assets/logo.png'
import { useTheme } from '@renderer/provider/ThemeProvider'
const FloatBall = () => {
  const { theme, setTheme } = useTheme()
  return (
    <div className="absolute bottom-8 right-8 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
      <img
        src={LogoSrc}
        alt="Logo"
        onClick={() => {
          setTheme(theme === 'dark' ? 'light' : 'dark')
        }}
      />
    </div>
  )
}

export default FloatBall
