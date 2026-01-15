import {
  CloudDownload,
  LayoutGrid,
  Trash2,
  CodeXml,
  ChevronUp,
  FileText,
  Clock,
  X,
  Settings,
  LucideIcon
} from 'lucide-react'
import ScrollArea from '@/components/ui/scroll-area'
import logoSrc from '@/assets/logo.png'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useList, FilterType } from '@renderer/provider/ListProvider'
// import { FolderSection } from './FolderTree' // 暂时隐藏文件夹功能
import { useExport } from '@renderer/provider/ExportProvider'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useState } from 'react'
import { AppSettings } from './Settings/AppSettings'

// 菜单项类型
interface MenuItem {
  title: string
  filterType: FilterType
  icon: LucideIcon
}

// Menu items.
const items: MenuItem[] = [
  {
    title: '所有内容',
    filterType: 'all',
    icon: LayoutGrid
  },
  {
    title: '文档',
    filterType: 'document',
    icon: FileText
  },
  {
    title: '代码片段',
    filterType: 'snippet',
    icon: CodeXml
  },
  {
    title: '废纸篓',
    filterType: 'trash',
    icon: Trash2
  }
]

export function AppSidebar() {
  const { filterType, setFilterType, notes, recentViews, clearRecentViews, selectedNote, setSelectedNote } = useList()
  const { exports, deleteExport } = useExport()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleItemClick = (item: MenuItem) => {
    setFilterType(item.filterType)
  }

  // 点击最近查看项
  const handleRecentClick = (id: string) => {
    const note = notes.find(n => n.id === id)
    if (note) {
      setSelectedNote(note)
    }
  }

  return (
    <div className="h-full">
      <div className="h-10 bg-(--background) drag"></div>
      <Sidebar collapsible="icon" className="pt-10">
        <SidebarHeader className="p-2 select-none">
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="App Logo" className="size-7 shrink-0 rounded-md" />
            <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">
              MindDock
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>个人收藏</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={filterType === item.filterType}
                      onClick={() => handleItemClick(item)}
                      className="cursor-pointer"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* 最近查看 */}
          {recentViews.length > 0 && (
            <SidebarGroup className="border-t border-border/50 pt-2 mt-2">
              <SidebarGroupLabel className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock size={12} className="text-muted-foreground" />
                  最近查看
                </span>
                <button
                  onClick={clearRecentViews}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-accent"
                >
                  清空
                </button>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <ScrollArea className="max-h-48">
                  <SidebarMenu className="space-y-0.5">
                    {recentViews.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={selectedNote?.id === item.id}
                          onClick={() => handleRecentClick(item.id)}
                          className="cursor-pointer h-8"
                        >
                          {item.type === 'snippet' ? (
                            <CodeXml size={14} className="shrink-0 text-orange-500" />
                          ) : (
                            <FileText size={14} className="shrink-0 text-blue-500" />
                          )}
                          <span className="truncate text-sm">{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </ScrollArea>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* 暂时隐藏文件夹功能
          <SidebarGroup>
            <SidebarGroupContent className="px-0">
              <FolderSection />
            </SidebarGroupContent>
          </SidebarGroup>
          */}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setSettingsOpen(true)} className="cursor-pointer">
                <Settings />
                <span className="group-data-[collapsible=icon]:hidden">设置</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <CloudDownload />
                    <span className="group-data-[collapsible=icon]:hidden">最近导出</span>
                    <ChevronUp className="ml-auto group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" className="w-64" align="end">
                  {exports.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      暂无导出记录
                    </div>
                  ) : (
                    <>
                      <ScrollArea className="max-h-80">
                        {exports.map((exp) => (
                          <div
                            key={exp.id}
                            className="group relative flex items-center gap-2 px-2 py-2 hover:bg-accent/50 cursor-pointer rounded-md mx-1"
                            onClick={async () => {
                              try {
                                await window.api.openPath(exp.file_path)
                              } catch (error) {
                                console.error('Failed to open path:', error)
                              }
                            }}
                          >
                            <FileText size={14} className="shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex-1 truncate text-sm font-medium">
                                  {exp.note_title}
                                </span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      await deleteExport(exp.id)
                                    } catch (error) {
                                      console.error('Failed to delete export:', error)
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/20 rounded transition-all"
                                  title="删除记录"
                                >
                                  <X size={12} className="text-muted-foreground hover:text-destructive" />
                                </button>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock size={10} />
                                {formatDistanceToNow(new Date(exp.created_at), {
                                  addSuffix: true,
                                  locale: zhCN
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </ScrollArea>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <AppSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
