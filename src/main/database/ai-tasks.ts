import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from './index'
import { createNote, getNoteById, updateNote } from './notes'
import type {
  AITask,
  AITaskOutput,
  AITaskSource,
  CreateAITaskParams,
  CreateAITaskOutputParams,
  CreateAITaskSourceParams,
  UpdateAITaskParams
} from '../../shared/types/ai'

export type {
  AITask,
  AITaskOutput,
  AITaskSource,
  CreateAITaskParams,
  CreateAITaskOutputParams,
  CreateAITaskSourceParams,
  UpdateAITaskParams
}

function plainTextToHtml(content: string): string {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const escaped = block
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br />')
      return `<p>${escaped}</p>`
    })
    .join('')
}

export function getAllAITasks(noteId?: string): AITask[] {
  const db = getDatabase()

  if (!noteId) {
    return db
      .prepare('SELECT * FROM ai_tasks ORDER BY updated_at DESC, created_at DESC')
      .all() as AITask[]
  }

  // 直接通过 note_id 查询，不再需要 JOIN
  return db
    .prepare('SELECT * FROM ai_tasks WHERE note_id = ? ORDER BY updated_at DESC, created_at DESC')
    .all(noteId) as AITask[]
}

export function getAITaskById(id: string): AITask | null {
  const db = getDatabase()
  const task = db.prepare('SELECT * FROM ai_tasks WHERE id = ?').get(id) as AITask | undefined
  return task || null
}

export function createAITask(params: CreateAITaskParams): AITask {
  const db = getDatabase()
  const now = new Date().toISOString()

  const task: AITask = {
    id: uuidv4(),
    title: params.title?.trim() || '未命名 AI 任务',
    goal: params.goal.trim(),
    status: 'idle',
    mode: params.mode || 'one_shot',
    summary: null,
    model_id: params.model_id || null,
    note_id: params.note_id || null,
    error_message: null,
    last_run_at: null,
    created_at: now,
    updated_at: now
  }

  db.prepare(
    `
      INSERT INTO ai_tasks (
        id, title, goal, status, mode, summary, model_id, note_id, error_message,
        last_run_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    task.id,
    task.title,
    task.goal,
    task.status,
    task.mode,
    task.summary,
    task.model_id,
    task.note_id,
    task.error_message,
    task.last_run_at,
    task.created_at,
    task.updated_at
  )

  return task
}

export function updateAITask(id: string, params: UpdateAITaskParams): AITask | null {
  const db = getDatabase()
  const existing = getAITaskById(id)
  if (!existing) return null

  const nextTask: AITask = {
    ...existing,
    ...params,
    updated_at: new Date().toISOString()
  }

  db.prepare(
    `
      UPDATE ai_tasks SET
        title = ?,
        goal = ?,
        status = ?,
        mode = ?,
        summary = ?,
        model_id = ?,
        error_message = ?,
        last_run_at = ?,
        updated_at = ?
      WHERE id = ?
    `
  ).run(
    nextTask.title,
    nextTask.goal,
    nextTask.status,
    nextTask.mode,
    nextTask.summary,
    nextTask.model_id,
    nextTask.error_message,
    nextTask.last_run_at,
    nextTask.updated_at,
    id
  )

  return nextTask
}

export function deleteAITask(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM ai_tasks WHERE id = ?').run(id)
  return result.changes > 0
}

export function getAITaskSources(taskId: string): AITaskSource[] {
  const db = getDatabase()
  return db
    .prepare('SELECT * FROM ai_task_sources WHERE task_id = ? ORDER BY created_at ASC')
    .all(taskId) as AITaskSource[]
}

export function replaceAITaskSources(
  taskId: string,
  sources: CreateAITaskSourceParams[]
): AITaskSource[] {
  const db = getDatabase()
  const now = new Date().toISOString()

  const replaceTransaction = db.transaction(() => {
    db.prepare('DELETE FROM ai_task_sources WHERE task_id = ?').run(taskId)

    const insert = db.prepare(
      `
        INSERT INTO ai_task_sources (
          id, task_id, source_type, source_id, role, label, content_snapshot, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )

    return sources.map((source) => {
      const item: AITaskSource = {
        id: uuidv4(),
        task_id: taskId,
        source_type: source.source_type,
        source_id: source.source_id || null,
        role: source.role,
        label: source.label || null,
        content_snapshot: source.content_snapshot || null,
        created_at: now
      }
      insert.run(
        item.id,
        item.task_id,
        item.source_type,
        item.source_id,
        item.role,
        item.label,
        item.content_snapshot,
        item.created_at
      )
      return item
    })
  })

  return replaceTransaction()
}

export function getAITaskOutputs(taskId: string): AITaskOutput[] {
  const db = getDatabase()
  return db
    .prepare('SELECT * FROM ai_task_outputs WHERE task_id = ? ORDER BY created_at ASC')
    .all(taskId) as AITaskOutput[]
}

export function replaceAITaskOutputs(
  taskId: string,
  outputs: CreateAITaskOutputParams[]
): AITaskOutput[] {
  const db = getDatabase()
  const now = new Date().toISOString()

  const replaceTransaction = db.transaction(() => {
    db.prepare('DELETE FROM ai_task_outputs WHERE task_id = ?').run(taskId)

    const insert = db.prepare(
      `
        INSERT INTO ai_task_outputs (
          id, task_id, output_type, title, content, meta_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )

    return outputs.map((output) => {
      const item: AITaskOutput = {
        id: uuidv4(),
        task_id: taskId,
        output_type: output.output_type,
        title: output.title || null,
        content: output.content,
        meta_json: output.meta_json || null,
        status: output.status || 'draft',
        created_at: now,
        updated_at: now
      }

      insert.run(
        item.id,
        item.task_id,
        item.output_type,
        item.title,
        item.content,
        item.meta_json,
        item.status,
        item.created_at,
        item.updated_at
      )

      return item
    })
  })

  return replaceTransaction()
}

export function acceptAITaskOutput(
  taskId: string,
  outputId: string,
  target: 'new_note' | 'append_current' | 'new_snippet',
  noteId?: string
): { success: boolean; noteId?: string; error?: string } {
  const db = getDatabase()
  const output = db
    .prepare('SELECT * FROM ai_task_outputs WHERE id = ? AND task_id = ?')
    .get(outputId, taskId) as AITaskOutput | undefined

  if (!output) {
    throw new Error('AI task output not found')
  }

  let acceptedNoteId: string | undefined

  if (target === 'new_note') {
    const note = createNote({
      title: output.title || 'AI 任务结果',
      content: plainTextToHtml(output.content),
      type: 'document'
    })
    acceptedNoteId = note.id
  } else if (target === 'new_snippet') {
    const meta = output.meta_json ? (JSON.parse(output.meta_json) as { language?: string }) : {}
    const note = createNote({
      title: output.title || 'AI 生成片段',
      content: output.content,
      type: 'snippet',
      language: meta.language || 'plaintext'
    })
    acceptedNoteId = note.id
  } else {
    if (!noteId) {
      throw new Error('Target note id is required')
    }

    const note = getNoteById(noteId)
    if (!note) {
      throw new Error('Target note not found')
    }

    const separator =
      note.type === 'document' ? '<hr /><p>AI 任务结果</p>' : '\n\n// AI 任务结果\n'
    const appendedContent =
      note.type === 'document'
        ? `${note.content}${separator}${plainTextToHtml(output.content)}`
        : `${note.content}${separator}${output.content}`

    const updated = updateNote(note.id, { content: appendedContent })
    acceptedNoteId = updated?.id || note.id
  }

  db.prepare(
    `
      UPDATE ai_task_outputs
      SET status = ?, updated_at = ?
      WHERE id = ? AND task_id = ?
    `
  ).run('accepted', new Date().toISOString(), outputId, taskId)

  return {
    success: true,
    noteId: acceptedNoteId
  }
}
