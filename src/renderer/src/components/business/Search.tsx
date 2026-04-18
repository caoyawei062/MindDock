import React from 'react'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group'
import { Keyboard, PenLine, SearchIcon, X } from 'lucide-react'
import { Button } from '../ui/button'
import { useList } from '@renderer/provider/ListProvider'

const Search: React.FC = () => {
  const { createNote, filterType, setFilterType, searchQuery, setSearchQuery, filteredNotes } = useList()
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const handleCreateDocument = React.useCallback(async () => {
    if (filterType !== 'all' && filterType !== 'document') {
      setFilterType('document')
    }
    await createNote({ type: 'document', title: '' })
  }, [createNote, filterType, setFilterType])

  const handleCreateSnippet = React.useCallback(async () => {
    if (filterType !== 'all' && filterType !== 'snippet') {
      setFilterType('snippet')
    }
    await createNote({ type: 'snippet', title: '', language: 'javascript' })
  }, [createNote, filterType, setFilterType])

  const clearSearch = () => {
    setSearchQuery('')
  }

  React.useEffect(() => {
    return window.api.onAppCommand((command) => {
      if (command === 'new-document') {
        void handleCreateDocument()
      }

      if (command === 'focus-search') {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    })
  }, [handleCreateDocument])

  return (
    <div className="p-3 border-b dark:border-border-dark drag">
      <InputGroup>
        <InputGroupInput
          ref={searchInputRef}
          placeholder="搜索标题、内容或标签..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <InputGroupAddon>
          {searchQuery ? (
            <button
              onClick={clearSearch}
              className="hover:bg-accent rounded-full p-0.5 transition-colors"
              title="清除搜索"
            >
              <X size={14} />
            </button>
          ) : (
            <SearchIcon />
          )}
        </InputGroupAddon>
      </InputGroup>

      {/* 搜索结果提示 */}
      {searchQuery && (
        <div className="mt-2 text-xs text-muted-foreground">
          找到 {filteredNotes.length} 个结果
        </div>
      )}

      <div className="flex justify-around mt-2">
        <div className="w-[calc(50%-8px)]">
          <Button className="w-full" onClick={handleCreateDocument}>
            <PenLine />
            文档
          </Button>
        </div>
        <div className="w-4"></div>
        <div className="w-[calc(50%-8px)]">
          <Button variant="outline" className="w-full" onClick={handleCreateSnippet}>
            <Keyboard />
            代码
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Search
