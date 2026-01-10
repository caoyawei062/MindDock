import React from 'react'
import { Settings } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { type CodeMirrorConfig, DEFAULT_CODEMIRROR_CONFIG } from './types'

interface CodeMirrorSettingsProps {
  config?: CodeMirrorConfig
  onConfigChange?: (config: CodeMirrorConfig) => void
  className?: string
}

const CodeMirrorSettings: React.FC<CodeMirrorSettingsProps> = ({
  config = DEFAULT_CODEMIRROR_CONFIG,
  onConfigChange,
  className
}) => {
  const updateConfig = (key: keyof CodeMirrorConfig) => {
    onConfigChange?.({
      ...config,
      [key]: !config[key]
    })
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'p-1.5 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground',
                className
              )}
            >
              <Settings size={16} />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>编辑器设置</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs">编辑器设置</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={config.lineNumbers}
          onCheckedChange={() => updateConfig('lineNumbers')}
          className="text-xs"
        >
          显示行号
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={config.foldGutter}
          onCheckedChange={() => updateConfig('foldGutter')}
          className="text-xs"
        >
          代码折叠
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={config.autocompletion}
          onCheckedChange={() => updateConfig('autocompletion')}
          className="text-xs"
        >
          自动补全
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={config.highlightActiveLine}
          onCheckedChange={() => updateConfig('highlightActiveLine')}
          className="text-xs"
        >
          高亮当前行
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={config.bracketMatching}
          onCheckedChange={() => updateConfig('bracketMatching')}
          className="text-xs"
        >
          括号匹配
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={config.lineWrapping}
          onCheckedChange={() => updateConfig('lineWrapping')}
          className="text-xs"
        >
          自动换行
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default CodeMirrorSettings
