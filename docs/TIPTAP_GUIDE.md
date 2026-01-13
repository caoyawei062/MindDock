# Tiptap 集成指南 (MindDock)

本文档旨在帮助你快速上手 Tiptap 编辑器的开发与配置。Tiptap 是一个无头（Headless）富文本编辑器，这意味着它没有默认 UI，你可以完全掌控它的外观。

## 1. 基础架构

在本项目中，Tiptap 的核心配置位于 `src/renderer/src/components/business/Edit/Tiptap.tsx`。

### 核心 Hook: `useEditor`

`useEditor` 是 Tiptap 的核心 React Hook，用于初始化编辑器实例。

```typescript
const editor = useEditor({
  // 1. 扩展列表
  extensions: [
    StarterKit, // 基础套件（包含段落、标题、列表、粗体等）
    Placeholder, // 占位符
    // ...更多扩展
  ],
  
  // 2. 初始内容
  content: '<p>Hello World</p>',
  
  // 3. 编辑器属性（通常用于设置 Tailwind 类名）
  editorProps: {
    attributes: {
      class: 'prose prose-sm focus:outline-none ...' 
    }
  },
  
  // 4. 事件回调
  onUpdate: ({ editor }) => {
    // 内容变化时触发
    const html = editor.getHTML()
    // const json = editor.getJSON()
  }
})
```

## 2. 常用操作

### 获取/设置内容

```typescript
// 设置内容（支持 HTML 或 JSON）
editor.commands.setContent('<p>新内容</p>')

// 获取 HTML
const html = editor.getHTML()

// 获取 JSON (推荐用于存储，更结构化)
const json = editor.getJSON()

// 获取纯文本
const text = editor.getText()
```

### 格式操作

```typescript
// 加粗
editor.chain().focus().toggleBold().run()

// 设置标题
editor.chain().focus().toggleHeading({ level: 1 }).run()

// 插入代码块
editor.chain().focus().toggleCodeBlock().run()

// 插入图片
editor.chain().focus().setImage({ src: 'url' }).run()
```

> **注意**: `.chain()` 允许链式调用，`.focus()` 确保编辑器获得焦点，`.run()` 执行命令。

## 3. 扩展 (Extensions)

MindDock 已经集成了以下扩展：

- **StarterKit**: 包含大多数基础功能（Paragraph, Text, Heading, Bold, Italic, BulletList, OrderedList, Blockquote, Code, HorizontalRule 等）。
  - *注意*: 我们禁用了默认的 `codeBlock`，改用更强大的 `CodeBlockLowlight`。
- **Placeholder**: 当文档为空时显示占位文本。
- **CodeBlockLowlight**: 支持语法高亮的代码块（基于 `lowlight`）。
- **Image**:图片支持。

### 如何添加新扩展？

1. 安装扩展：`pnpm add @tiptap/extension-list-keymap`
2. 在 `Tiptap.tsx` 中导入并添加到 `extensions` 数组：

```typescript
import ListKeymap from '@tiptap/extension-list-keymap'

const editor = useEditor({
  extensions: [
    // ...
    ListKeymap,
  ]
})
```

## 4. 气泡菜单 (Bubble Menu)

我们在选中文字时显示的悬浮菜单。

```tsx
import { BubbleMenu } from '@tiptap/react'

// 在组件 JSX 中：
{editor && (
  <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
    <button onClick={() => editor.chain().focus().toggleBold().run()}>
      Bold
    </button>
    {/* ...更多按钮 */}
  </BubbleMenu>
)}
```

## 5. 样式定制 (Tailwind Typography)

我们使用了 `@tailwindcss/typography` 插件来自动美化 HTML 内容。

在 `editorProps` 中配置类名：

```typescript
editorProps: {
  attributes: {
    // `prose`: 启用排版样式
    // `prose-sm`: 小号字体
    // `dark:prose-invert`: 暗色模式适配
    // `max-w-none`: 移除最大宽度限制
    class: 'prose prose-sm dark:prose-invert max-w-none w-full ...'
  }
}
```

## 6. 在 EditLayout 中交互

在 `EditLayout.tsx` 中，我们通过监听 `editor` 实例的事件来实现自动保存等功能：

```typescript
// 监听内容更新
useEffect(() => {
  if (!editor) return

  const handleUpdate = () => {
    console.log('内容变了:', editor.getHTML())
  }

  editor.on('update', handleUpdate)
  return () => editor.off('update', handleUpdate)
}, [editor])
```

## 7. 常见问题

- **光标跳动**：如果通过 `value` prop 传递内容并在每次渲染时调用 `setContent`，会导致光标重置。解决方案是只在 ID 变化时设置内容（如我们在 `EditLayout` 中所做的）。
- **图片上传**：默认的 Image 扩展只支持 URL。如果需要支持拖拽上传或粘贴图片，需要编写自定义插件或配置 `handlePaste` / `handleDrop` 事件。

## 参考资源

- [Tiptap 官方文档](https://tiptap.dev/introduction)
- [Tiptap 扩展列表](https://tiptap.dev/extensions)
