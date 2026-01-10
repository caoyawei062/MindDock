import React from 'react'
import Search from '@renderer/components/business/Search'
import List from '@renderer/components/business/List'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSidebar } from '@renderer/components/ui/sidebar'
import ScrollArea from '@renderer/components/ui/scroll-area'

const ListLayout: React.FC = () => {
  const { toggleSidebar, open } = useSidebar()
  return (
    <div className="relative h-screen">
      <div
        className="absolute top-1/2 left-0 hover:opacity-100 opacity-20 transform -translate-y-1/2  flex items-center gap-2 transition-opacity bg-background/70 dark:bg-background/70 rounded-r-md p-1 cursor-pointer z-10 shadow-md"
        onClick={toggleSidebar}
      >
        {open ? <ChevronLeft /> : <ChevronRight />}
      </div>
      <div className={`h-full flex flex-col ${open ? 'pt-0' : 'pt-4'} transition-all`}>
        <div className={`h-27 ${open ? '' : 'drag'}`}>
          <Search />
        </div>
        {/* 使用 overlayscrollbars 方案（带动画） */}
        <ScrollArea className="flex-1">
          <List />
        </ScrollArea>
        {/* 使用纯 CSS 方案（无动画）- 取消注释对比 */}
        {/* <div className="flex-1 overflow-y-auto custom-scrollbar">
          <List />
        </div> */}
      </div>
    </div>
  )
}

export default ListLayout
