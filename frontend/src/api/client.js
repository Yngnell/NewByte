const BASE = import.meta.env.VITE_API_BASE || '/api'

function getToken() {
  try {
    const raw = localStorage.getItem('cb_token')
    return raw || ''
  } catch {
    return ''
  }
}

async function request(path, opts = {}) {
  const headers = opts.headers || {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  
  // Add cache-control headers for all requests
  headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
  headers['Pragma'] = 'no-cache'
  headers['Expires'] = '0'
  
  // Add global timestamp for cache-busting on all GET requests
  let finalPath = path
  if (opts.method !== 'POST' && opts.method !== 'PUT' && opts.method !== 'DELETE') {
    const separator = path.includes('?') ? '&' : '?'
    const timestamp = new Date().getTime()
    finalPath = `${path}${separator}_t=${timestamp}`
  }
  
  let res
  try {
    res = await fetch(`${BASE}${finalPath}`, { ...opts, headers, cache: 'no-store' })
  } catch (e) {
    const err = new Error('Network error: cannot reach server')
    err.code = 'NETWORK'
    throw err
  }
  if (!res.ok) {
    let msg = ''
    try {
      const data = await res.json()
      msg = data?.error || ''
    } catch {
      try {
        const text = await res.text()
        msg = text?.slice(0, 140) || ''
      } catch {}
    }
    const err = new Error(msg || `Request failed (${res.status} ${res.statusText})`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  checkEmail: (email) => request(`/auth/check-email/${encodeURIComponent(email)}`),
  forgotPassword: (email, guardian_name, new_password) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email, guardian_name, new_password }) }),
  lessons: (courseId) => request(`/courses/${courseId}/lessons`),
  quiz: (lessonId) => request(`/quiz/${lessonId}`),
  submitQuiz: (lessonId, answers) =>
    request(`/quiz/${lessonId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  progress: () => request('/progress'),
  getProgressMap: () => request('/progress/map'),
  saveProgressMap: (progress) =>
    request('/progress/map', { method: 'PUT', body: JSON.stringify({ progress }) }),
  getSettings: () => request('/settings'),
  saveSettings: (settings) =>
    request('/settings', { method: 'PUT', body: JSON.stringify({ settings }) }),
  getHistory: () => request('/history'),
  getRankings: () => request('/history/rankings'),
  progressRanking: () => request('/progress/ranking'),
  recordHistory: (entry) =>
    request('/history', { method: 'POST', body: JSON.stringify(entry) }),

  // ─── Admin ──────────────────────────────────────────────────
  admin: {
    getStats: () => request('/admin/stats'),
    getUsers: () => request('/admin/users'),
    updateUser: (id, data) =>
      request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    blockUser: (id) =>
      request(`/admin/users/${id}/block`, { method: 'PUT' }),
    unblockUser: (id) =>
      request(`/admin/users/${id}/unblock`, { method: 'PUT' }),
    getCourses: () => request('/admin/courses'),
    createCourse: (data) =>
      request('/admin/courses', { method: 'POST', body: JSON.stringify(data) }),
    updateCourse: (id, data) =>
      request(`/admin/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCourse: (id) =>
      request(`/admin/courses/${id}`, { method: 'DELETE' }),
    getLessons: () => request('/admin/lessons'),
    createLesson: (data) =>
      request('/admin/lessons', { method: 'POST', body: JSON.stringify(data) }),
    updateLesson: (id, data) =>
      request(`/admin/lessons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteLesson: (id) =>
      request(`/admin/lessons/${id}`, { method: 'DELETE' }),
    getQuestions: (lessonId) => request(`/admin/lessons/${lessonId}/questions`),
    addQuestion: (lessonId, { question_text, options, correct_answer, image_path, explanation }) => {
      const payload = {
        question_text,
        option_a: options[0],
        option_b: options[1],
        option_c: options[2],
        option_d: options[3],
        correct_answer: ['A', 'B', 'C', 'D'][correct_answer],
        image_path,
        explanation,
      }
      console.log(`[API] Adding question - correct_answer index: ${correct_answer} -> letter: ${payload.correct_answer}`, payload)
      return request(`/admin/lessons/${lessonId}/questions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    updateQuestion: (questionId, { question_text, options, correct_answer, image_path, explanation }) => {
      const payload = {
        question_text,
        option_a: options[0],
        option_b: options[1],
        option_c: options[2],
        option_d: options[3],
        correct_answer: ['A', 'B', 'C', 'D'][correct_answer],
        image_path,
        explanation,
      }
      console.log(`[API] Updating question ${questionId} - correct_answer index: ${correct_answer} -> letter: ${payload.correct_answer}`, payload)
      return request(`/admin/questions/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    },
    deleteQuestion: (questionId) =>
      request(`/admin/questions/${questionId}`, { method: 'DELETE' }),
    updatePassingScore: (lessonId, passing_score) =>
      request(`/admin/lessons/${lessonId}/passing-score`, {
        method: 'PUT',
        body: JSON.stringify({ passing_score }),
      }),
  },
}
