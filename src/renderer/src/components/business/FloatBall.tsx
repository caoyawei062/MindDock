import { THEME } from '../../../../constants/index'
import { useTheme } from '@renderer/provider/ThemeProvider'
import { useState } from 'react'
import { AISettings } from './AI/AISettings'
import { Sparkles, Sun, Moon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

const FloatBall = (): React.JSX.Element => {
  const { theme, setTheme } = useTheme()
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)

  const changeTheme = (): void => {
    const newTheme = theme === 'dark' ? THEME.LIGHT : THEME.DARK
    setTheme(newTheme)
    window.api.changeTheme(newTheme)
  }

  return (
    <>
      <div className="absolute bottom-8 left-8 flex flex-col gap-2">
        {/* 主题切换按钮 */}
        <Button
          size="icon"
          className={`w-10 h-10 rounded-full transition-colors ${
            theme === 'dark'
              ? 'bg-white text-black hover:bg-gray-200'
              : 'bg-black text-white hover:bg-gray-800'
          }`}
          onClick={changeTheme}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        {/* AI 设置按钮 */}
        <Button
          size="icon"
          className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700"
          onClick={() => setAiSettingsOpen(true)}
        >
          <Sparkles className="w-5 h-5" />
        </Button>
      </div>

      {/* AI 设置对话框 */}
      <AISettings open={aiSettingsOpen} onOpenChange={setAiSettingsOpen} />
    </>
  )
}

export default FloatBall
