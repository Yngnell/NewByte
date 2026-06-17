import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { quizBank } from '../data/quiz.js'
import { lessons } from '../data/lessons.js'
import QuizQuestion from '../components/QuizQuestion.jsx'
import { useApp } from '../context/AppContext.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import { api } from '../api/client.js'
import { useToast } from '../components/Toast.jsx'
import Confetti from '../components/Confetti.jsx'
import useDocTitle from '../hooks/useDocTitle.js'

const CORRECT_MESSAGES = [
  '🎉 Awesome! You nailed it!',
  '🌟 Brilliant! Keep it up!',
  '💪 Yes! You\'re on fire!',
  '🏆 Perfect answer! Amazing!',
  '✨ Superstar! That\'s right!',
  '🚀 Incredible! You\'re zooming through!',
  '👏 Well done! Keep going!',
  '🎯 Spot on! You\'re a natural!',
]
const WRONG_MESSAGES = [
  '💡 Not quite — but you\'re learning!',
  '🧠 Oops! Check the explanation below.',
  '📖 Close! Review and try the next one.',
  '🌈 Don\'t give up — you\'ve got this!',
  '💪 It\'s okay! Learning from mistakes is smart.',
]
const STREAK_MESSAGES = {
  3: '🔥 3 in a row! You\'re on fire!',
  5: '⚡ 5 streak! Unstoppable!',
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffleQuestions(items) {
  return [...items].sort(() => Math.random() - 0.5)
}

export default function Quiz() {
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const { markLessonCompleted, recordQuizAttempt, progress } = useApp()
  const { showToast } = useToast()
  const [questions, setQuestions] = useState(quizBank[lessonId] || [])
  const lesson = lessons.find((l) => l.id === lessonId)
  const dbLessonId = lesson?.db_id || lessonId // Use db_id for API calls
  useDocTitle(lesson ? `Quiz: ${lesson.title}` : 'Quiz')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState([])
  const [done, setDone] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [passingScore, setPassingScore] = useState(70)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [points, setPoints] = useState(0)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [pointsEarned, setPointsEarned] = useState(0)
  const [showPointsAnim, setShowPointsAnim] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)

  const stateRef = useRef({})
  stateRef.current = { answered, done, current, questions, selectedOption }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        console.log(`[Quiz] Fetching questions for dbLessonId=${dbLessonId}`)
        const res = await api.quiz(dbLessonId)
        if (res.questions?.length) {
          const mapped = res.questions.map((q) => ({
            id: q.id,
            prompt: q.question_text,
            image: q.image_path,
            alt: q.question_text,
            options: q.options,
            answer: q.correct_index,
            explanation: q.explanation || '',
          }))
          setQuestions(shuffleQuestions(mapped))
        } else {
          // Fallback to local quiz bank only if API returns no questions
          setQuestions(shuffleQuestions(quizBank[lessonId] || []))
        }
        const scoreValue = Number(res.passing_score)
        if (Number.isFinite(scoreValue)) setPassingScore(scoreValue)
      } catch (err) {
        console.error('Quiz API error:', err)
        // Only fallback to local quiz bank on error
        setQuestions(shuffleQuestions(quizBank[lessonId] || []))
      } finally {
        setLoading(false)
      }
    })()
  }, [lessonId, dbLessonId])

  const score = useMemo(() => {
    let correct = 0
    questions.forEach((q, i) => { if (answers[i] === q.answer) correct++ })
    return Math.round((correct / (questions.length || 1)) * 100)
  }, [answers, questions])

  const correctCount = useMemo(() => {
    return questions.filter((q, i) => answers[i] === q.answer).length
  }, [answers, questions])

  const onAnswer = useCallback((idx) => {
    if (answered) return
    const newAns = [...answers]
    newAns[current] = idx
    setAnswers(newAns)
    setAnswered(true)
    const correct = idx === questions[current].answer
    setIsCorrect(correct)
    if (correct) {
      const newStreak = streak + 1
      setStreak(newStreak)
      if (newStreak > maxStreak) setMaxStreak(newStreak)
      const streakBonus = Math.min(newStreak - 1, 4) * 25
      const earned = 100 + streakBonus
      setPointsEarned(earned)
      setPoints(prev => prev + earned)
      setShowPointsAnim(true)
      setTimeout(() => setShowPointsAnim(false), 900)
      setFeedbackMsg(STREAK_MESSAGES[newStreak] || randomFrom(CORRECT_MESSAGES))
      if (newStreak >= 3) setShowConfetti(true)
    } else {
      setStreak(0)
      setFeedbackMsg(randomFrom(WRONG_MESSAGES))
    }
    setAnnounce(correct ? 'Correct answer!' : 'Incorrect answer.')
  }, [answered, answers, current, questions, streak, maxStreak])

  const onNext = useCallback(async () => {
    if (!answered) {
      showToast('Please select an answer before continuing.', 'warning')
      return
    }
    setAnswered(false)
    setIsCorrect(false)
    setFeedbackMsg('')
    setShowConfetti(false)
    if (current + 1 < questions.length) {
      setCurrent(current + 1)
    } else {
      const passed = score >= passingScore
      setDone(true)
      setFeedback(passed ? 'Great job! You passed!' : 'Keep trying. You can retry!')
      recordQuizAttempt(lessonId, score, passed)
      if (passed) {
        setShowConfetti(false)
        setTimeout(() => setShowConfetti(true), 200)
        showToast(`🎉 You passed with ${score}%! The next lesson is now unlocked.`, 'success')
        markLessonCompleted(lessonId)
        try {
          const canSubmitByQuestionId = questions.every((q) => q.id !== undefined && q.id !== null)
          const submittedAnswers = canSubmitByQuestionId
            ? questions.map((q, index) => ({
                question_id: q.id,
                answer: answers[index],
              }))
            : answers
          await api.submitQuiz(dbLessonId, submittedAnswers)
        } catch {
          // Local progress is already saved above
        }
      } else {
        showToast(`You scored ${score}%. You need at least ${passingScore}% to pass. Try again!`, 'error')
      }
    }
  }, [answered, current, questions, score, lessonId, dbLessonId, answers, showToast, recordQuizAttempt, markLessonCompleted, passingScore])

  const onAnswerRef = useRef(onAnswer)
  const onNextRef = useRef(onNext)
  useEffect(() => { onAnswerRef.current = onAnswer }, [onAnswer])
  useEffect(() => { onNextRef.current = onNext }, [onNext])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const { answered, done, current, questions, selectedOption } = stateRef.current
      if (done) return
      if (answered) {
        if (e.key.toLowerCase() === 'n' || e.key === 'Enter') onNextRef.current()
        return
      }
      if (e.key >= '1' && e.key <= '4') {
        const idx = Number(e.key) - 1
        if (questions[current]?.options[idx] !== undefined) setSelectedOption(idx)
      }
      if (e.key === 'Enter' && selectedOption !== null) {
        onAnswerRef.current(selectedOption)
        setSelectedOption(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => { setSelectedOption(null) }, [current])

  function handleRetry() {
    setQuestions(prev => shuffleQuestions(prev))
    setCurrent(0); setAnswers([]); setDone(false); setFeedback('')
    setAnswered(false); setIsCorrect(false); setStreak(0); setMaxStreak(0)
    setPoints(0); setFeedbackMsg(''); setShowReview(false); setShowConfetti(false)
    setSelectedOption(null)
  }

  if (!lesson) return <div>Lesson not found.</div>

  const lessonStatus = progress[lesson.id]
  if (lessonStatus === 'locked') {
    return (
      <div className="space-y-4 animate-fadeIn" role="region" aria-label="Quiz locked">
        <div className="mb-4">
          <Link to="/lessons" className="text-brand-600 font-bold hover:text-brand-700 text-lg">← Back to Lessons</Link>
        </div>
        <Card className="p-8 text-center bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-extrabold heading text-yellow-700 mb-3">Quiz Locked</h1>
          <p className="text-steel text-lg max-w-md mx-auto">
            The quiz for <strong>{lesson.title}</strong> is not available yet. Complete the previous lesson and pass its quiz first.
          </p>
          <div className="mt-6">
            <Link to="/lessons"><Button variant="primary" className="text-lg px-6 py-3">📖 Go to Lessons</Button></Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-3xl mx-auto" role="region" aria-label={`Quiz for ${lesson.title}`}>
      <Confetti active={showConfetti} duration={done ? 6000 : 3000} />
      <div className="mb-4">
        <Link to={`/lessons/${lessonId}`} className="text-brand-600 font-bold hover:text-brand-700">← Back to Lesson</Link>
      </div>
      <Card className="p-6 bg-gradient-to-br from-white to-brand-50 border-brand-200">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl md:text-3xl font-extrabold heading text-brand-700">🧩 {lesson.title} Quiz</h1>
          {!done && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-bold border border-yellow-200">⭐ {points} pts</span>
                {showPointsAnim && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm font-bold text-green-600 animate-fly-up">+{pointsEarned}</span>
                )}
              </div>
              {streak >= 2 && (
                <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold border border-orange-200 animate-fire">🔥 {streak} streak</span>
              )}
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold border border-gray-200">Pass {passingScore}%</span>
              <span className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-sm font-bold">{current + 1} / {questions.length}</span>
            </div>
          )}
        </div>
        <div className="text-sm text-steel mb-3 bg-gray-50 rounded-xl px-4 py-2 border border-gray-100">
          ⌨️ Tip: Press <kbd className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-mono text-xs">1–4</kbd> to highlight, <kbd className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-mono text-xs">Enter</kbd> to confirm, <kbd className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-mono text-xs">N</kbd> for Next.
        </div>
        <div aria-live="polite" className="sr-only">{announce}</div>
        {!done ? (
          <>
            {loading ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3 animate-pulse">⏳</div>
                <p className="text-steel text-lg">Loading questions…</p>
              </div>
            ) : !questions.length ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📝</div>
                <p className="text-xl font-bold text-brand-700">No quiz available for this lesson yet.</p>
                <p className="mt-2 text-steel">Check back later or go back to the lesson.</p>
                <div className="mt-6">
                  <Button onClick={() => navigate(`/lessons/${lessonId}`)} variant="primary" className="text-lg px-6">← Back to Lesson</Button>
                </div>
              </div>
            ) : (
              <div className={answered ? (isCorrect ? 'animate-pulse-glow rounded-2xl' : 'animate-shake') : ''}>
                <QuizQuestion
                  item={questions[current]}
                  selected={answers[current]}
                  onAnswer={onAnswer}
                  answered={answered}
                  isCorrect={isCorrect}
                  selectedOption={selectedOption}
                />
              </div>
            )}
            {answered && feedbackMsg && (
              <div className={`mt-4 p-4 rounded-xl border-2 animate-slide-up ${isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-200'}`}>
                <p className="text-lg font-bold mb-1">{feedbackMsg}</p>
                {questions[current]?.explanation && (
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-bold">{isCorrect ? '✅' : '💡'} </span>{questions[current].explanation}
                  </p>
                )}
                {!isCorrect && (
                  <p className="text-xs text-gray-500 mt-2">
                    The correct answer was: <strong className="text-green-700">{questions[current].options[questions[current].answer]}</strong>
                  </p>
                )}
              </div>
            )}
            <div className="mt-5 w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-500 via-brand-600 to-green-500 transition-all duration-500 rounded-full" style={{ width: `${((current + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-steel font-medium">Question {current + 1} of {questions.length}</div>
              {answered && (
                <Button onClick={onNext} className="text-lg px-6 animate-bounce-in">
                  {current + 1 < questions.length ? 'Next Question ➡️' : '🏁 See Results'}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="animate-fadeIn">
            <div className="text-center py-6">
              <div className="text-7xl mb-4">{score >= passingScore ? '🎉' : score >= 40 ? '💪' : '📖'}</div>
              <p className="text-3xl font-extrabold heading text-brand-700">{feedback}</p>
              <div className="mt-6 inline-flex flex-col items-center">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke={score >= passingScore ? '#10b981' : '#ef4444'} strokeWidth="8" strokeDasharray="283" strokeDashoffset={283 - (283 * score) / 100} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-3xl font-extrabold ${score >= passingScore ? 'text-green-600' : 'text-red-500'}`}>{score}%</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
                <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm"><div className="text-2xl">✅</div><div className="text-lg font-bold text-green-600">{correctCount}</div><div className="text-xs text-steel">Correct</div></div>
                <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm"><div className="text-2xl">❌</div><div className="text-lg font-bold text-red-500">{questions.length - correctCount}</div><div className="text-xs text-steel">Wrong</div></div>
                <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm"><div className="text-2xl">🔥</div><div className="text-lg font-bold text-orange-600">{maxStreak}</div><div className="text-xs text-steel">Best Streak</div></div>
                <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm"><div className="text-2xl">⭐</div><div className="text-lg font-bold text-yellow-600">{points}</div><div className="text-xs text-steel">Points</div></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {score === 100 && <span className="inline-flex items-center gap-1 text-sm font-bold bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full border border-yellow-200 animate-bounce-in">🏆 Perfect Score!</span>}
                {maxStreak >= 5 && <span className="inline-flex items-center gap-1 text-sm font-bold bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full border border-orange-200 animate-bounce-in">🔥 Streak Master!</span>}
                {score >= passingScore && <span className="inline-flex items-center gap-1 text-sm font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-full border border-green-200 animate-bounce-in">✅ Quiz Passed!</span>}
                {points >= 400 && <span className="inline-flex items-center gap-1 text-sm font-bold bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full border border-purple-200 animate-bounce-in">⭐ High Scorer!</span>}
              </div>
              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                <Button onClick={handleRetry} variant="primary" className="text-lg px-6">🔄 Retry Quiz</Button>
                <Button onClick={() => setShowReview(prev => !prev)} variant="secondary" className="text-lg px-6">📋 {showReview ? 'Hide' : 'Review'} Answers</Button>
                <Button onClick={() => navigate('/lessons')} variant="secondary" className="text-lg px-6">📖 Back to Lessons</Button>
              </div>
            </div>
            {showReview && (
              <div className="mt-6 space-y-4 animate-slide-up">
                <h2 className="text-xl font-extrabold text-brand-700 heading">📋 Answer Review</h2>
                {questions.map((q, qi) => {
                  const userAns = answers[qi]
                  const correct = userAns === q.answer
                  return (
                    <div key={qi} className={`rounded-xl p-4 border-2 ${correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${correct ? 'bg-green-500' : 'bg-red-500'}`}>{qi + 1}</span>
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 mb-2">{q.prompt}</p>
                          {q.image && <img src={q.image} alt={q.alt || q.prompt} className="w-32 h-24 object-contain rounded-lg border border-gray-200 mb-2" />}
                          <div className="space-y-1">
                            {q.options.map((opt, oi) => {
                              let cls = 'text-gray-500'; let icon = ''
                              if (oi === q.answer) { cls = 'text-green-700 font-bold'; icon = '✅ ' }
                              if (oi === userAns && !correct) { cls = 'text-red-600 font-bold line-through'; icon = '❌ ' }
                              return <p key={oi} className={`text-sm ${cls}`}>{icon}{opt}</p>
                            })}
                          </div>
                          {q.explanation && (
                            <p className="mt-2 text-sm text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">💡 {q.explanation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
