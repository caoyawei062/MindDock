import React from 'react'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group'
import { Keyboard, PenLine, SearchIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { useList } from '@renderer/provider/ListProvider'

const Search: React.FC = () => {
  const { createNote, filterType, setFilterType } = useList()

  const handleCreateDocument = async () => {
    if (filterType !== 'all' && filterType !== 'document') {
      setFilterType('document')
    }
    await createNote({ type: 'document', title: '' }) // 可以留空让后端或hooks处理默认标题
  }

  const handleCreateSnippet = async () => {
    if (filterType !== 'all' && filterType !== 'snippet') {
      setFilterType('snippet')
    }
    await createNote({ type: 'snippet', title: '', language: 'javascript' })
  }

  return (
    <div className="p-3 border-b dark:border-border-dark drag">
      <InputGroup>
        <InputGroupInput placeholder="快速定位内容" />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
      <div className="flex justify-around mt-2 ">
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
