import React from 'react'
import {} from '@/components/ui/tooltip'
import {} from 'lucide-react'
import LogoSrc from '@/assets/logo.png'
const FloatBall = () => {
  return (
    <div className="absolute bottom-8 right-8 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
      <img src={LogoSrc} alt="Logo" />
    </div>
  )
}

export default FloatBall
