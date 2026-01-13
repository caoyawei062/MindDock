import React, { useCallback, useState } from 'react'
import EditToolHeader from '../components/business/Edit/EditToolHeader'
import Tiptap from '../components/business/Edit/Tiptap'
import Codemirror from '../components/business/Edit/Codemirror'
import OutlineView from '../components/business/Edit/OutlineView'
import WelcomeView from '../components/business/Edit/WelcomeView'
import ScrollArea from '@renderer/components/ui/scroll-area'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import { useNoteEditor } from '@renderer/hooks/useNoteEditor'
import { cn } from '@/lib/utils'
import { ChartNoAxesGantt } from 'lucide-react'
import { DEFAULT_LANGUAGES } from '../components/business/Edit/types'

// 窄屏阈值（像素）
const NARROW_THRESHOLD = 500

const EditLayout = () => {
  const { outlineOpen, outlineItems, editor } = useEditorContext()
  const {
    note,
    title,
    setTitle,
    editorMode,
    setEditorMode,
    selectedLanguage,
    setSelectedLanguage,
    codeContent,
    setCodeContent,
    codeMirrorConfig,
    setCodeMirrorConfig,
    tags,
    setTags
  } = useNoteEditor({ editor })

  const [containerWidth, setContainerWidth] = useState(0)
  const [hoverOutline, setHoverOutline] = useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // 监听容器宽度
  React.useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const isNarrow = containerWidth < NARROW_THRESHOLD && containerWidth > 0

  // 点击大纲项滚动到对应位置
  const handleOutlineItemClick = useCallback(
    (id: string) => {
      if (!editor) return

      const pos = parseInt(id.replace('heading-', ''), 10)
      editor.chain().focus().setTextSelection(pos).run()

      // 滚动到视图
      const element = editor.view.domAtPos(pos)
      if (element.node instanceof HTMLElement) {
        element.node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    },
    [editor]
  )

  // 大纲内容
  const outlineContent = (
    <OutlineView items={outlineItems} onItemClick={handleOutlineItemClick} className="h-full" />
  )

  if (!note) {
    return <WelcomeView />
  }

  return (
    <div ref={containerRef} className="h-screen flex flex-col">
      <EditToolHeader
        title={title}
        onTitleChange={setTitle}
        mode={editorMode}
        onModeChange={setEditorMode}
        languages={DEFAULT_LANGUAGES}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
        codeMirrorConfig={codeMirrorConfig}
        onCodeMirrorConfigChange={setCodeMirrorConfig}
        tags={tags}
        onTagsChange={setTags}
        noteId={note?.id}
        noteType={note?.type}
      />
      <div className="flex-1 flex overflow-hidden relative">
        {/* 大纲视图 - 宽屏内嵌 */}
        {!isNarrow && outlineOpen && (
          <div className="w-56 border-r border-border/50 shrink-0 bg-muted/30">
            <div className="p-2 border-b border-border/50">
              <span className="text-xs font-medium text-muted-foreground">大纲</span>
            </div>
            {outlineContent}
          </div>
        )}

        {/* 窄屏 - 左侧浮动图标 + hover 展示大纲 */}
        {isNarrow && outlineOpen && (
          <>
            {/* 触发图标 */}
            <div className="absolute left-1 top-4 z-20" onMouseEnter={() => setHoverOutline(true)}>
              <div
                className={cn(
                  'p-1.5 rounded-md bg-muted/80 backdrop-blur-sm cursor-pointer transition-opacity',
                  hoverOutline ? 'opacity-0 pointer-events-none' : 'opacity-70 hover:opacity-100'
                )}
              >
                <ChartNoAxesGantt size={14} className="text-muted-foreground" />
              </div>
            </div>

            {/* hover 时展示的大纲面板 */}
            <div
              className={cn(
                'absolute left-0 top-0 z-20 h-full w-56 bg-popover/95 backdrop-blur-sm border-r border-border shadow-lg transition-all duration-200',
                hoverOutline
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-full pointer-events-none'
              )}
              onMouseLeave={() => setHoverOutline(false)}
            >
              <div className="p-2 border-b border-border/50">
                <span className="text-xs font-medium text-muted-foreground">大纲</span>
              </div>
              {outlineContent}
            </div>
          </>
        )}

        {/* 编辑器 */}
        <ScrollArea
          className={cn(
            'flex-1 w-full min-w-0 overflow-hidden',
            outlineOpen && !isNarrow && 'border-l-0',
            isNarrow && outlineOpen && 'pl-8'
          )}
        >
          {editorMode === 'word' ? (
            <Tiptap />
          ) : (
            <Codemirror
              value={codeContent}
              onChange={setCodeContent}
              language={selectedLanguage}
              config={codeMirrorConfig}
            />
          )}
        </ScrollArea>
      </div>
    </div>
  )
}

export default EditLayout
