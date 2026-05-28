import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const pool = await req.poolPromise
    const [rows] = await pool.query(
      'SELECT lesson_id, status, score FROM progress WHERE user_id=?',
      [userId],
    )
    res.json({ progress: rows })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// ---- Progress Map (JSON blob, works with frontend string lesson IDs) ----

async function ensureProgressMapTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      progress_json TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
}

// GET /api/progress/map – load full progress map as JSON
router.get('/map', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const pool = await req.poolPromise
    await ensureProgressMapTable(pool)
    const [rows] = await pool.query(
      'SELECT progress_json FROM user_progress WHERE user_id=?',
      [userId],
    )
    if (rows.length && rows[0].progress_json) {
      res.json({ progress: JSON.parse(rows[0].progress_json) })
    } else {
      res.json({ progress: null })
    }
  } catch (e) {
    console.error('GET /progress/map error:', e)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/progress/map – save full progress map as JSON
router.put('/map', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const progressJson = JSON.stringify(req.body.progress || {})
    const pool = await req.poolPromise
    await ensureProgressMapTable(pool)
    const [existing] = await pool.query(
      'SELECT id FROM user_progress WHERE user_id=?',
      [userId],
    )
    if (existing.length) {
      await pool.query(
        'UPDATE user_progress SET progress_json=? WHERE user_id=?',
        [progressJson, userId],
      )
    } else {
      await pool.query(
        'INSERT INTO user_progress (user_id, progress_json) VALUES (?, ?)',
        [userId, progressJson],
      )
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('PUT /progress/map error:', e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
