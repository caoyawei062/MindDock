import React, { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2
} from 'lucide-react'
import { Folder as FolderType } from '@renderer/provider/FolderProvider'
import { useFolder } from '@renderer/provider/FolderProvider'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'

interface FolderTreeProps {
  folders: FolderType[]
  level?: number
}

interface FolderItemProps {
  folder: FolderType
  level?: number
}

// 单个文件夹项
const FolderItem: React.FC<FolderItemProps> = ({ folder, level = 0 }) => {
  const {
    selectedFolder,
    setSelectedFolder,
    toggleExpanded,
    updateFolder,
    deleteFolder,
    createFolder
  } = useFolder()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const isExpanded = folder.is_expanded === 1
  const isSelected = selectedFolder?.id === folder.id
  const hasChildren = folder.children && folder.children.length > 0

  const handleClick = () => {
    setSelectedFolder(folder)
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleExpanded(folder.id)
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditName(folder.name)
  }

  const handleSaveEdit = async () => {
    if (editName.trim() && editName !== folder.name) {
      await updateFolder(folder.id, { name: editName.trim() })
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName(folder.name)
  }

  const handleDelete = async () => {
    if (confirm(`确定要删除文件夹"${folder.name}"吗？`)) {
      await deleteFolder(folder.id)
    }
  }

  const handleCreateSubfolder = async () => {
    if (!newFolderName.trim()) return

    setIsCreating(true)
    try {
      await createFolder({
        name: newFolderName.trim(),
        parent_id: folder.id
      })
      setIsCreateDialogOpen(false)
      setNewFolderName('')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="pointer-events-auto">
      <div
        className={`group flex items-center gap-1 py-1.5 px-2 my-0.5 rounded-md cursor-pointer transition-colors ${
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50'
        }`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onClick={handleClick}
      >
        {/* 展开/收起图标 */}
        {hasChildren ? (
          <div className="shrink-0 p-0.5 hover:bg-accent rounded" onClick={handleToggle}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        ) : (
          <div className="w-5 shrink-0" />
        )}

        {/* 文件夹图标 */}
        {isExpanded ? (
          <FolderOpen size={16} className="shrink-0 text-primary -ml-1" />
        ) : (
          <Folder size={16} className="shrink-0 text-muted-foreground -ml-1" />
        )}

        {/* 文件夹名称 */}
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit()
              if (e.key === 'Escape') handleCancelEdit()
            }}
            className="h-6 px-2 text-sm flex-1"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm flex-1 truncate">{folder.name}</span>
        )}

        {/* 操作菜单 */}
        {!isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-accent"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleEdit(); }}>
                <Pencil size={14} className="mr-2" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIsCreateDialogOpen(true); }}>
                <Plus size={14} className="mr-2" />
                新建子文件夹
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleDelete(); }} className="text-destructive">
                <Trash2 size={14} className="mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 子文件夹 */}
      {isExpanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderItem key={child.id} folder={child} level={level + 1} />
          ))}
        </div>
      )}

      {/* 新建子文件夹对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建子文件夹</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="文件夹名称"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSubfolder()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false)
                setNewFolderName('')
              }}
            >
              取消
            </Button>
            <Button onClick={handleCreateSubfolder} disabled={!newFolderName.trim() || isCreating}>
              {isCreating ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 文件夹树组件
export const FolderTree: React.FC<FolderTreeProps> = ({ folders, level = 0 }) => {
  if (folders.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-muted-foreground">暂无文件夹</div>
  }

  return (
    <div className="pointer-events-auto">
      {folders.map((folder) => (
        <FolderItem key={folder.id} folder={folder} level={level} />
      ))}
    </div>
  )
}

// 文件夹区域组件（包含标题和新建按钮）
export const FolderSection: React.FC = () => {
  const { folders, isLoading, createFolder } = useFolder()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    setIsCreating(true)
    try {
      await createFolder({
        name: newFolderName.trim()
      })
      setIsCreateDialogOpen(false)
      setNewFolderName('')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="pointer-events-auto">
      {/* 标题和新建按钮 - 折叠时隐藏 */}
      <div className="flex items-center justify-between px-2 py-1.5 group-data-[collapsible=icon]:hidden">
        <span className="text-xs font-semibold text-muted-foreground">文件夹</span>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-accent">
              <Plus size={14} />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>新建文件夹</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="文件夹名称"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  setNewFolderName('')
                }}
              >
                取消
              </Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || isCreating}>
                {isCreating ? '创建中...' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 文件夹列表 - 折叠时隐藏 */}
      {isLoading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
          加载中...
        </div>
      ) : (
        <div className="group-data-[collapsible=icon]:hidden">
          <FolderTree folders={folders} />
        </div>
      )}

      {/* 折叠时显示的图标 */}
      <div className="hidden group-data-[collapsible=icon]:block py-2">
        <Folder size={20} className="mx-auto text-muted-foreground" />
      </div>
    </div>
  )
}
