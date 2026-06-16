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
  } catch (e) {
    console.error('GET /history/list error:', e)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/history – record a quiz attempt
router.get('/rankings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const pool = await req.poolPromise
    const [rows] = await pool.query(`
      WITH best_per_lesson AS (
        SELECT
          user_id,
          lesson_id,
          MAX(score) AS best_score,
          BOOL_OR(passed) AS passed
        FROM quiz_history
        GROUP BY user_id, lesson_id
      ),
      attempt_counts AS (
        SELECT user_id, COUNT(*) AS attempts
        FROM quiz_history
        GROUP BY user_id
      ),
      ranked_users AS (
        SELECT
          u.id,
          u.full_name,
          u.email,
          COALESCE(COUNT(b.lesson_id), 0)::int AS quizzes_taken,
          COALESCE(SUM(CASE WHEN b.passed THEN 1 ELSE 0 END), 0)::int AS quizzes_passed,
          COALESCE(ROUND(AVG(b.best_score)), 0)::int AS average_score,
          COALESCE(SUM(b.best_score), 0)::int AS total_score,
          COALESCE(a.attempts, 0)::int AS attempts,
          RANK() OVER (
            ORDER BY
              COALESCE(SUM(CASE WHEN b.passed THEN 1 ELSE 0 END), 0) DESC,
              COALESCE(ROUND(AVG(b.best_score)), 0) DESC,
              COALESCE(SUM(b.best_score), 0) DESC,
              COALESCE(a.attempts, 0) ASC,
              u.id ASC
          )::int AS rank
        FROM users u
        LEFT JOIN best_per_lesson b ON b.user_id = u.id
        LEFT JOIN attempt_counts a ON a.user_id = u.id
        WHERE u.role = 'student'
        GROUP BY u.id, u.full_name, u.email, a.attempts
      )
      SELECT *
      FROM ranked_users
      ORDER BY rank ASC, id ASC
      LIMIT 100
    `)
    const currentUser = rows.find((row) => String(row.id) === String(userId)) || null
    res.json({ rankings: rows, currentUser })
  } catch (e) {
    console.error('GET /history error:', e)
    res.status(500).json({ error: 'Server error' })
  }
})

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
  } catch (e) {
    console.error('POST /history error:', e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
