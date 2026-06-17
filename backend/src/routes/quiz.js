import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const ANSWER_LETTERS = ['A', 'B', 'C', 'D']

function mapQuestion(q) {
  const correctIndex = ANSWER_LETTERS.indexOf(q.correct_answer)
  const rawOptions = [q.option_a, q.option_b, q.option_c, q.option_d]
  const options = []
  let mappedCorrect = correctIndex

  rawOptions.forEach((opt, idx) => {
    const cleaned = String(opt || '').trim()
    if (cleaned) {
      options.push(cleaned)
    } else if (idx < correctIndex) {
      mappedCorrect -= 1
    }
  })

  if (mappedCorrect < 0 || mappedCorrect >= options.length) {
    mappedCorrect = 0
  }

  return {
    id: q.id,
    question_text: q.question_text,
    image_path: q.image_path,
    options,
    correct_index: mappedCorrect,
    explanation: q.explanation || '',
    paragraph_after: q.paragraph_after || 0,
  }
}

router.get('/:lessonId', requireAuth, async (req, res) => {
  try {
    const { lessonId } = req.params
    const pool = await req.poolPromise
    
    // Add cache-busting headers
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    
    const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE lesson_id=?', [lessonId])
    if (!quizzes.length) return res.json({ questions: [], passing_score: 70 })
    const quiz = quizzes[0]
    const [qs] = await pool.query('SELECT * FROM questions WHERE quiz_id=? ORDER BY RANDOM()', [quiz.id])
    const questions = qs.map(mapQuestion)
    res.json({ questions, passing_score: quiz.passing_score || 70 })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/:lessonId/submit', requireAuth, async (req, res) => {
  try {
    const { lessonId } = req.params
    const answers = req.body.answers || []
    const userId = req.user.id
    const pool = await req.poolPromise
    const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE lesson_id=?', [lessonId])
    if (!quizzes.length) return res.status(400).json({ error: 'Quiz not found' })
    const quiz = quizzes[0]
    const [qs] = await pool.query('SELECT * FROM questions WHERE quiz_id=?', [quiz.id])
    const answerByQuestionId = new Map(
      answers
        .filter((answer) => answer && typeof answer === 'object')
        .map((answer) => [Number(answer.question_id ?? answer.id), Number(answer.answer)])
        .filter(([id]) => Number.isFinite(id)),
    )
    let correct = 0
    qs.forEach((q, i) => {
      const mapped = mapQuestion(q)
      const submitted = answerByQuestionId.size ? answerByQuestionId.get(Number(q.id)) : Number(answers[i])
      if (submitted === mapped.correct_index) correct++
    })
    const score = Math.round((correct / (qs.length || 1)) * 100)
    const status = score >= (quiz.passing_score || 70) ? 'Completed' : 'Unlocked'
    const [existing] = await pool.query(
      'SELECT id FROM progress WHERE user_id=? AND lesson_id=?',
      [userId, lessonId],
    )
    if (existing.length) {
      await pool.query('UPDATE progress SET score=?, status=? WHERE id=?', [
        score,
        status,
        existing[0].id,
      ])
    } else {
      await pool.query(
        'INSERT INTO progress (user_id, lesson_id, score, status) VALUES (?, ?, ?, ?)',
        [userId, lessonId, score, status],
      )
    }
    if (status === 'Completed') {
      const [[lesson]] = await pool.query('SELECT * FROM lessons WHERE id=?', [lessonId])
      if (lesson) {
        const [next] = await pool.query(
          'SELECT * FROM lessons WHERE course_id=? AND lesson_order=?',
          [lesson.course_id, lesson.lesson_order + 1],
        )
        if (next.length) {
          const nextId = next[0].id
          const [ex2] = await pool.query(
            'SELECT id FROM progress WHERE user_id=? AND lesson_id=?',
            [userId, nextId],
          )
          if (ex2.length) {
            await pool.query('UPDATE progress SET status=? WHERE id=?', ['Unlocked', ex2[0].id])
          } else {
            await pool.query(
              'INSERT INTO progress (user_id, lesson_id, score, status) VALUES (?, ?, ?, ?)',
              [userId, nextId, 0, 'Unlocked'],
            )
          }
        }
      }
    }
    res.json({ score, status })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
