import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const router = Router()

// Breached/weak passwords blocklist (server-side enforcement)
const BLOCKED_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '1234567', '12345678',
  '123456789', '1234567890', 'qwerty', 'qwerty123', 'abc123', 'monkey',
  'master', 'dragon', 'login', 'princess', 'football', 'shadow', 'sunshine',
  'trustno1', 'iloveyou', 'batman', 'access', 'hello', 'charlie', 'donald',
  '654321', 'letmein', 'welcome', 'admin', 'passw0rd', 'p@ssword', 'pass123',
  '111111', '000000', 'baseball', 'michael', 'jordan', 'superman', 'hunter',
  'thomas', 'ranger', 'buster', 'soccer', 'harley', 'daniel', 'robert',
  'computer', 'bytestart', 'grade6', 'student', 'school', 'teacher',
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS || 10)
const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES || 1)

function normalizeEmail(value = '') {
  return value.trim().toLowerCase()
}

router.post('/register', async (req, res) => {
  const { full_name, guardian_name, age, grade_level, email, password } = req.body
  if (!full_name || !guardian_name || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' })
  }
  const normalizedEmail = normalizeEmail(email)
  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address.' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }
  if (BLOCKED_PASSWORDS.has(password.toLowerCase())) {
    return res.status(400).json({ error: 'This password was found in data breaches. Please choose a stronger, unique password.' })
  }
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: 'Password must include at least one uppercase letter (A-Z).' })
  }
  if (!/[a-z]/.test(password)) {
    return res.status(400).json({ error: 'Password must include at least one lowercase letter (a-z).' })
  }
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must include at least one number (0-9).' })
  }
  try {
    const pool = await req.poolPromise
    const [existing] = await pool.query('SELECT id FROM users WHERE email=?', [normalizedEmail])
    if (existing.length) return res.status(409).json({ error: 'Email already registered' })
    const hash = await bcrypt.hash(password, 10)
    const [result] = await pool.query(
      'INSERT INTO users (full_name, guardian_name, age, grade_level, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [full_name, guardian_name, age || null, grade_level || null, normalizedEmail, hash, 'student'],
    )
    const userId = result.insertId
    const token = jwt.sign({ id: userId, email: normalizedEmail, role: 'student' }, process.env.JWT_SECRET || 'changeme', {
      expiresIn: '7d',
    })
    res.json({
      token,
      user: { id: userId, full_name, guardian_name, email: normalizedEmail, age, grade_level, role: 'student' },
    })
  } catch (e) {
    console.error('POST /auth/register error:', e)
    const msg = e && e.code === 'ECONNREFUSED' ? 'Database unavailable' : 'Server error'
    const status = msg === 'Database unavailable' ? 503 : 500
    res.status(status).json({ error: msg })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })
  const normalizedEmail = normalizeEmail(email)
  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address.' })
  }
  try {
    const pool = await req.poolPromise
    const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [normalizedEmail])
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' })
    const user = rows[0]
    if (user.locked_until) {
      const now = new Date()
      const lockedUntil = new Date(user.locked_until)
      if (lockedUntil > now) {
        if (lockedUntil.getFullYear() >= 2099) {
          return res.status(423).json({ error: 'Account blocked by admin.' })
        }
        const retrySeconds = Math.ceil((lockedUntil - now) / 1000)
        res.set('Retry-After', String(retrySeconds))
        return res.status(423).json({ error: 'Account locked. Try again later.', retry_after_seconds: retrySeconds })
      }
      await pool.query('UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=?', [user.id])
    }
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      const nextAttempts = (user.failed_login_attempts || 0) + 1
      if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        await pool.query('UPDATE users SET failed_login_attempts=?, locked_until=? WHERE id=?', [
          nextAttempts,
          lockedUntil,
          user.id,
        ])
        const retrySeconds = Math.ceil((lockedUntil - new Date()) / 1000)
        res.set('Retry-After', String(retrySeconds))
        return res.status(423).json({
          error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
          retry_after_seconds: retrySeconds,
        })
      }
      await pool.query('UPDATE users SET failed_login_attempts=? WHERE id=?', [nextAttempts, user.id])
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    await pool.query('UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=?', [user.id])
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'changeme', {
      expiresIn: '7d',
    })
    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        age: user.age,
        grade_level: user.grade_level,
        role: user.role,
      },
    })
  } catch (e) {
    console.error('POST /auth/login error:', e)
    const msg = e && e.code === 'ECONNREFUSED' ? 'Database unavailable' : 'Server error'
    const status = msg === 'Database unavailable' ? 503 : 500
    res.status(status).json({ error: msg })
  }
})

// Check if email is available
router.get('/check-email/:email', async (req, res) => {
  const email = normalizeEmail(req.params.email || '')
  if (!EMAIL_RE.test(email)) {
    return res.json({ available: false, reason: 'Enter a valid email address.' })
  }
  try {
    const pool = await req.poolPromise
    const [rows] = await pool.query('SELECT id FROM users WHERE email=?', [email])
    res.json({ available: rows.length === 0 })
  } catch {
    res.json({ available: true }) // fail-open so form isn't blocked
  }
})

// Reset password using guardian_name as identity verification
router.post('/forgot-password', async (req, res) => {
  const { email, guardian_name, new_password } = req.body
  if (!email || !guardian_name || !new_password) {
    return res.status(400).json({ error: 'Missing fields' })
  }
  const normalizedEmail = normalizeEmail(email)
  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address.' })
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }
  if (BLOCKED_PASSWORDS.has(new_password.toLowerCase())) {
    return res.status(400).json({ error: 'This password was found in data breaches. Please choose a stronger, unique password.' })
  }
  if (!/[A-Z]/.test(new_password)) {
    return res.status(400).json({ error: 'Password must include at least one uppercase letter (A-Z).' })
  }
  if (!/[a-z]/.test(new_password)) {
    return res.status(400).json({ error: 'Password must include at least one lowercase letter (a-z).' })
  }
  if (!/[0-9]/.test(new_password)) {
    return res.status(400).json({ error: 'Password must include at least one number (0-9).' })
  }
  try {
    const pool = await req.poolPromise
    // Step 1: Check if user exists
    const [rows] = await pool.query(
      'SELECT id, guardian_name FROM users WHERE email=?',
      [normalizedEmail]
    )

    if (!rows.length) {
      return res.status(400).json({ error: 'Account not found with that information.' })
    }

    const user = rows[0]

    // Step 2: Verify guardian name (case-insensitive, whitespace-tolerant)
    const dbGuardianName = user.guardian_name ? user.guardian_name.trim().toLowerCase() : ''
    const providedGuardianName = guardian_name.trim().toLowerCase()

    if (!dbGuardianName || dbGuardianName !== providedGuardianName) {
      return res.status(400).json({ error: 'Guardian Name does not match our records.' })
    }

    // Update password
    const hash = await bcrypt.hash(new_password, 10)
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, user.id])

    res.json({ message: 'Password updated successfully. You can now log in.' })
  } catch (e) {
    console.error('POST /auth/forgot-password error:', e)
    const msg = e && e.code === 'ECONNREFUSED' ? 'Database unavailable' : 'Server error'
    const status = msg === 'Database unavailable' ? 503 : 500
    res.status(status).json({ error: msg })
  }
})

export default router
