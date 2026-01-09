import { ChartNoAxesGantt, Copy, Tag, Trash2, Save } from 'lucide-react'
import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const EditToolHeader: React.FC = () => {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 drag">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-accent transition-colors">
              <Copy size={16} className="text-muted-foreground hover:text-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>复制内容</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-accent transition-colors">
              <ChartNoAxesGantt size={16} className="text-muted-foreground hover:text-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>大纲视图</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-accent transition-colors">
              <Tag size={16} className="text-muted-foreground hover:text-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>添加标签</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
              <Trash2 size={16} className="text-muted-foreground hover:text-destructive" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>删除</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-primary/10 transition-colors">
              <Save size={16} className="text-muted-foreground hover:text-primary" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>保存</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export default EditToolHeader
