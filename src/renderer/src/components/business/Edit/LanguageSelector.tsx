import React, { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import ScrollArea from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { type LanguageConfig, DEFAULT_LANGUAGES } from './types'

interface LanguageSelectorProps {
  languages?: LanguageConfig[]
  selectedLanguage?: string
  onLanguageChange?: (langId: string) => void
  className?: string
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  languages = DEFAULT_LANGUAGES,
  selectedLanguage = 'javascript',
  onLanguageChange,
  className
}) => {
  const currentLanguageName = useMemo(() => {
    return languages.find((lang) => lang.id === selectedLanguage)?.name || selectedLanguage
  }, [languages, selectedLanguage])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
            className
          )}
        >
          {currentLanguageName}
          <ChevronDown size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="p-0">
        <ScrollArea className="h-64">
          <div className="p-1">
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang.id}
                onClick={() => onLanguageChange?.(lang.id)}
                className={cn(
                  'text-xs',
                  selectedLanguage === lang.id && 'bg-accent text-accent-foreground'
                )}
              >
                {lang.name}
              </DropdownMenuItem>
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageSelector
