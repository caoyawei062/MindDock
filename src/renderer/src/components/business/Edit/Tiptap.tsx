import React, { useMemo, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, EditorContext } from '@tiptap/react'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import { useList, type Note } from '@renderer/provider/ListProvider'
import EditorToolbar from './EditorToolbar'
import { createTiptapExtensions } from './tiptap/extensions'
import { FormattingBubbleMenu } from './tiptap/FormattingBubbleMenu'
import { NOTE_REFERENCE_SELECTOR } from './tiptap/note-reference'
import { AtMentionPopup } from './AtMentionPopup'

interface AtTriggerState {
  from: number
  query: string
  coords: { left: number; bottom: number }
}

const AT_TRIGGER_REGEX = /@([^\s@]*)$/

const Tiptap: React.FC = () => {
  const { setEditor, updateOutlineItems, toolbarOpen } = useEditorContext()
  const { setSelectedNote, selectedNote } = useList()

  const setSelectedNoteRef = useRef(setSelectedNote)
  setSelectedNoteRef.current = setSelectedNote

  const updateOutlineItemsRef = useRef(updateOutlineItems)
  updateOutlineItemsRef.current = updateOutlineItems

  const [atTrigger, setAtTrigger] = useState<AtTriggerState | null>(null)
  const [atDocuments, setAtDocuments] = useState<Note[]>([])
  const [atDocumentsLoading, setAtDocumentsLoading] = useState(false)

  const editor = useEditor({
    extensions: createTiptapExtensions(),
    content: '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none w-full focus:outline-none min-h-full px-6 py-4'
      },
      handleClick: (_view, _pos, event) => {
        if (!(event.target instanceof HTMLElement)) {
          return false
        }

        const referenceElement = event.target.closest(NOTE_REFERENCE_SELECTOR)
        if (!referenceElement) {
          return false
        }

        const noteId = referenceElement.getAttribute('data-note-id')
        if (!noteId) {
          return false
        }

        event.preventDefault()
        void window.api.notesGetById(noteId).then((note) => {
          if (note && note.is_trashed === 0) {
            setSelectedNoteRef.current(note)
          }
        })
        return true
      }
    },
    onUpdate: () => {
      updateOutlineItemsRef.current()
    }
  }, [])

  useEffect(() => {
    setEditor(editor)
    return () => setEditor(null)
  }, [editor, setEditor])

  useEffect(() => {
    if (editor) {
      updateOutlineItems()
    }
  }, [editor, updateOutlineItems])

  useEffect(() => {
    if (!editor) return

    const handleTransaction = (): void => {
      const { state, view } = editor
      const selection = state.selection

      if (selection.from !== selection.to) {
        setAtTrigger(null)
        return
      }

      const $pos = selection.$from
      const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, null, '\0')
      const match = AT_TRIGGER_REGEX.exec(textBefore)

      if (match) {
        const query = match[1]
        const atPos = $pos.pos - match[0].length
        const coords = view.coordsAtPos(atPos)
        setAtTrigger({ from: atPos, query, coords: { left: coords.left, bottom: coords.bottom } })
      } else {
        setAtTrigger(null)
      }
    }

    editor.on('transaction', handleTransaction)
    return () => {
      editor.off('transaction', handleTransaction)
    }
  }, [editor])

  const atTriggerActive = atTrigger !== null
  useEffect(() => {
    if (!atTriggerActive) return
    setAtDocumentsLoading(true)
    void window.api.notesGetAll('document').then((docs) => {
      setAtDocuments(docs.filter((n) => n.is_trashed === 0))
      setAtDocumentsLoading(false)
    })
  }, [atTriggerActive])

  const atMentionCandidates = useMemo<Note[]>(() => {
    if (!atTrigger) return []
    const q = atTrigger.query.toLowerCase()
    return atDocuments
      .filter((n) => n.id !== selectedNote?.id)
      .filter((n) => !q || (n.title || '未命名文档').toLowerCase().includes(q))
  }, [atTrigger, atDocuments, selectedNote])

  const handleAtSelect = (note: Note): void => {
    if (!editor || !atTrigger) return
    const to = editor.state.selection.from
    editor
      .chain()
      .focus()
      .deleteRange({ from: atTrigger.from, to })
      .insertNoteReference({ noteId: note.id, noteTitle: note.title || '未命名文档' })
      .run()
    setAtTrigger(null)
  }

  const providerValue = useMemo(() => ({ editor }), [editor])

  if (!editor) {
    return null
  }

  return (
    <EditorContext.Provider value={providerValue}>
      <div className="flex flex-col h-full min-w-0 overflow-hidden">
        {toolbarOpen && <EditorToolbar editor={editor} />}

        <EditorContent
          editor={editor}
          className="custom-scrollbar flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
        />

        <FormattingBubbleMenu editor={editor} />

        {atTrigger && (
          <AtMentionPopup
            query={atTrigger.query}
            coords={atTrigger.coords}
            candidates={atMentionCandidates}
            loading={atDocumentsLoading}
            onSelect={handleAtSelect}
            onClose={() => setAtTrigger(null)}
          />
        )}
      </div>
    </EditorContext.Provider>
  )
}

export default Tiptap
