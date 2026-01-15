import React from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { AppSidebar } from '@/components/business/SideBar'
import ListLayout from './ListLayout'
import EditLayout from './EditLayout'
import { EditorProvider } from '@renderer/provider/EditorProvider'

const MainLayout: React.FC = () => {
  return (
    <>
      <AppSidebar />
      <main className="w-full relative select-none overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="w-full">
          <ResizablePanel defaultSize={30} minSize={'220px'} maxSize={'350px'}>
            <ListLayout />
          </ResizablePanel>
          <ResizableHandle className="focus-visible:ring-0 focus-visible:ring-offset-0" />
          <ResizablePanel defaultSize={50} minSize={'300px'} className="select-text">
            <EditorProvider>
              <EditLayout />
            </EditorProvider>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </>
  )
}
export default MainLayout
