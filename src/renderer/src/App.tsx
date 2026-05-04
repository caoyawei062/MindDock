import { SidebarProvider } from './components/ui/sidebar'
import { ListProvider } from './provider/ListProvider'
import { ExportProvider } from './provider/ExportProvider'
import MainLayout from './Layout/MainLayout'

function App(): React.JSX.Element {
  return (
    <div className="w-screen h-screen">
      <SidebarProvider>
        <ExportProvider>
          <ListProvider>
            <MainLayout></MainLayout>
          </ListProvider>
        </ExportProvider>
      </SidebarProvider>
    </div>
  )
}

export default App
