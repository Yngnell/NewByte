import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Lessons from './pages/Lessons.jsx'
import LessonDetail from './pages/LessonDetail.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Profile from './pages/Profile.jsx'
import Ranking from './pages/Ranking.jsx'
import Quiz from './pages/Quiz.jsx'
import Help from './pages/Help.jsx'
import Accessibility from './pages/Accessibility.jsx'
import NotFound from './pages/NotFound.jsx'
import ReadAloudToolbar from './components/ReadAloudToolbar.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import BackToTop from './components/BackToTop.jsx'
import KeyboardShortcuts from './components/KeyboardShortcuts.jsx'
import { ToastProvider } from './components/Toast.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminCourses from './pages/admin/AdminCourses.jsx'
import AdminLessons from './pages/admin/AdminLessons.jsx'
import AdminQuizzes from './pages/admin/AdminQuizzes.jsx'

function ProtectedRoute({ children }) {
  const { user } = useApp()
  const location = useLocation()
  if (!user) {
    const path = location?.pathname || 'this page'
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, message: `Please log in to access ${path}.` }}
      />
    )
  }
  return children
}

function AppShell() {
  const { settings } = useApp()
  const location = useLocation()

  useEffect(() => {
    if (!settings.screenReader) return
    const main = document.getElementById('main')
    if (!main) return
    const activeLink = document.querySelector('nav a[class*="text-brand"]')
    if (activeLink) activeLink.setAttribute('aria-current', 'page')
    main.querySelectorAll('img:not([alt])').forEach(img => { img.setAttribute('alt', 'Image') })
    main.querySelectorAll('[role="radiogroup"]:not([aria-label])').forEach(g => { g.setAttribute('aria-label', 'Answer choices') })
    main.querySelectorAll('section:not([aria-label])').forEach(sec => {
      const h = sec.querySelector('h1, h2, h3')
      if (h) sec.setAttribute('aria-label', h.textContent.trim())
    })
    return () => {
      const link = document.querySelector('[aria-current="page"]')
      if (link) link.removeAttribute('aria-current')
    }
  }, [settings.screenReader, location.pathname])

  const isAdmin = location.pathname.startsWith('/admin')
  const fontClass = settings.fontSize === 'large' ? 'cb-font-large' : settings.fontSize === 'small' ? 'cb-font-small' : 'cb-font-medium'
  const contrastClass = settings.highContrast ? 'cb-contrast' : ''
  const darkClass = settings.darkMode ? 'cb-dark' : ''
  const dyslexiaClass = settings.dyslexiaFont ? 'cb-dyslexia' : ''
  const motionClass = settings.reducedMotion ? 'cb-reduced-motion' : ''
  const spacingClass = settings.lineSpacing === 'wide' ? 'cb-spacing-wide' : settings.lineSpacing === 'extra-wide' ? 'cb-spacing-extra-wide' : ''
  const cursorClass = settings.cursorSize === 'large' ? 'cb-cursor-large' : settings.cursorSize === 'extra-large' ? 'cb-cursor-xl' : ''
  const focusClass = settings.highlightFocus ? 'cb-highlight-focus' : ''
  const srClass = settings.screenReader ? 'cb-sr-enhanced' : ''

  return (
    <div className={`${fontClass} ${contrastClass} ${darkClass} ${dyslexiaClass} ${motionClass} ${spacingClass} ${cursorClass} ${focusClass} ${srClass} app-bg font-sans`}>
      <a href="#main" className="skip-link">Skip to main content</a>
      {!isAdmin && <Navbar />}
      <ScrollToTop />
      <KeyboardShortcuts />
      {isAdmin ? (
        <div id="main" aria-label="Admin content">
          <Routes>
            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="courses" element={<AdminCourses />} />
              <Route path="lessons" element={<AdminLessons />} />
              <Route path="quizzes" element={<AdminQuizzes />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      ) : (
        <main id="main" aria-label="Main content" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 page-transition">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lessons" element={<Lessons />} />
            <Route path="/lessons/:lessonId" element={<ProtectedRoute><LessonDetail /></ProtectedRoute>} />
            <Route path="/quiz/:lessonId" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
            <Route path="/ranking" element={<ProtectedRoute><Ranking /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/help" element={<Help />} />
            <Route path="/accessibility" element={<Accessibility />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      )}
      <ReadAloudToolbar />
      <BackToTop />
    </div>
  )
}

function AppShellWithRedirect() {
  const { user } = useApp()
  const location = useLocation()
  if (user && (location.pathname === '/login' || location.pathname === '/register')) {
    return <Navigate to="/lessons" replace />
  }
  return <AppShell />
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppShellWithRedirect />
      </ToastProvider>
    </AppProvider>
  )
}

