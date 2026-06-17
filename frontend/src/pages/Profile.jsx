import { useApp } from '../context/AppContext.jsx'
import { useEffect, useState } from 'react'
import { lessons } from '../data/lessons.js'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { Link } from 'react-router-dom'
import useDocTitle from '../hooks/useDocTitle.js'
import { api } from '../api/client.js'

export default function Profile() {
  useDocTitle('My Profile')
  const { user, progress, quizHistory } = useApp()
  const [rankings, setRankings] = useState([])
  const [currentRank, setCurrentRank] = useState(null)
  const total = lessons.length
  const completed = Object.values(progress).filter((s) => s === 'completed').length
  const percent = total > 0 ? (completed / total) * 100 : 0

  const nextLesson =
    lessons.find((l) => progress[l.id] === 'unlocked') ||
    lessons.find((l) => progress[l.id] !== 'completed')

  const totalQuizzes = quizHistory?.length || 0
  const passedQuizzes = quizHistory?.filter((h) => h.passed).length || 0
  const avgScore = totalQuizzes > 0 ? Math.round(quizHistory.reduce((sum, h) => sum + h.score, 0) / totalQuizzes) : 0
  const bestScore = totalQuizzes > 0 ? Math.max(...quizHistory.map((h) => h.score)) : 0

  useEffect(() => {
    let active = true
    api.getRankings()
      .then((res) => {
        if (!active) return
        setRankings(res.rankings || [])
        setCurrentRank(res.currentUser || null)
      })
      .catch(() => {
        if (!active) return
        setRankings([])
        setCurrentRank(null)
      })
    return () => { active = false }
  }, [quizHistory])

  const achievements = []
  if (completed >= 1) achievements.push({ icon: '🌱', label: 'First Lesson', desc: 'Completed your first lesson' })
  if (completed >= 3) achievements.push({ icon: '🔥', label: 'Halfway There', desc: 'Completed 3 lessons' })
  if (completed >= total) achievements.push({ icon: '🎆', label: 'ByteStart Master', desc: 'Completed all lessons!' })
  if (totalQuizzes >= 1) achievements.push({ icon: '📝', label: 'Quiz Taker', desc: 'Took your first quiz' })
  if (totalQuizzes >= 5) achievements.push({ icon: '🧠', label: 'Quiz Whiz', desc: 'Took 5 quizzes' })
  if (bestScore === 100) achievements.push({ icon: '💯', label: 'Perfect Score', desc: 'Scored 100% on a quiz' })
  if (passedQuizzes >= 3) achievements.push({ icon: '⭐', label: 'Star Learner', desc: 'Passed 3 quizzes' })

  const lockedAchievements = []
  if (completed < 1) lockedAchievements.push({ icon: '🌱', label: 'First Lesson', desc: 'Complete your first lesson' })
  if (completed < 3) lockedAchievements.push({ icon: '🔥', label: 'Halfway There', desc: 'Complete 3 lessons' })
  if (completed < total) lockedAchievements.push({ icon: '🎆', label: 'ByteStart Master', desc: 'Complete all lessons' })
  if (totalQuizzes < 1) lockedAchievements.push({ icon: '📝', label: 'Quiz Taker', desc: 'Take your first quiz' })
  if (totalQuizzes < 5) lockedAchievements.push({ icon: '🧠', label: 'Quiz Whiz', desc: 'Take 5 quizzes' })
  if (bestScore < 100) lockedAchievements.push({ icon: '💯', label: 'Perfect Score', desc: 'Score 100% on a quiz' })
  if (passedQuizzes < 3) lockedAchievements.push({ icon: '⭐', label: 'Star Learner', desc: 'Pass 3 quizzes' })

  const statusIcon = (status) => {
    if (status === 'completed') return '✅'
    if (status === 'unlocked') return '🔓'
    return '🔒'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn" role="region" aria-label="Your profile and progress">
      {/* Profile Header */}
      <div className="profile-header-card relative overflow-hidden rounded-2xl border shadow-lg p-6">
        <div className="relative z-10 flex items-center gap-5">
          <div className="profile-avatar w-20 h-20 rounded-2xl flex items-center justify-center text-white text-4xl font-extrabold shadow-lg flex-shrink-0">
            {user?.email?.[0]?.toUpperCase() || '👤'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-extrabold heading profile-heading">👤 {user?.email}</h1>
            <p className="mt-1 text-lg profile-subtitle">
              Completed: <span className="font-bold profile-highlight">{completed}</span> / {total} lessons
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {completed === total ? (
                <span className="profile-badge profile-badge-success">🎉 All Complete!</span>
              ) : (
                <span className="profile-badge profile-badge-progress">📚 In Progress</span>
              )}
              {achievements.length > 0 && (
                <span className="profile-badge profile-badge-achievement">🏅 {achievements.length} Badge{achievements.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <Card className="p-6 space-y-4 profile-section">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold heading profile-section-heading">📊 Overall Progress</h2>
          <div className="profile-percent-badge">{Math.round(percent)}%</div>
        </div>
        <ProgressBar percent={percent} />

        {nextLesson ? (
          <div className="profile-next-lesson flex items-center justify-between rounded-xl p-4">
            <div>
              <p className="text-sm profile-muted-text">Next up</p>
              <p className="font-bold profile-next-title">{nextLesson.title}</p>
            </div>
            <Link to={`/lessons/${nextLesson.id}`}>
              <Button className="px-5">Continue ➡️</Button>
            </Link>
          </div>
        ) : (
          <div className="profile-complete-banner rounded-xl p-4 text-center">
            <p className="font-bold text-lg">🎉 You finished all lessons! Great job!</p>
          </div>
        )}
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="profile-stat-card profile-stat-blue">
          <div className="text-3xl mb-1">📖</div>
          <div className="text-2xl font-extrabold profile-stat-value">{completed}</div>
          <div className="text-sm profile-stat-label mt-1">Lessons Done</div>
        </div>
        <div className="profile-stat-card profile-stat-purple">
          <div className="text-3xl mb-1">📝</div>
          <div className="text-2xl font-extrabold profile-stat-value">{totalQuizzes}</div>
          <div className="text-sm profile-stat-label mt-1">Quizzes Taken</div>
        </div>
        <div className="profile-stat-card profile-stat-green">
          <div className="text-3xl mb-1">📈</div>
          <div className="text-2xl font-extrabold profile-stat-value">{avgScore}%</div>
          <div className="text-sm profile-stat-label mt-1">Avg Score</div>
        </div>
        <div className="profile-stat-card profile-stat-amber">
          <div className="text-3xl mb-1">🏆</div>
          <div className="text-2xl font-extrabold profile-stat-value">{bestScore}%</div>
          <div className="text-sm profile-stat-label mt-1">Best Score</div>
        </div>
      </div>

      {/* Overall Ranking */}
      <Card className="p-6 profile-section">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold heading profile-section-heading">Overall Ranking</h2>
            <p className="profile-muted-text text-sm">Based on passed quizzes, average score, and best lesson scores.</p>
          </div>
          <div className="profile-percent-badge">
            {currentRank ? `#${currentRank.rank}` : '--'}
          </div>
        </div>
        {rankings.length ? (
          <div className="overflow-x-auto">
            <table className="profile-table min-w-full text-sm">
              <thead>
                <tr className="profile-table-header">
                  <th className="py-3 px-4 rounded-tl-xl text-left font-bold">Rank</th>
                  <th className="py-3 px-4 text-left font-bold">Learner</th>
                  <th className="py-3 px-4 text-left font-bold">Passed</th>
                  <th className="py-3 px-4 text-left font-bold">Average</th>
                  <th className="py-3 px-4 rounded-tr-xl text-left font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {rankings.slice(0, 10).map((row) => {
                  const isCurrent = String(row.id) === String(user?.id)
                  return (
                    <tr key={row.id} className={`profile-table-row border-t transition-colors ${isCurrent ? 'bg-brand-50' : ''}`}>
                      <td className="py-3 px-4 font-extrabold text-brand-700">#{row.rank}</td>
                      <td className="py-3 px-4 font-medium">{row.full_name || row.email}</td>
                      <td className="py-3 px-4">{row.quizzes_passed}</td>
                      <td className="py-3 px-4 font-bold">{row.average_score}%</td>
                      <td className="py-3 px-4">{row.total_score}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="profile-muted-text">Take a quiz to start appearing in the ranking.</p>
        )}
      </Card>

      {/* Per-Lesson Breakdown */}
      <Card className="p-6 profile-section">
        <h2 className="text-2xl font-bold heading profile-section-heading mb-4">📋 Lesson Breakdown</h2>
        <div className="space-y-3">
          {lessons.map((lesson, idx) => {
            const status = progress[lesson.id] || 'locked'
            const lessonQuizzes = quizHistory?.filter((h) => h.lessonId === lesson.id) || []
            const bestLessonScore = lessonQuizzes.length > 0 ? Math.max(...lessonQuizzes.map((h) => h.score)) : null
            return (
              <div key={lesson.id} className={`profile-lesson-row profile-lesson-${status} flex items-center gap-4 p-4 rounded-xl border transition-all`}>
                <div className="profile-lesson-number flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg shadow-sm">
                  {idx}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold profile-lesson-title truncate">{lesson.title}</div>
                  <div className="text-xs mt-0.5 profile-lesson-meta">
                    {status === 'completed' && bestLessonScore !== null && `Best score: ${bestLessonScore}%`}
                    {status === 'completed' && bestLessonScore === null && 'Completed'}
                    {status === 'unlocked' && 'Ready to start'}
                    {status === 'locked' && 'Complete the previous lesson to unlock'}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {bestLessonScore !== null && (
                    <span className={`profile-score-badge text-xs font-bold px-2 py-1 rounded-lg ${bestLessonScore >= 70 ? 'profile-score-pass' : 'profile-score-fail'}`}>
                      {bestLessonScore}%
                    </span>
                  )}
                  <span className="text-lg">{statusIcon(status)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Achievements */}
      <Card className="p-6 profile-section">
        <h2 className="text-2xl font-bold heading profile-section-heading mb-4">🏅 Achievements</h2>
        {achievements.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {achievements.map((a) => (
              <div key={a.label} className="profile-achievement-unlocked flex items-center gap-3 rounded-xl p-4 border shadow-sm animate-slideUp">
                <div className="text-3xl">{a.icon}</div>
                <div>
                  <div className="font-bold profile-achievement-label">{a.label}</div>
                  <div className="text-xs profile-achievement-desc">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="profile-muted-text mb-4">Complete lessons and quizzes to earn badges!</p>
        )}
        {lockedAchievements.length > 0 && (
          <>
            <h3 className="text-sm font-bold profile-locked-heading uppercase tracking-wide mb-3">🔒 Locked</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {lockedAchievements.map((a) => (
                <div key={a.label} className="profile-achievement-locked flex items-center gap-3 rounded-xl p-4 border opacity-60">
                  <div className="text-3xl grayscale">{a.icon}</div>
                  <div>
                    <div className="font-bold profile-achievement-locked-text">{a.label}</div>
                    <div className="text-xs profile-achievement-locked-text">{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Quiz History */}
      <Card className="p-6 profile-section">
        <h2 className="text-2xl font-bold heading profile-section-heading mb-4">📜 Quiz History</h2>
        {quizHistory?.length ? (
          <div className="overflow-x-auto">
            <table className="profile-table min-w-full text-sm">
              <thead>
                <tr className="profile-table-header">
                  <th className="py-3 px-4 rounded-tl-xl text-left font-bold">Lesson</th>
                  <th className="py-3 px-4 text-left font-bold">Score</th>
                  <th className="py-3 px-4 text-left font-bold">Result</th>
                  <th className="py-3 px-4 rounded-tr-xl text-left font-bold">Date</th>
                </tr>
              </thead>
              <tbody>
                {quizHistory.map((h, i) => (
                  <tr key={i} className="profile-table-row border-t transition-colors">
                    <td className="py-3 px-4 font-medium">{h.title}</td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${h.score >= 70 ? 'profile-score-text-pass' : 'profile-score-text-fail'}`}>{h.score}%</span>
                    </td>
                    <td className="py-3 px-4">
                      {h.passed ? (
                        <span className="profile-result-pass px-2 py-1 rounded-lg text-xs font-bold">✅ Passed</span>
                      ) : (
                        <span className="profile-result-fail px-2 py-1 rounded-lg text-xs font-bold">❌ Try Again</span>
                      )}
                    </td>
                    <td className="py-3 px-4 profile-muted-text">{new Date(h.date).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📝</div>
            <p className="profile-muted-text text-lg">No quizzes taken yet. Start a lesson to take your first quiz!</p>
          </div>
        )}
      </Card>
    </div>
  )
}
