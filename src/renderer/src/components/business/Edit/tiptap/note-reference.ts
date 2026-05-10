import { mergeAttributes, Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteReference: {
      insertNoteReference: (attrs: { noteId: string; noteTitle: string }) => ReturnType
    }
  }
}

export const NOTE_REFERENCE_SELECTOR = 'a[data-note-id]'

export const NoteReference = Node.create({
  name: 'noteReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      noteId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-note-id') || ''
      },
      noteTitle: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-note-title') || ''
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: NOTE_REFERENCE_SELECTOR
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const noteId = String(HTMLAttributes.noteId || '')
    const noteTitle = String(HTMLAttributes.noteTitle || '')

    return [
      'a',
      mergeAttributes(
        {
          href: `minddock://note/${noteId}`,
          'data-note-id': noteId,
          'data-note-title': noteTitle,
          class:
            'note-reference rounded-md bg-primary/10 px-1.5 py-0.5 text-primary no-underline transition-colors hover:bg-primary/15'
        },
        HTMLAttributes
      ),
      `@${noteTitle || '未命名文档'}`
    ]
  },

  renderText({ node }) {
    return `@${node.attrs.noteTitle || '未命名文档'}`
  },

  addCommands() {
    return {
      insertNoteReference:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs
          })
    }
  }
})
