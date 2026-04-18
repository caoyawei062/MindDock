import React, { useMemo, useEffect } from 'react'
import { useEditor, EditorContent, EditorContext } from '@tiptap/react'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import EditorToolbar from './EditorToolbar'
import { createTiptapExtensions } from './tiptap/extensions'
import { FormattingBubbleMenu } from './tiptap/FormattingBubbleMenu'

const Tiptap: React.FC = () => {
  const { setEditor, updateOutlineItems, toolbarOpen } = useEditorContext()

  const editor = useEditor({
    extensions: createTiptapExtensions(),
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none w-full focus:outline-none min-h-full px-6 py-4'
      }
    },
    onUpdate: () => {
      updateOutlineItems()
    }
  })

  // 注册编辑器到 context
  useEffect(() => {
    setEditor(editor)
    return () => setEditor(null)
  }, [editor, setEditor])

  // 初始化大纲
  useEffect(() => {
    if (editor) {
      updateOutlineItems()
    }
  }, [editor, updateOutlineItems])

  const providerValue = useMemo(() => ({ editor }), [editor])

  if (!editor) {
    return null
  }

  return (
    <EditorContext.Provider value={providerValue}>
      <div className="flex flex-col h-full min-w-0 overflow-hidden">
        {/* 固定工具栏 */}
        {toolbarOpen && <EditorToolbar editor={editor} />}

        <EditorContent
          editor={editor}
          className="custom-scrollbar flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
        />

        {/* 格式化气泡菜单 - 包含 AI 功能 */}
        <FormattingBubbleMenu editor={editor} />
      </div>
    </EditorContext.Provider>
  )
}

export default Tiptap
