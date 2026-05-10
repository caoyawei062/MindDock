import Node from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import ResizableImageView from './ResizableImageView'

export const ResizableImage = Node.extend({
  name: 'image',

  addOptions() {
    return {
      ...this.parent?.(),
      inline: true,
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
        parseHTML: (element) => {
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
        parseHTML: (element) => {
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
      },
      displayMode: {
        default: 'inline',
        parseHTML: (element) => {
          const displayMode = element.getAttribute('data-display-mode')
          return displayMode === 'block' ? 'block' : 'inline'
        },
        renderHTML: (attributes) => {
          return {
            'data-display-mode': attributes.displayMode
          }
        }
      }
    }
  },

  renderHTML({ node }) {
    const { width, height, src, alt, title, align, displayMode } = node.attrs

    let style = ''
    if (width) {
      style += `width: ${width}px;`
    }
    if (height) {
      style += `height: ${height}px;`
    }
    if (displayMode === 'block') {
      style += 'display: block;'
      if (align === 'center') {
        style += 'margin-left: auto;margin-right: auto;'
      } else if (align === 'right') {
        style += 'margin-left: auto;margin-right: 0;'
      } else {
        style += 'margin-left: 0;margin-right: auto;'
      }
    } else {
      style += 'display: inline-block;vertical-align: top;margin: 0 12px 12px 0;'
    }

    return [
      'img',
      {
        ...this.options.HTMLAttributes,
        src,
        alt,
        title,
        'data-display-mode': displayMode,
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
