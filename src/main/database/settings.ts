import { getDatabase } from './index'

export const AI_SYSTEM_PROMPT_SETTING_KEY = 'ai.systemPrompt'

interface SettingRow {
  key: string
  value: string
  updated_at: string
}

export function getSetting(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT key, value, updated_at FROM settings WHERE key = ?').get(key) as
    | SettingRow
    | undefined

  return row?.value ?? null
}

export function setSetting(key: string, value: string): string {
  const db = getDatabase()
  const normalizedValue = value.trim()
  const now = new Date().toISOString()

  if (!normalizedValue) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key)
    return ''
  }

  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).run(key, normalizedValue, now)

  return normalizedValue
}
