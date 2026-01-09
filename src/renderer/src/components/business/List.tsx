import React from 'react'
import ListItem from './ListItem'
const List: React.FC = () => {
  return (
    <div className="h-full">
      {Array.from({ length: 20 }).map((_, index) => (
        <ListItem key={index} />
      ))}
    </div>
  )
}

export default List
