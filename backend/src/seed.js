import 'dotenv/config'
import { createPool } from './config/db.js'
import { lessons } from '../../frontend/src/data/lessons.js'
import { quizBank } from '../../frontend/src/data/quiz.js'

async function main() {
  const pool = await createPool()
  await pool.query(`
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  guardian_name VARCHAR(100) NOT NULL,
  age INT NULL,
  grade_level VARCHAR(20) NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student',
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMP NULL
);
`)
  await pool.query(`
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT
);
`)
  await pool.query(`
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  content TEXT,
  lesson_order INT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
`)
  await pool.query(`
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  lesson_id INT NOT NULL,
  passing_score INT NOT NULL DEFAULT 70,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);
`)
  await pool.query(`
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  quiz_id INT NOT NULL,
  question_text TEXT NOT NULL,
  image_path TEXT,
  option_a VARCHAR(255) NOT NULL,
  option_b VARCHAR(255) NOT NULL,
  option_c VARCHAR(255) NOT NULL,
  option_d VARCHAR(255) NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  explanation TEXT,
  paragraph_after INT DEFAULT 0,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);
`)
  await pool.query(`
CREATE TABLE IF NOT EXISTS progress (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  lesson_id INT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Locked' CHECK (status IN ('Locked','Unlocked','Completed')),
  UNIQUE (user_id, lesson_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);
`)
  await pool.query(`
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  settings_json TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`)
  await pool.query(`
CREATE TABLE IF NOT EXISTS quiz_history (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  lesson_id VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  score INT NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`)
  await pool.query(`
CREATE TABLE IF NOT EXISTS user_progress (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  progress_json TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`)

  const [courses] = await pool.query('SELECT id FROM courses')
  let courseId
  if (!courses.length) {
    const [r] = await pool.query(
      'INSERT INTO courses (title, description) VALUES (?, ?)',
      ['Computer Hardware Basics', 'Introductory hardware course for Grade 6'],
    )
    courseId = r.insertId
  } else {
    courseId = courses[0].id
  }

  const lessonsData = lessons.map((lesson, index) => ({
    key: lesson.id,
    dbId: lesson.db_id,
    title: lesson.title,
    content: lesson.summary || '',
    order: index + 1,
  }))

  for (const l of lessonsData) {
    await pool.query(
      `INSERT INTO lessons (id, course_id, title, content, lesson_order)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         course_id=EXCLUDED.course_id,
         title=EXCLUDED.title,
         content=EXCLUDED.content,
         lesson_order=EXCLUDED.lesson_order`,
      [l.dbId, courseId, l.title, l.content, l.order],
    )
  }
  await pool.query(
    "SELECT setval(pg_get_serial_sequence('lessons','id'), COALESCE((SELECT MAX(id) FROM lessons), 1), true)",
  )

  const [allLessons] = await pool.query(
    'SELECT * FROM lessons WHERE course_id=? ORDER BY lesson_order ASC',
    [courseId],
  )
  for (const l of allLessons) {
    const [qz] = await pool.query('SELECT id FROM quizzes WHERE lesson_id=?', [l.id])
    if (!qz.length) {
      const [qr] = await pool.query('INSERT INTO quizzes (lesson_id) VALUES (?)', [l.id])
      const quizId = qr.insertId
      const lessonKey = lessonsData.find((item) => item.title === l.title)?.key
      const samples = sampleQuestionsForLesson(lessonKey)
      for (const s of samples) {
        await pool.query(
          'INSERT INTO questions (quiz_id, question_text, image_path, option_a, option_b, option_c, option_d, correct_answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [quizId, s.text, s.image, s.a, s.b, s.c, s.d, s.correct, s.explanation],
        )
      }
    }
  }

  console.log('Database seeded')
  await pool.end()
}

function sampleQuestionsForLesson(lessonKey) {
  return (quizBank[lessonKey] || []).map((question) => ({
    text: question.prompt,
    image: question.image || null,
    a: question.options?.[0] || '',
    b: question.options?.[1] || '',
    c: question.options?.[2] || '',
    d: question.options?.[3] || '',
    correct: ['A', 'B', 'C', 'D'][question.answer] || 'A',
    explanation: question.explanation || null,
  }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
