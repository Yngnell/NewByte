import 'dotenv/config'
import { createPool } from '../src/config/db.js'
import { lessons } from '../../frontend/src/data/lessons.js'
import { quizBank } from '../../frontend/src/data/quiz.js'

async function ensureCourse(pool) {
  const title = 'CompuBasics Grade 6'
  const [existing] = await pool.query('SELECT id FROM courses WHERE title=? LIMIT 1', [title])
  if (existing.length) return existing[0].id

  const [result] = await pool.query(
    'INSERT INTO courses (title, description) VALUES (?, ?)',
    [title, 'Synced from frontend lesson content']
  )
  return result.insertId
}

async function ensureLesson(pool, courseId, lesson, order) {
  const [existing] = await pool.query(
    'SELECT id FROM lessons WHERE id=? LIMIT 1',
    [lesson.db_id]
  )

  const contentSummary = JSON.stringify({
    summary: lesson.summary,
    points: lesson.points || [],
  })

  if (existing.length) {
    await pool.query(
      'UPDATE lessons SET title=?, content=?, lesson_order=? WHERE id=?',
      [lesson.title, contentSummary, order, existing[0].id]
    )
    return existing[0].id
  }

  const [result] = await pool.query(
    'INSERT INTO lessons (id, course_id, title, content, lesson_order) VALUES (?, ?, ?, ?, ?)',
    [lesson.db_id, courseId, lesson.title, contentSummary, order]
  )
  return result.insertId
}

async function ensureQuiz(pool, lessonDbId) {
  const [existing] = await pool.query('SELECT id FROM quizzes WHERE lesson_id=? LIMIT 1', [lessonDbId])
  if (existing.length) return existing[0].id

  const [result] = await pool.query(
    'INSERT INTO quizzes (lesson_id, passing_score) VALUES (?, ?)',
    [lessonDbId, 70]
  )
  return result.insertId
}

async function syncQuestions(pool, quizId, lessonKey) {
  const sourceQuestions = quizBank[lessonKey] || []

  await pool.query('DELETE FROM questions WHERE quiz_id=?', [quizId])

  for (const question of sourceQuestions) {
    const options = [...question.options]
    while (options.length < 4) options.push('')
    const correctAnswer = ['A', 'B', 'C', 'D'][question.answer] || 'A'

    await pool.query(
      `INSERT INTO questions
        (quiz_id, question_text, image_path, option_a, option_b, option_c, option_d, correct_answer, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quizId,
        question.prompt,
        question.image || null,
        options[0] || '',
        options[1] || '',
        options[2] || '',
        options[3] || '',
        correctAnswer,
        question.explanation || null,
      ]
    )
  }
}

async function run() {
  const pool = await createPool()

  try {
    const courseId = await ensureCourse(pool)

    for (const [index, lesson] of lessons.entries()) {
      const lessonDbId = await ensureLesson(pool, courseId, lesson, index + 1)
      const quizId = await ensureQuiz(pool, lessonDbId)
      await syncQuestions(pool, quizId, lesson.id)
      console.log(`Synced ${lesson.title}`)
    }
    await pool.query(
      "SELECT setval(pg_get_serial_sequence('lessons','id'), COALESCE((SELECT MAX(id) FROM lessons), 1), true)"
    )

    console.log('Frontend lessons and quizzes synced to database successfully.')
  } catch (error) {
    console.error('Sync failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

run()
