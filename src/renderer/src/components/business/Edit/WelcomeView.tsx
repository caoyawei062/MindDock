import React, { useEffect, useMemo, useState } from 'react'
import {
  FileText,
  CodeXml,
  Sparkles,
  Shield,
  Keyboard,
  Star,
  Tags,
  Trash2,
  Database
} from 'lucide-react'
import logoSrc from '@/assets/logo.png'
import type { Note, Tag } from '@renderer/provider/ListProvider'
import { useI18n } from '@renderer/provider/I18nProvider'

interface WorkspaceStats {
  notes: Note[]
  trashedNotes: Note[]
  tags: Tag[]
}

const WelcomeView: React.FC = () => {
  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats | null>(null)
  const { formatNumber, t } = useI18n()

  useEffect(() => {
    const loadWorkspaceStats = async (): Promise<void> => {
      const [notes, trashedNotes, tags] = await Promise.all([
        window.api.notesGetAllWithTags(undefined, undefined),
        window.api.notesGetTrashedWithTags(),
        window.api.tagsGetAll()
      ])

      setWorkspaceStats({ notes, trashedNotes, tags })
    }

    void loadWorkspaceStats()
  }, [])

  const stats = useMemo(() => {
    if (!workspaceStats) return []

    const { notes, trashedNotes, tags } = workspaceStats
    const documents = notes.filter((note) => note.type === 'document').length
    const snippets = notes.filter((note) => note.type === 'snippet').length
    const favorites = notes.filter((note) => note.is_favorite === 1).length
    const words = notes.reduce((total, note) => total + note.word_count, 0)

    return [
      { icon: Database, label: t('welcome.stats.total'), value: notes.length },
      { icon: FileText, label: t('welcome.stats.documents'), value: documents },
      { icon: CodeXml, label: t('welcome.stats.snippets'), value: snippets },
      { icon: Star, label: t('welcome.stats.favorites'), value: favorites },
      { icon: Tags, label: t('welcome.stats.tags'), value: tags.length },
      { icon: Trash2, label: t('welcome.stats.trash'), value: trashedNotes.length },
      { icon: Sparkles, label: t('welcome.stats.words'), value: formatNumber(words) }
    ]
  }, [formatNumber, t, workspaceStats])

  const features = [
    {
      icon: FileText,
      title: t('welcome.feature.richText.title'),
      description: t('welcome.feature.richText.description')
    },
    {
      icon: CodeXml,
      title: t('welcome.feature.snippets.title'),
      description: t('welcome.feature.snippets.description')
    },
    {
      icon: Keyboard,
      title: t('welcome.feature.shortcuts.title'),
      description: t('welcome.feature.shortcuts.description')
    },
    {
      icon: Shield,
      title: t('welcome.feature.localFirst.title'),
      description: t('welcome.feature.localFirst.description')
    }
  ]

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      {/* Logo 和标题 */}
      <div className="flex flex-col items-center mb-12">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-primary/12 blur-2xl dark:bg-primary/20" />
          <div className="absolute inset-2 rounded-[1.6rem] bg-black/8 blur-xl dark:bg-black/25" />
          <img
            src={logoSrc}
            alt="MindDock Logo"
            className="relative size-20 rounded-3xl ring-1 ring-black/6 shadow-[0_14px_28px_rgba(15,23,42,0.12),0_4px_10px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] dark:ring-white/8 dark:shadow-[0_14px_30px_rgba(0,0,0,0.34),0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.22)]"
          />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
          MindDock
        </h1>
        <p className="text-muted-foreground text-center max-w-md">{t('welcome.subtitle')}</p>
      </div>

      {/* 工作台统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl w-full mb-8">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border/50 bg-card/60 px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <item.icon size={14} className="text-primary" />
              <span>{item.label}</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight">{item.value}</div>
          </div>
        ))}
      </div>

      {/* 特性网格 */}
      <div className="grid grid-cols-2 gap-4 max-w-lg mb-12">
        {features.map((feature, index) => (
          <div
            key={index}
            className="group p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-border transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <feature.icon size={18} />
              </div>
              <div>
                <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 快速开始提示 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles size={14} className="text-primary" />
        <span>{t('welcome.quickStart')}</span>
      </div>

      {/* 快捷键提示 */}
      <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground/70">
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">⌘</kbd>
          <span>+</span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">N</kbd>
          <span>{t('welcome.shortcut.newDocument')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">⌘</kbd>
          <span>+</span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">K</kbd>
          <span>{t('welcome.shortcut.quickSearch')}</span>
        </div>
      </div>
    </div>
  )
}

export default WelcomeView
