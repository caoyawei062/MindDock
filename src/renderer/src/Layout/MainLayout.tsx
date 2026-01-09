import React from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { AppSidebar } from '@/components/business/SideBar'
import FloatBall from '@renderer/components/business/FloatBall'
import ListLayout from './ListLayout'
const MainLayout: React.FC = () => {
  const handleToggleSidebar = (event: React.DragEvent) => {}
  return (
    <>
      <AppSidebar />
      <main className="w-full relative">
        <ResizablePanelGroup orientation="horizontal" className="w-full">
          <ResizablePanel defaultSize={30} minSize={'200px'} maxSize={'350px'}>
            <ListLayout />
          </ResizablePanel>
          <ResizableHandle className="focus-visible:ring-0 focus-visible:ring-offset-0" />
          <ResizablePanel defaultSize={50} minSize={'300px'}>
            12131313
          </ResizablePanel>
        </ResizablePanelGroup>
        <FloatBall />
      </main>
    </>
  )
}
export default MainLayout
