import { useState, useEffect, useMemo } from 'react'
import { api } from '../../api/client.js'
import Modal from '../../components/ui/Modal.jsx'
import { useToast } from '../../components/Toast.jsx'

const emptyQ = { question_text: '', options: ['', '', '', ''], correct_answer: 0, image_path: '', explanation: '', difficulty: 'medium' }

export default function AdminQuizzes() {
  const { showToast } = useToast()
  const [lessons, setLessons] = useState([])
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [questions, setQuestions] = useState([])
  const [passingScore, setPassingScore] = useState(70)
  const [scoreDirty, setScoreDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [qLoading, setQLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyQ)
  const [deleteId, setDeleteId] = useState(null)
  const [query, setQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedQuestions, setSelectedQuestions] = useState(new Set())

  useEffect(() => {
    api.admin.getLessons()
      .then(r => { setLessons(r.lessons); setLoading(false) })
      .catch(e => { showToast(e.message, 'error'); setLoading(false) })
  }, [])

  async function loadQuestions(lessonId) {
    try {
      setQLoading(true)
      console.log(`[Admin] Loading questions for lesson ${lessonId}...`)
      const r = await api.admin.getQuestions(lessonId)
      console.log(`[Admin] Loaded ${r.questions?.length || 0} questions:`, r.questions)
      setQuestions(r.questions)
      setCurrentQuestionIndex(0)
      const scoreValue = Number(r.passing_score)
      setPassingScore(Number.isFinite(scoreValue) ? scoreValue : 70)
      setScoreDirty(false)
    } catch (e) { 
      console.error(`[Admin] Error loading questions:`, e)
      showToast(e.message, 'error') 
    }
    finally { setQLoading(false) }
  }

  function selectLesson(l) {
    setSelectedLesson(l)
    setQuery('')
    setDifficultyFilter('all')
    setCurrentQuestionIndex(0)
    loadQuestions(l.id)
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyQ })
    setShowModal(true)
  }
  function openEdit(q) {
    setEditing(q)
    const normalized = q.options.map((opt) => opt || '')
    setForm({ question_text: q.question_text, options: normalized, correct_answer: q.correct_answer, image_path: q.image_path || '', explanation: q.explanation || '', difficulty: q.difficulty || 'medium' })
    setShowModal(true)
  }

  function updateOption(idx, val) {
    setForm(f => {
      const opts = [...f.options]
      opts[idx] = val
      return { ...f, options: opts }
    })
  }

  async function duplicateQuestion(q) {
    try {
      const dup = {
        question_text: q.question_text + ' (Copy)',
        options: [...q.options],
        correct_answer: q.correct_answer,
        image_path: q.image_path || '',
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium'
      }
      await api.admin.addQuestion(selectedLesson.id, dup)
      showToast('Question duplicated ✓', 'success')
      loadQuestions(selectedLesson.id)
    } catch (e) { showToast(e.message, 'error') }
  }

  async function moveQuestion(id, direction) {
    const idx = questions.findIndex(q => q.id === id)
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === questions.length - 1)) return
    
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    const newQuestions = [...questions]
    [newQuestions[idx], newQuestions[newIdx]] = [newQuestions[newIdx], newQuestions[idx]]
    setQuestions(newQuestions)
    showToast(`Question moved ${direction} ✓`, 'success')
  }

  function toggleSelectQuestion(id) {
    const newSet = new Set(selectedQuestions)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedQuestions(newSet)
  }

  async function bulkDeleteSelected() {
    if (selectedQuestions.size === 0) return
    if (!window.confirm(`Delete ${selectedQuestions.size} selected questions?`)) return
    
    try {
      for (const id of selectedQuestions) {
        await api.admin.deleteQuestion(id)
      }
      showToast(`${selectedQuestions.size} questions deleted ✓`, 'success')
      setSelectedQuestions(new Set())
      loadQuestions(selectedLesson.id)
    } catch (e) { showToast(e.message, 'error') }
  }

  async function save() {
    if (!form.question_text.trim()) { showToast('Question text is required', 'error'); return }
    const isTF = form.options[0]?.trim() === 'True' && form.options[1]?.trim() === 'False' && !form.options[2]?.trim() && !form.options[3]?.trim()
    const requiredCount = isTF ? 2 : 4
    if (form.options.slice(0, requiredCount).some(o => !o.trim())) { 
      showToast(`All ${requiredCount} options are required`, 'error')
      return 
    }
    if (isTF && form.correct_answer > 1) {
      showToast('True/False questions must use A or B as the correct answer.', 'error')
      return
    }
    try {
      if (editing) {
        console.log(`[Admin] Updating question ${editing.id}:`, form)
        await api.admin.updateQuestion(editing.id, form)
        console.log(`[Admin] Question ${editing.id} updated successfully`)
        showToast('Question updated ✓', 'success')
      } else {
        console.log(`[Admin] Adding new question to lesson ${selectedLesson.id}:`, form)
        const response = await api.admin.addQuestion(selectedLesson.id, form)
        console.log(`[Admin] Question added successfully:`, response)
        showToast('Question added ✓', 'success')
      }
      setShowModal(false)
      await loadQuestions(selectedLesson.id)
    } catch (e) { 
      console.error(`[Admin] Error saving question:`, e)
      showToast(e.message, 'error') 
    }
  }

  async function confirmDelete() {
    try {
      await api.admin.deleteQuestion(deleteId)
      showToast('Question deleted ✓', 'success')
      setDeleteId(null)
      loadQuestions(selectedLesson.id)
    } catch (e) { showToast(e.message, 'error') }
  }

  async function savePassingScore() {
    try {
      await api.admin.updatePassingScore(selectedLesson.id, Number(passingScore))
      showToast('Passing score updated ✓', 'success')
      setScoreDirty(false)
    } catch (e) { showToast(e.message, 'error') }
  }

  const letters = ['A', 'B', 'C', 'D']
  const filteredQuestions = useMemo(() => {
    let q = query.trim().toLowerCase()
    let filtered = q ? questions.filter((item) => String(item.question_text || '').toLowerCase().includes(q)) : questions
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter((item) => (item.difficulty || 'medium') === difficultyFilter)
    }
    return filtered
  }, [questions, query, difficultyFilter])

  useEffect(() => {
    setCurrentQuestionIndex((idx) => {
      if (!filteredQuestions.length) return 0
      return Math.min(idx, filteredQuestions.length - 1)
    })
  }, [filteredQuestions.length])

  const currentQuestion = filteredQuestions[currentQuestionIndex] || null
  const currentDisplayOptions = currentQuestion
    ? currentQuestion.options
        .map((opt, idx) => ({ opt, idx }))
        .filter((item) => String(item.opt || '').trim())
    : []

  const questionStats = useMemo(() => {
    const totalQ = questions.length
    const byType = {
      tf: questions.filter(q => q.options.length === 2).length,
      mc: questions.filter(q => q.options.length > 2).length
    }
    const byDiff = {
      easy: questions.filter(q => (q.difficulty || 'medium') === 'easy').length,
      medium: questions.filter(q => (q.difficulty || 'medium') === 'medium').length,
      hard: questions.filter(q => (q.difficulty || 'medium') === 'hard').length
    }
    return { totalQ, byType, byDiff }
  }, [questions])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold heading text-ink mb-2">Quizzes</h1>
        <p className="text-steel font-medium">Manage question banks and passing scores.</p>
      </header>

      {/* Lesson Selector */}
      <div>
        <label className="block mb-3 font-bold text-steel text-xs uppercase tracking-widest">Select Lesson</label>
        <div className="flex flex-wrap gap-2">
          {lessons.map((l, i) => (
            <button
              key={l.id}
              onClick={() => selectLesson(l)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                selectedLesson?.id === l.id
                  ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white border-brand-400 shadow-lg shadow-brand-500/20'
                  : 'bg-white text-steel border-gray-200 hover:bg-brand-50 hover:text-brand-700'
              }`}
            >
              Lesson {i + 1}: {l.title}
            </button>
          ))}
        </div>
        {!lessons.length && (
          <div className="admin-glass-card p-6 mt-4 text-steel">
            No lessons found yet. Create a lesson first to build a quiz.
          </div>
        )}
      </div>

      {selectedLesson && (
        <>
          {/* Passing Score */}
          <div className="admin-glass-card p-6 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-xl">🏆</div>
              <div>
                <p className="text-ink font-bold tracking-tight">Passing Score</p>
                <p className="text-xs text-steel font-medium uppercase">Required percentage to pass</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={0}
                max={100}
                className="w-20 bg-white border border-gray-200 rounded-xl px-2 py-3 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition text-center font-mono font-bold text-brand-700 text-xl"
                value={passingScore}
                onChange={e => { setPassingScore(e.target.value); setScoreDirty(true) }}
              />
              {scoreDirty && (
                <button 
                  onClick={savePassingScore} 
                  className="px-6 py-3 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl font-bold transition-all border border-brand-100"
                >
                  Apply
                </button>
              )}
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-extrabold text-ink tracking-tight flex items-center gap-3">
              <span className="text-steel">Bank:</span>
              {selectedLesson.title}
            </h2>
            <div className="flex items-center gap-3">
              {selectedQuestions.size > 0 && (
                <button
                  onClick={bulkDeleteSelected}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold text-sm transition-all border border-red-200"
                >
                  🗑️ Delete {selectedQuestions.size}
                </button>
              )}
              <button
                onClick={openAdd}
                className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-brand-500/20"
              >
                ➕ Add Question
              </button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="admin-glass-card p-4 text-center">
              <div className="text-2xl font-bold text-brand-600">{questionStats.totalQ}</div>
              <div className="text-xs font-bold text-steel uppercase">Total Questions</div>
            </div>
            <div className="admin-glass-card p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{questionStats.byType.mc}</div>
              <div className="text-xs font-bold text-steel uppercase">Multiple Choice</div>
            </div>
            <div className="admin-glass-card p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{questionStats.byType.tf}</div>
              <div className="text-xs font-bold text-steel uppercase">True/False</div>
            </div>
            <div className="admin-glass-card p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{questionStats.byDiff.hard}</div>
              <div className="text-xs font-bold text-steel uppercase">Hard Questions</div>
            </div>
          </div>

          <div className="admin-glass-card p-4 mb-6 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <label className="sr-only" htmlFor="admin-question-search">Search questions</label>
              <input
                id="admin-question-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="🔍 Search by question text..."
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-ink placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
            </div>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-ink focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition font-bold text-sm"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">🟢 Easy</option>
              <option value="medium">🟡 Medium</option>
              <option value="hard">🔴 Hard</option>
            </select>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 whitespace-nowrap">
              {filteredQuestions.length} of {questions.length}
            </span>
          </div>

          {qLoading ? (
            <div className="text-center text-brand-600 py-12 animate-pulse font-bold tracking-widest">FETCHING QUESTIONS...</div>
          ) : questions.length === 0 ? (
            <div className="admin-glass-card p-12 text-center text-steel italic font-medium">
              This lesson has no questions yet. Add your first question to get started.
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="admin-glass-card p-8 text-center text-steel italic font-medium">
              No questions match your search.
            </div>
            ) : (
            <div className="space-y-4">
              {/* Single-question view (one at a time) */}
              {currentQuestion ? (
                <div className="admin-glass-card p-6 group transition-all duration-300 border-l-4 border-l-brand-300">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedQuestions.has(currentQuestion.id)}
                        onChange={() => toggleSelectQuestion(currentQuestion.id)}
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-brand-600 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className="text-xs font-mono font-bold text-brand-600 uppercase">Q {currentQuestionIndex + 1}</span>
                          <span className="text-sm font-bold">{(currentQuestion.difficulty || 'medium') === 'easy' ? '🟢' : (currentQuestion.difficulty || 'medium') === 'hard' ? '🔴' : '🟡'} {currentQuestion.difficulty || 'medium'}</span>
                          {currentQuestion.options.length === 2 && <span className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 font-bold">T/F</span>}
                          {currentQuestion.explanation && <span className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold">✓ Has Explanation</span>}
                          <div className="flex-1" />
                        </div>
                        <p className="text-lg font-bold text-ink mb-6 leading-relaxed">
                          {currentQuestion.question_text}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-6">
                          {currentQuestion.image_path && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 w-fit">
                              <span className="text-sm">🖼️</span>
                              <span className="text-[10px] font-mono text-steel uppercase tracking-tighter truncate max-w-xs">{currentQuestion.image_path}</span>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentDisplayOptions.map(({ opt, idx }) => (
                          <div key={idx} className={`relative flex items-center px-4 py-3 rounded-xl border transition-all ${
                            idx === currentQuestion.correct_answer
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-white border-gray-200 text-steel'
                          }`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mr-3 ${
                              idx === currentQuestion.correct_answer ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-100 text-steel'
                            }`}>
                              {letters[idx]}
                            </span>
                            <span className="text-sm font-medium">{opt}</span>
                            {idx === currentQuestion.correct_answer && (
                              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                          </div>
                        ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-2">
                        <button onClick={() => setCurrentQuestionIndex(i => Math.max(0, i-1))} className="p-2 bg-white hover:bg-blue-50 rounded-lg text-steel hover:text-blue-700 transition-all border border-gray-200 text-sm font-bold">⬆️ Prev</button>
                        <button onClick={() => setCurrentQuestionIndex(i => Math.min(filteredQuestions.length-1, i+1))} className="p-2 bg-white hover:bg-blue-50 rounded-lg text-steel hover:text-blue-700 transition-all border border-gray-200 text-sm font-bold">⬇️ Next</button>
                        <button onClick={() => openEdit(currentQuestion)} className="p-3 bg-white hover:bg-brand-50 rounded-xl text-steel hover:text-brand-700 transition-all border border-gray-200" title="Edit Question">✏️</button>
                        <button onClick={() => duplicateQuestion(currentQuestion)} className="p-3 bg-white hover:bg-purple-50 rounded-xl text-steel hover:text-purple-700 transition-all border border-gray-200" title="Duplicate Question">📋</button>
                        <button onClick={() => setDeleteId(currentQuestion.id)} className="p-3 bg-white hover:bg-red-50 rounded-xl text-steel hover:text-red-600 transition-all border border-gray-200" title="Delete Question">🗑️</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {/* Add/Edit Question Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:pt-12 animate-page-enter">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative admin-glass-card w-full max-w-2xl p-8 border border-brand-100 outline-none max-h-[90vh] overflow-y-auto">
            <header className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-extrabold heading text-ink">
                {editing ? 'Edit Question' : 'Create Question'}
              </h2>
              <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
                <button 
                  onClick={() => {
                    const isTF = form.options[0]?.trim() === 'True' && form.options[1]?.trim() === 'False' && !form.options[2]?.trim() && !form.options[3]?.trim()
                    if (!isTF) {
                      setForm(f => ({ ...f, options: ['True', 'False', '', ''], correct_answer: 0 }))
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    (form.options[0]?.trim() === 'True' && form.options[1]?.trim() === 'False' && !form.options[2]?.trim() && !form.options[3]?.trim())
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                      : 'text-steel hover:text-ink'
                  }`}
                >
                  True/False
                </button>
                <button 
                  onClick={() => {
                    const isTF = form.options[0]?.trim() === 'True' && form.options[1]?.trim() === 'False' && !form.options[2]?.trim() && !form.options[3]?.trim()
                    if (isTF) {
                      setForm(f => ({ ...f, options: ['', '', '', ''], correct_answer: 0 }))
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    !(form.options[0]?.trim() === 'True' && form.options[1]?.trim() === 'False' && !form.options[2]?.trim() && !form.options[3]?.trim())
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                      : 'text-steel hover:text-ink'
                  }`}
                >
                  Multiple Choice
                </button>
              </div>
            </header>

            <div className="space-y-8">
              <label className="block">
                <span className="block mb-3 font-bold text-steel text-xs uppercase tracking-widest">Question</span>
                <textarea className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-ink focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition resize-none text-lg font-medium leading-relaxed" rows={3} value={form.question_text} onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))} placeholder="Write the question prompt..." />
              </label>
              
              <div>
                <span className="block mb-4 font-bold text-steel text-xs uppercase tracking-widest">
                  { (form.options[0]?.trim() === 'True' && form.options[1]?.trim() === 'False' && !form.options[2]?.trim() && !form.options[3]?.trim()) ? 'True / False Options' : 'Multiple Choice Options' }
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {letters.map((letter, i) => {
                    const isTF = form.options[0]?.trim() === 'True' && form.options[1]?.trim() === 'False' && !form.options[2]?.trim() && !form.options[3]?.trim()
                    if (isTF && i > 1) return null
                    return (
                      <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                        form.correct_answer === i ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'
                      }`}>
                        <label className="flex items-center cursor-pointer group">
                          <input
                            type="radio"
                            name="correct_answer"
                            checked={form.correct_answer === i}
                            onChange={() => setForm(f => ({ ...f, correct_answer: i }))}
                            className="hidden"
                          />
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all shadow-inner ${
                            form.correct_answer === i ? 'bg-emerald-500 text-white rotate-12 scale-110 shadow-emerald-500/20' : 'bg-gray-100 text-steel group-hover:bg-gray-200'
                          }`}>
                            {letter}
                          </div>
                        </label>
                        <input
                          className={`flex-1 bg-transparent border-none text-ink focus:ring-0 placeholder-gray-400 font-medium py-0 ${isTF ? 'cursor-not-allowed opacity-80' : ''}`}
                          value={form.options[i]}
                          onChange={e => !isTF && updateOption(i, e.target.value)}
                          placeholder={`Option ${letter}`}
                          readOnly={isTF}
                        />
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 text-xs font-medium text-steel uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Select the correct answer label
                </p>
              </div>

              <div className="w-full">
                <label className="block">
                  <span className="block mb-3 font-bold text-steel text-xs uppercase tracking-widest">Image Path (Optional)</span>
                  <input className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 text-ink focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition font-mono text-sm" value={form.image_path} onChange={e => setForm(f => ({ ...f, image_path: e.target.value }))} placeholder="/images/lesson-1/question-1.png" />
                </label>
              </div>

              <div className="w-full">
                <label className="block">
                  <span className="block mb-3 font-bold text-steel text-xs uppercase tracking-widest">Explanation (Optional)</span>
                  <textarea className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 text-ink focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition resize-none text-sm font-medium leading-relaxed" rows={3} value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} placeholder="Explain why this answer is correct..." />
                </label>
              </div>

              <div className="w-full">
                <label className="block">
                  <span className="block mb-3 font-bold text-steel text-xs uppercase tracking-widest">Difficulty Level</span>
                  <div className="flex gap-2">
                    {['easy', 'medium', 'hard'].map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, difficulty: level }))}
                        className={`flex-1 py-3 rounded-xl font-bold transition-all border ${
                          form.difficulty === level
                            ? 'bg-brand-500 text-white border-brand-400 shadow-lg shadow-brand-500/20'
                            : 'bg-white text-steel border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {level === 'easy' ? '🟢 Easy' : level === 'medium' ? '🟡 Medium' : '🔴 Hard'}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
            </div>
            <div className="mt-10 flex justify-between items-center pt-6 border-t border-gray-200">
              <button className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-steel font-bold rounded-lg transition-all text-sm" onClick={() => setShowPreview(!showPreview)}>
                👁️ {showPreview ? 'Hide' : 'Preview'}
              </button>
              <div className="flex justify-end gap-3">
                <button className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-steel font-bold rounded-2xl transition-all" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="px-10 py-4 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold rounded-2xl hover:scale-105 transition-all shadow-lg shadow-brand-500/20" onClick={save}>
                  {editing ? 'Save Changes' : 'Create Question'}
                </button>
              </div>
            </div>

            {showPreview && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-bold text-steel uppercase mb-4">📋 Preview</h3>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                  <p className="text-lg font-bold text-ink mb-4">{form.question_text || '(Question text)'}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map(idx => {
                      const opt = form.options[idx]?.trim()
                      if (!opt && (idx === 2 || idx === 3)) return null
                      return (
                        <div key={idx} className={`px-4 py-3 rounded-xl border font-bold ${
                          idx === form.correct_answer ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : 'bg-white border-gray-200 text-steel'
                        }`}>
                          <span className="font-bold">{letters[idx]}</span>. {opt || '(empty option)'}
                        </div>
                      )
                    })}
                  </div>
                  {form.explanation && (
                    <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                      <p className="text-xs font-bold text-yellow-800">💡 Explanation: {form.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <Modal open={!!deleteId} title="Delete Question" onClose={() => setDeleteId(null)} onConfirm={confirmDelete} confirmText="Delete" cancelText="Cancel">
        Are you sure you want to delete this question? This action cannot be undone.
      </Modal>
    </div>
  )
}
