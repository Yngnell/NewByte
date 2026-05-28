import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireAdmin)

// ─── Dashboard Stats ────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const pool = await req.poolPromise
    const [[{ users }]] = await pool.query('SELECT COUNT(*)::int AS users FROM users')
    const [[{ lessons }]] = await pool.query('SELECT COUNT(*)::int AS lessons FROM lessons')
    const [[{ quizzes }]] = await pool.query('SELECT COUNT(*)::int AS quizzes FROM quizzes')
    const [[{ questions }]] = await pool.query('SELECT COUNT(*)::int AS questions FROM questions')
    res.json({ stats: { users, lessons, quizzes, questions } })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── Users ──────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const pool = await req.poolPromise
    const [users] = await pool.query(
      `SELECT
        id,
        full_name,
        guardian_name,
        age,
        grade_level,
        email,
        role,
        locked_until,
        CASE WHEN locked_until IS NOT NULL AND locked_until > NOW() THEN 1 ELSE 0 END AS is_blocked
       FROM users`
    )
    res.json({ users })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/users/:id', async (req, res) => {
  try {
    const pool = await req.poolPromise
    const fields = []
    const values = []
    const allowed = ['role', 'full_name', 'guardian_name', 'grade_level', 'age']
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key}=?`)
        values.push(req.body[key])
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' })
    values.push(req.params.id)
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id=?`, values)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/users/:id', async (req, res) => {
  res.status(405).json({ error: 'User deletion is disabled. Block the account instead.' })
})

router.put('/users/:id/block', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ error: 'You cannot block yourself' })
    }
    const pool = await req.poolPromise
    await pool.query(
      'UPDATE users SET locked_until=?, failed_login_attempts=0 WHERE id=?',
      ['2099-12-31 23:59:59', req.params.id]
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/users/:id/unblock', async (req, res) => {
  try {
    const pool = await req.poolPromise
    await pool.query(
      'UPDATE users SET locked_until=NULL, failed_login_attempts=0 WHERE id=?',
      [req.params.id]
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── Courses ────────────────────────────────────────────────────
router.get('/courses', async (req, res) => {
  try {
    const pool = await req.poolPromise
    const [courses] = await pool.query('SELECT * FROM courses')
    res.json({ courses })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/courses', async (req, res) => {
  try {
    const { title, description } = req.body
    if (!title) return res.status(400).json({ error: 'Title is required' })
    const pool = await req.poolPromise
    const [r] = await pool.query('INSERT INTO courses (title, description) VALUES (?, ?)', [
      title,
      description || null,
    ])
    res.json({ ok: true, id: r.insertId })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/courses/:id', async (req, res) => {
  try {
    const { title, description } = req.body
    const pool = await req.poolPromise
    await pool.query('UPDATE courses SET title=?, description=? WHERE id=?', [
      title,
      description || null,
      req.params.id,
    ])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/courses/:id', async (req, res) => {
  try {
    const pool = await req.poolPromise
    await pool.query('DELETE FROM courses WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── Lessons ────────────────────────────────────────────────────
router.get('/lessons', async (req, res) => {
  try {
    const pool = await req.poolPromise
    const [lessons] = await pool.query(
      `SELECT l.*, c.title AS courseTitle
       FROM lessons l LEFT JOIN courses c ON l.course_id = c.id
       ORDER BY l.lesson_order ASC`
    )
    res.json({ lessons })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/lessons', async (req, res) => {
  try {
    const { course_id, title, content, lesson_order } = req.body
    if (!course_id || !title || !content) {
      return res.status(400).json({ error: 'course_id, title, and content are required' })
    }
    const pool = await req.poolPromise
    const [r] = await pool.query(
      'INSERT INTO lessons (course_id, title, content, lesson_order) VALUES (?, ?, ?, ?)',
      [course_id, title, content, lesson_order || 1]
    )
    const lessonId = r.insertId
    // Auto-create quiz row
    await pool.query('INSERT INTO quizzes (lesson_id) VALUES (?)', [lessonId])
    res.json({ ok: true, id: lessonId })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/lessons/:id', async (req, res) => {
  try {
    const { course_id, title, content, lesson_order } = req.body
    const pool = await req.poolPromise
    await pool.query(
      'UPDATE lessons SET course_id=?, title=?, content=?, lesson_order=? WHERE id=?',
      [course_id, title, content, lesson_order, req.params.id]
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/lessons/:id', async (req, res) => {
  try {
    const pool = await req.poolPromise
    await pool.query('DELETE FROM lessons WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── Quiz Questions ─────────────────────────────────────────────
router.get('/lessons/:lessonId/questions', async (req, res) => {
  try {
    const pool = await req.poolPromise
    
    // Add cache-busting headers
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    
    const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE lesson_id=?', [
      req.params.lessonId,
    ])
    if (!quizzes.length) return res.json({ questions: [], passing_score: 70 })
    const quiz = quizzes[0]
    const [qs] = await pool.query('SELECT * FROM questions WHERE quiz_id=?', [quiz.id])
    const questions = qs.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      correct_answer: ['A', 'B', 'C', 'D'].indexOf(q.correct_answer),
      image_path: q.image_path || null,
      explanation: q.explanation || null,
      paragraph_after: q.paragraph_after || 0,
    }))
    res.json({ questions, passing_score: quiz.passing_score || 70 })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/lessons/:lessonId/questions', async (req, res) => {
  try {
    const { question_text, option_a, option_b, option_c, option_d, correct_answer, image_path, explanation } = req.body
    const text = String(question_text || '').trim()
    const optionA = String(option_a || '').trim()
    const optionB = String(option_b || '').trim()
    const optionC = String(option_c || '').trim()
    const optionD = String(option_d || '').trim()
    const isBinary = !optionC && !optionD && ['A', 'B'].includes(correct_answer)
    const hasRequired = text && optionA && optionB && (isBinary || (optionC && optionD))
    if (!hasRequired || !['A', 'B', 'C', 'D'].includes(correct_answer)) {
      return res.status(400).json({ error: 'Missing required question fields' })
    }
    const pool = await req.poolPromise
    let [quizzes] = await pool.query('SELECT id FROM quizzes WHERE lesson_id=?', [
      req.params.lessonId,
    ])
    // Auto-create quiz if it doesn't exist
    if (!quizzes.length) {
      const [result] = await pool.query('INSERT INTO quizzes (lesson_id) VALUES (?)', [req.params.lessonId])
      quizzes = [{ id: result.insertId }]
    }
    const [r] = await pool.query(
      'INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_answer, image_path, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [quizzes[0].id, text, optionA, optionB, optionC, optionD, correct_answer, image_path || null, explanation || null]
    )
    res.json({ ok: true, id: r.insertId })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/questions/:id', async (req, res) => {
  try {
    const { question_text, option_a, option_b, option_c, option_d, correct_answer, image_path, explanation } = req.body
    const text = String(question_text || '').trim()
    const optionA = String(option_a || '').trim()
    const optionB = String(option_b || '').trim()
    const optionC = String(option_c || '').trim()
    const optionD = String(option_d || '').trim()
    const isBinary = !optionC && !optionD && ['A', 'B'].includes(correct_answer)
    const hasRequired = text && optionA && optionB && (isBinary || (optionC && optionD))
    if (!hasRequired || !['A', 'B', 'C', 'D'].includes(correct_answer)) {
      return res.status(400).json({ error: 'Missing required question fields' })
    }
    const pool = await req.poolPromise
    await pool.query(
      'UPDATE questions SET question_text=?, option_a=?, option_b=?, option_c=?, option_d=?, correct_answer=?, image_path=?, explanation=? WHERE id=?',
      [text, optionA, optionB, optionC, optionD, correct_answer, image_path || null, explanation || null, req.params.id]
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/questions/:id', async (req, res) => {
  try {
    const pool = await req.poolPromise
    await pool.query('DELETE FROM questions WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── Passing Score ──────────────────────────────────────────────
router.put('/lessons/:lessonId/passing-score', async (req, res) => {
  try {
    const { passing_score } = req.body
    if (passing_score === undefined) return res.status(400).json({ error: 'passing_score is required' })
    const pool = await req.poolPromise
    await pool.query('UPDATE quizzes SET passing_score=? WHERE lesson_id=?', [
      passing_score,
      req.params.lessonId,
    ])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
