import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/history – load quiz attempt history
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const pool = await req.poolPromise
    const [rows] = await pool.query(
      'SELECT lesson_id AS lessonId, title, score, passed, attempted_at AS date FROM quiz_history WHERE user_id=? ORDER BY attempted_at DESC LIMIT 200',
      [userId],
    )
    res.json({ history: rows })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/history – record a quiz attempt
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { lessonId, title, score, passed } = req.body
    if (!lessonId || score == null) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const pool = await req.poolPromise
    await pool.query(
      'INSERT INTO quiz_history (user_id, lesson_id, title, score, passed) VALUES (?, ?, ?, ?, ?)',
      [userId, lessonId, title || lessonId, score, Boolean(passed)],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
