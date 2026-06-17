import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import Card from '../components/ui/Card.jsx'
import { api } from '../api/client.js'
import { useToast } from '../components/Toast.jsx'
import useDocTitle from '../hooks/useDocTitle.js'

export default function Ranking() {
  const { showToast } = useToast()
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)

  useDocTitle('Leaderboard')

  useEffect(() => {
    async function fetchRanking() {
      try {
        setLoading(true)
        const res = await api.progressRanking()
        setRankings(res.ranking || [])
      } catch (e) {
        showToast(e.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchRanking()
  }, [showToast])

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold heading text-brand-700 mb-2">🏆 Leaderboard</h1>
        <p className="text-steel font-medium">Top performers based on total quiz scores</p>
      </header>

      {loading ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3 animate-pulse">⏳</div>
          <p className="text-steel text-lg">Loading rankings...</p>
        </div>
      ) : rankings.length === 0 ? (
        <Card className="p-12 text-center text-steel italic font-medium">
          No rankings available yet. Complete some quizzes to see your name here!
        </Card>
      ) : (
        <div className="max-w-2xl mx-auto">
          <Card className="overflow-hidden border-brand-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-50 border-b border-brand-100">
                  <th className="px-6 py-4 text-xs font-bold text-brand-600 uppercase tracking-widest">Rank</th>
                  <th className="px-6 py-4 text-xs font-bold text-brand-600 uppercase tracking-widest">Student</th>
                  <th className="px-6 py-4 text-xs font-bold text-brand-600 uppercase tracking-widest text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rankings.map((user, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-400 text-white shadow-md' : 
                        index === 1 ? 'bg-slate-300 text-white' : 
                        index === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-steel'
                      }`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-ink group-hover:text-brand-600 transition-colors">
                      {user.full_name}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-brand-700">
                      {user.total_score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  )
}