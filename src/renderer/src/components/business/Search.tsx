import React from 'react'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group'
import { Keyboard, PenLine, SearchIcon, Space } from 'lucide-react'
import { Button } from '../ui/button'
const Search: React.FC = () => {
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
          <Button className="w-full">
            <PenLine />
            文档
          </Button>
        </div>
        <div className="w-4"></div>
        <div className="w-[calc(50%-8px)]">
          <Button variant="outline" className="w-full">
            <Keyboard />
            代码
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Search
