import { Extension } from '@tiptap/core'
import type { Extensions } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import TextAlign from '@tiptap/extension-text-align'
import { common, createLowlight } from 'lowlight'
import { ResizableImage } from '../ResizableImage'
import { NoteReference } from './note-reference'

const lowlight = createLowlight(common)

const TabHandler = Extension.create({
  name: 'tabHandler',
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('codeBlock')) {
          return this.editor.chain().focus().insertContent('  ').run()
        }
        return this.editor.chain().focus().insertContent('  ').run()
      },
      'Shift-Tab': () => true
    }
  }
})

export function createTiptapExtensions(): Extensions {
  return [
    StarterKit.configure({
      codeBlock: false
    }),
    Placeholder.configure({
      placeholder: '开始编写...'
    }),
    TabHandler,
    CodeBlockLowlight.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          language: {
            default: 'plaintext',
            parseHTML: (element) => {
              const codeEl = element.querySelector('code')
              const className = codeEl?.className || ''
              const match = className.match(/language-(\w+)/)
              return match ? match[1] : element.getAttribute('data-language') || 'plaintext'
            },
            renderHTML: () => ({})
          }
        }
      },
      renderHTML({ node, HTMLAttributes }) {
        const language = node.attrs.language || 'plaintext'
        return [
          'pre',
          {
            ...HTMLAttributes,
            'data-language': language,
            class: 'not-prose'
          },
          ['code', { class: `language-${language}` }, 0]
        ]
      }
    }).configure({
      lowlight,
      defaultLanguage: 'plaintext'
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph']
    }),
    NoteReference,
    ResizableImage.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: 'rounded-lg max-w-full'
      }
    })
  ]
}
