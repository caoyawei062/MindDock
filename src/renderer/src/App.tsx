import { SidebarProvider } from './components/ui/sidebar'
import MainLayout from './Layout/MainLayout'

function App(): React.JSX.Element {
  return (
    <div className="w-screen h-screen">
      <SidebarProvider>
        <MainLayout></MainLayout>
      </SidebarProvider>
    </div>
  )
}

export default App
