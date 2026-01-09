import React from 'react'
import { File, Tag } from 'lucide-react'

const ListItem: React.FC = () => {
  return (
    <div className="w-full px-3 py-2.5 border-b border-border/50 cursor-pointer transition-colors duration-200 hover:bg-accent/50">
      <div className="flex items-center gap-2 mb-1.5">
        <File size={16} className="text-muted-foreground shrink-0" />
        <span className="font-medium text-sm truncate">title</span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-primary/10">
          <Tag size={10} className="text-primary" />
          <span className="text-primary/80">JavaScript</span>
        </div>
        <span className="text-muted-foreground/70">time</span>
      </div>
    </div>
  )
}

export default ListItem
