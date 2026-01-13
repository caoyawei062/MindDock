import Node from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import ResizableImageView from './ResizableImageView'

export const ResizableImage = Node.extend({
  name: 'image',

  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      allowBase64: true,
      HTMLAttributes: {},
      resize: false
    }
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => {
          const width = element.style.width
          return width ? parseInt(width, 10) : null
        },
        renderHTML: () => {
          // Don't render width attribute, will be handled by the style attribute
          return {}
        }
      },
      height: {
        default: null,
        parseHTML: element => {
          const height = element.style.height
          return height ? parseInt(height, 10) : null
        },
        renderHTML: () => {
          // Don't render height attribute, will be handled by the style attribute
          return {}
        }
      }
    }
  },

  renderHTML({ node }) {
    const { width, height, src, alt, title } = node.attrs

    let style = ''
    if (width) {
      style += `width: ${width}px;`
    }
    if (height) {
      style += `height: ${height}px;`
    }

    return [
      'img',
      {
        ...this.options.HTMLAttributes,
        src,
        alt,
        title,
        style: style || undefined
      }
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView, {
      contentDOMElementTag: 'img'
    })
  }
})
