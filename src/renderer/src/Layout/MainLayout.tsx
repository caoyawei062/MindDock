import React from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useSidebar } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/business/SideBar'
import { Button } from '@renderer/components/ui/button'
import FloatBall from '@renderer/components/business/FloatBall'
const MainLayout: React.FC = () => {
  const { toggleSidebar } = useSidebar()
  return (
    <>
      <AppSidebar />
      <main className="w-full relative">
        <ResizablePanelGroup orientation="horizontal" className="w-full">
          <ResizablePanel defaultSize={30} minSize={'250px'} maxSize={'400px'}>
            <Button onClick={toggleSidebar}>展开</Button>
            1213132132
          </ResizablePanel>
          <ResizableHandle className="w-0.5 hover:bg-blue-300" />
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
