import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createPool } from './config/db.js'
import authRouter from './routes/auth.js'
import coursesRouter from './routes/courses.js'
import quizRouter from './routes/quiz.js'
import progressRouter from './routes/progress.js'
import settingsRouter from './routes/settings.js'
import historyRouter from './routes/history.js'
import adminRouter from './routes/admin.js'

const app = express()

// Basic request logging to help debug in production logs
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`)
  next()
})

app.use(cors())
app.use(express.json())

// Capture unhandled errors so Railway logs show stack traces
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})

const poolPromise = createPool()
app.use((req, res, next) => {
  req.poolPromise = poolPromise
  next()
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/courses', coursesRouter)
app.use('/api/quiz', quizRouter)
app.use('/api/progress', progressRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/history', historyRouter)
app.use('/api/admin', adminRouter)

// Express error handler to log stack traces for uncaught route errors
app.use((err, req, res, next) => {
  console.error('Express error handler:', err)
  if (!res.headersSent) {
    res.status(500).json({ error: 'Server error' })
  } else {
    next(err)
  }
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`ByteStart API listening on http://localhost:${port}`)
})
