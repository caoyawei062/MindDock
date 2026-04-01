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
      },
      align: {
        default: 'left',
        parseHTML: (element) => {
          const marginLeft = element.style.marginLeft
          const marginRight = element.style.marginRight

          if (marginLeft === 'auto' && marginRight === 'auto') return 'center'
          if (marginLeft === 'auto') return 'right'
          return 'left'
        },
        renderHTML: () => {
          return {}
        }
      }
    }
  },

  renderHTML({ node }) {
    const { width, height, src, alt, title, align } = node.attrs

    let style = ''
    if (width) {
      style += `width: ${width}px;`
    }
    if (height) {
      style += `height: ${height}px;`
    }
    style += 'display: block;'
    if (align === 'center') {
      style += 'margin-left: auto;margin-right: auto;'
    } else if (align === 'right') {
      style += 'margin-left: auto;margin-right: 0;'
    } else {
      style += 'margin-left: 0;margin-right: auto;'
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
