import React from 'react'
import {
  Keyboard,
  PenLine,
  SearchIcon,
  X,
  FileText,
  CodeXml,
  LayoutGrid,
  Star,
  Settings,
  ArrowRight
} from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent } from '../ui/dialog'
import ScrollArea from '../ui/scroll-area'
import { Input } from '../ui/input'
import { useList, type Note } from '@renderer/provider/ListProvider'
import { useI18n } from '@renderer/provider/I18nProvider'
import { cn } from '@/lib/utils'

type PaletteEntry = {
  id: string
  label: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  kind: 'action' | 'note'
  run: () => Promise<void> | void
}

const stripHtml = (html: string): string => {
  return html
    .replace(/<img\b[^>]*>/gi, '[图片]')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const Search: React.FC = () => {
  const { createNote, setFilterType, setSelectedNote } = useList()
  const { t } = useI18n()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [notes, setNotes] = React.useState<Note[]>([])
  const [loadingNotes, setLoadingNotes] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const hasLoadedNotesRef = React.useRef(false)
  const entryRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  const shortcutLabel = React.useMemo(() => {
    return navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K'
  }, [])

  const closePalette = React.useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const loadPaletteNotes = React.useCallback(async () => {
    if (hasLoadedNotesRef.current) return

    setLoadingNotes(true)
    try {
      const allNotes = await window.api.notesGetAllWithTags(undefined, undefined)
      setNotes(allNotes)
      hasLoadedNotesRef.current = true
    } catch (error) {
      console.error('Failed to load command palette notes:', error)
      setNotes([])
    } finally {
      setLoadingNotes(false)
    }
  }, [])

  const openPalette = React.useCallback(() => {
    setOpen(true)
  }, [])

  const handleCreateDocument = React.useCallback(async () => {
    closePalette()
    setFilterType('document')
    await createNote({ type: 'document', title: '' })
  }, [closePalette, createNote, setFilterType])

  const handleCreateSnippet = React.useCallback(async () => {
    closePalette()
    setFilterType('snippet')
    await createNote({ type: 'snippet', title: '', language: 'javascript' })
  }, [closePalette, createNote, setFilterType])

  const handleOpenSettings = React.useCallback(() => {
    closePalette()
    window.api.openSettingsWindow()
  }, [closePalette])

  const buildFilterAction = React.useCallback(
    (
      id: string,
      label: string,
      subtitle: string,
      nextFilterType: 'all' | 'favorite' | 'document' | 'snippet',
      icon: PaletteEntry['icon']
    ): PaletteEntry => ({
      id,
      label,
      subtitle,
      icon,
      kind: 'action',
      run: () => {
        setFilterType(nextFilterType)
        closePalette()
      }
    }),
    [closePalette, setFilterType]
  )

  const actionEntries = React.useMemo<PaletteEntry[]>(
    () => [
      {
        id: 'action-create-document',
        label: t('search.createDocument'),
        subtitle: t('commandPalette.action.createDocument'),
        icon: PenLine,
        kind: 'action',
        run: handleCreateDocument
      },
      {
        id: 'action-create-snippet',
        label: t('search.createCode'),
        subtitle: t('commandPalette.action.createSnippet'),
        icon: Keyboard,
        kind: 'action',
        run: handleCreateSnippet
      },
      buildFilterAction(
        'action-filter-all',
        t('common.all'),
        t('commandPalette.action.filterAll'),
        'all',
        LayoutGrid
      ),
      buildFilterAction(
        'action-filter-favorite',
        t('common.favorite'),
        t('commandPalette.action.filterFavorite'),
        'favorite',
        Star
      ),
      buildFilterAction(
        'action-filter-document',
        t('common.document'),
        t('commandPalette.action.filterDocument'),
        'document',
        FileText
      ),
      buildFilterAction(
        'action-filter-snippet',
        t('common.snippet'),
        t('commandPalette.action.filterSnippet'),
        'snippet',
        CodeXml
      ),
      {
        id: 'action-open-settings',
        label: t('settings.title'),
        subtitle: t('commandPalette.action.openSettings'),
        icon: Settings,
        kind: 'action',
        run: handleOpenSettings
      }
    ],
    [buildFilterAction, handleCreateDocument, handleCreateSnippet, handleOpenSettings, t]
  )

  const noteEntries = React.useMemo<PaletteEntry[]>(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = normalizedQuery
      ? notes.filter((note) => {
          if (note.title.toLowerCase().includes(normalizedQuery)) return true
          if (stripHtml(note.content || '').toLowerCase().includes(normalizedQuery)) return true
          if (note.language?.toLowerCase().includes(normalizedQuery)) return true
          return note.tags?.some((tag) => tag.name.toLowerCase().includes(normalizedQuery)) ?? false
        })
      : notes.slice(0, 12)

    return filtered.slice(0, 12).map((note) => ({
      id: note.id,
      label: note.title || t('listItem.untitled'),
      subtitle: stripHtml(note.content || '') || t('listItem.noContent'),
      icon: note.type === 'snippet' ? CodeXml : FileText,
      kind: 'note',
      run: () => {
        setFilterType('all')
        setSelectedNote(note)
        closePalette()
      }
    }))
  }, [closePalette, notes, query, setFilterType, setSelectedNote, t])

  const visibleActionEntries = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return actionEntries
    return actionEntries.filter((entry) => {
      return (
        entry.label.toLowerCase().includes(normalizedQuery) ||
        entry.subtitle.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [actionEntries, query])

  const combinedEntries = React.useMemo(
    () => [...visibleActionEntries, ...noteEntries],
    [noteEntries, visibleActionEntries]
  )

  React.useEffect(() => {
    entryRefs.current = []
  }, [combinedEntries])

  React.useEffect(() => {
    if (!open) return
    void loadPaletteNotes()
  }, [loadPaletteNotes, open])

  React.useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 10)

    return () => window.clearTimeout(timer)
  }, [open])

  React.useEffect(() => {
    setSelectedIndex(0)
  }, [query, open])

  React.useEffect(() => {
    if (!open) return

    const activeEntry = entryRefs.current[selectedIndex]
    activeEntry?.scrollIntoView({ block: 'nearest' })
  }, [open, selectedIndex])

  React.useEffect(() => {
    return window.api.onAppCommand((command) => {
      if (command === 'new-document') {
        void handleCreateDocument()
      }

      if (command === 'new-snippet') {
        void handleCreateSnippet()
      }

      if (command === 'focus-search') {
        openPalette()
      }
    })
  }, [handleCreateDocument, handleCreateSnippet, openPalette])

  const handleInputKeyDown = React.useCallback(
    async (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, combinedEntries.length - 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        setSelectedIndex(0)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        setSelectedIndex(Math.max(combinedEntries.length - 1, 0))
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const currentEntry = combinedEntries[selectedIndex]
        if (currentEntry) {
          await currentEntry.run()
        }
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closePalette()
      }
    },
    [closePalette, combinedEntries, selectedIndex]
  )

  const renderEntry = (entry: PaletteEntry, index: number): React.JSX.Element => {
    const isActive = selectedIndex === index
    const Icon = entry.icon

    return (
      <button
        key={entry.id}
        ref={(node) => {
          entryRefs.current[index] = node
        }}
        type="button"
        onMouseEnter={() => setSelectedIndex(index)}
        onClick={() => {
          void entry.run()
        }}
        className={cn(
          'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
          isActive
            ? 'border-primary/30 bg-primary/8'
            : 'border-transparent hover:border-border/60 hover:bg-accent/40'
        )}
      >
        <div
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
            entry.kind === 'action' ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{entry.label}</div>
          <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{entry.subtitle}</div>
        </div>
        <ArrowRight
          className={cn(
            'mt-1 size-4 shrink-0 text-muted-foreground transition-opacity',
            isActive ? 'opacity-100' : 'opacity-0'
          )}
        />
      </button>
    )
  }

  return (
    <>
      <div className="border-b p-3 dark:border-border-dark">
        <button
          type="button"
          onClick={openPalette}
          className="flex h-9 w-full items-center gap-3 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent/30"
        >
          <SearchIcon className="size-4 shrink-0" />
          <span className="flex-1 text-left">{t('commandPalette.placeholder')}</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {shortcutLabel}
          </kbd>
        </button>

        <div className="mt-2 flex justify-around">
          <div className="w-[calc(50%-8px)]">
            <Button className="w-full" onClick={() => void handleCreateDocument()}>
              <PenLine />
              {t('search.createDocument')}
            </Button>
          </div>
          <div className="w-4" />
          <div className="w-[calc(50%-8px)]">
            <Button variant="outline" className="w-full" onClick={() => void handleCreateSnippet()}>
              <Keyboard />
              {t('search.createCode')}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? closePalette() : setOpen(true))}>
        <DialogContent className="max-w-2xl gap-0 p-0" showCloseButton={false}>
          <div className="border-b border-border/60 p-3">
            <div className="flex items-center gap-3 rounded-xl border border-input bg-background px-3 shadow-xs">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={t('commandPalette.placeholder')}
                className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={t('search.clear')}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          </div>

          <ScrollArea className="h-[min(68vh,34rem)]" theme="default">
            <div className="space-y-5 p-3">
              <section>
                <div className="mb-2 px-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {t('commandPalette.section.actions')}
                </div>
                <div className="space-y-1">
                  {visibleActionEntries.map((entry, index) => renderEntry(entry, index))}
                </div>
              </section>

              <section>
                <div className="mb-2 px-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {t('commandPalette.section.notes')}
                </div>
                {loadingNotes ? (
                  <div className="px-3 py-6 text-sm text-muted-foreground">{t('common.loading')}</div>
                ) : noteEntries.length > 0 ? (
                  <div className="space-y-1">
                    {noteEntries.map((entry, index) =>
                      renderEntry(entry, visibleActionEntries.length + index)
                    )}
                  </div>
                ) : (
                  <div className="px-3 py-6 text-sm text-muted-foreground">
                    {t('commandPalette.noResults')}
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default Search
