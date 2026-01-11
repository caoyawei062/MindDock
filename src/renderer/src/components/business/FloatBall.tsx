
import LogoSrc from '@/assets/logo.png'
import { THEME } from '../../../../constants/index'
import { useTheme } from '@renderer/provider/ThemeProvider'
const FloatBall = () => {
  const { theme, setTheme } = useTheme()
  const changeTheme = () => {
    const newTheme = theme === 'dark' ? THEME.LIGHT : THEME.DARK
    setTheme(newTheme)
    window.api.changeTheme(newTheme)
  }
  return (
    <div className="absolute bottom-8 right-8 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
      <img src={LogoSrc} alt="Logo" onClick={changeTheme} className="rounded-lg" />
    </div>
  )
}

export default FloatBall
