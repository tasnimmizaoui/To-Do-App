"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  Plus,
  Trash2,
  Check,
  X,
  BarChart3,
  Play,
  Pause,
  Clock,
  Coffee,
  Volume2,
  VolumeX,
  RotateCcw,
} from "lucide-react"

const API_BASE = process.env.REACT_APP_API_URL || "/api"

export default function TodoApp() {
  const [todos, setTodos] = useState([])
  const [newTask, setNewTask] = useState("")
  const [stats, setStats] = useState({
    todos: { total: 0, completed: 0, pending: 0, completion_rate: 0 },
    pomodoro: { total_sessions: 0, completed_sessions: 0, work_sessions: 0, break_sessions: 0, focus_time_minutes: 0 },
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Enhanced Pomodoro state
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [initialTime, setInitialTime] = useState(25 * 60) // Track original duration
  const [currentSession, setCurrentSession] = useState(null)
  const [sessionType, setSessionType] = useState("work")
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const [isPaused, setIsPaused] = useState(false)
  const [totalPausedTime, setTotalPausedTime] = useState(0)

  const intervalRef = useRef(null)
  const audioRef = useRef(null)
  const pauseStartRef = useRef(null)

  // Customizable durations (in minutes)
  const DURATIONS = {
    work: 25 * 60,
    break: 5 * 60,
    longBreak: 15 * 60,
  }

  // Data fetching
  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/todos`)
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()
      setTodos(data)
      setError("")
    } catch (e) {
      setError(`Fetch todos: ${e.message}`)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`)
      if (!res.ok) throw new Error(res.statusText)
      setStats(await res.json())
    } catch (e) {
      console.error("Stats error", e)
    }
  }, [])

  const checkActiveSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pomodoro/active`)
      if (res.ok) {
        const { active_session } = await res.json()
        if (active_session) {
          setCurrentSession(active_session)
          const started = new Date(active_session.started_at)
          const elapsed = Math.floor((Date.now() - started) / 1000)
          const duration = active_session.duration * 60
          const remaining = Math.max(0, duration - elapsed)

          setTimeLeft(remaining)
          setInitialTime(duration)
          setSessionType(active_session.session_type)
          setSelectedTaskId(active_session.task_id)
          setSessionStartTime(started)
          setIsTimerRunning(remaining > 0)
        }
      }
    } catch (e) {
      console.error("Active session check error", e)
    }
  }, [])

  useEffect(() => {
    fetchTodos()
    fetchStats()
    checkActiveSession()
  }, [fetchTodos, fetchStats, checkActiveSession])

  // CRUD operations
  const createTodo = async (e) => {
    e.preventDefault()
    if (!newTask.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: newTask }),
      })
      if (!res.ok) throw new Error(res.statusText)
      setNewTask("")
      await fetchTodos()
      await fetchStats()
    } catch (e) {
      setError(`Create todo: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleTodo = async (id, completed) => {
    try {
      const res = await fetch(`${API_BASE}/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      })
      if (!res.ok) throw new Error(res.statusText)
      await fetchTodos()
      await fetchStats()
    } catch (e) {
      setError(`Update todo: ${e.message}`)
    }
  }

  const deleteTodo = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/todos/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(res.statusText)
      await fetchTodos()
      await fetchStats()
    } catch (e) {
      setError(`Delete todo: ${e.message}`)
    }
  }

  // Enhanced Pomodoro API helpers
  const startPomodoro = async () => {
    const duration = DURATIONS[sessionType] / 60 // Convert to minutes for API
    try {
      const res = await fetch(`${API_BASE}/pomodoro/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_type: sessionType,
          task_id: selectedTaskId,
          duration,
        }),
      })
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()

      setCurrentSession(data)
      setTimeLeft(DURATIONS[sessionType])
      setInitialTime(DURATIONS[sessionType])
      setIsTimerRunning(true)
      setSessionStartTime(new Date())
      setTotalPausedTime(0)
      setIsPaused(false)
      setError("")
    } catch (e) {
      setError(`Start session: ${e.message}`)
    }
  }

  const completeSession = useCallback(async () => {
    if (!currentSession) return

    try {
      await fetch(`${API_BASE}/pomodoro/sessions/${currentSession.id}/complete`, {
        method: "PUT",
      })

      // Play completion sound
      if (soundEnabled && audioRef.current) {
        audioRef.current.play().catch(() => {})
      }

      // Reset state
      setCurrentSession(null)
      setIsTimerRunning(false)
      setIsPaused(false)
      setTotalPausedTime(0)
      setSessionStartTime(null)

      await fetchStats()

      // Auto-suggest next session type
      const nextType = sessionType === "work" ? "break" : "work"
      setSessionType(nextType)
      const nextDuration = DURATIONS[nextType]
      setTimeLeft(nextDuration)
      setInitialTime(nextDuration)
    } catch (e) {
      setError(`Complete session: ${e.message}`)
    }
  }, [currentSession, sessionType, soundEnabled])

  // Enhanced Timer logic with better accuracy
  useEffect(() => {
    if (!isTimerRunning || timeLeft <= 0) {
      clearInterval(intervalRef.current)
      if (timeLeft <= 0 && currentSession) {
        completeSession()
      }
      return
    }

    // Use more accurate timing based on actual elapsed time
    intervalRef.current = setInterval(() => {
      if (sessionStartTime && !isPaused) {
        const now = Date.now()
        const elapsed = Math.floor((now - sessionStartTime.getTime()) / 1000) - totalPausedTime
        const remaining = Math.max(0, initialTime - elapsed)
        setTimeLeft(remaining)
      }
    }, 100) // Update more frequently for smoother animation

    return () => clearInterval(intervalRef.current)
  }, [
    isTimerRunning,
    timeLeft,
    sessionStartTime,
    totalPausedTime,
    isPaused,
    initialTime,
    currentSession,
    completeSession,
  ])

  // Enhanced Timer Controls
  const pauseTimer = useCallback(() => {
    if (isTimerRunning && !isPaused) {
      setIsPaused(true)
      setIsTimerRunning(false)
      pauseStartRef.current = Date.now()
    }
  }, [isTimerRunning, isPaused])

  const resumeTimer = useCallback(() => {
    if (isPaused && pauseStartRef.current) {
      const pauseDuration = Math.floor((Date.now() - pauseStartRef.current) / 1000)
      setTotalPausedTime((prev) => prev + pauseDuration)
      setIsPaused(false)
      setIsTimerRunning(true)
      pauseStartRef.current = null
    }
  }, [isPaused])

  const resetTimer = useCallback(() => {
    setIsTimerRunning(false)
    setIsPaused(false)
    setCurrentSession(null)
    setTotalPausedTime(0)
    setSessionStartTime(null)
    const duration = DURATIONS[sessionType]
    setTimeLeft(duration)
    setInitialTime(duration)
    clearInterval(intervalRef.current)
  }, [sessionType])

  const switchSessionType = useCallback(
    (type) => {
      if (currentSession) return // Can't switch during active session

      setSessionType(type)
      const duration = DURATIONS[type]
      setTimeLeft(duration)
      setInitialTime(duration)
      setSelectedTaskId(null) // Reset task selection
    },
    [currentSession],
  )

  // Enhanced Keyboard shortcuts
  const handleKey = useCallback(
    (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return

      switch (e.code) {
        case "Space":
          e.preventDefault()
          if (currentSession) {
            if (isPaused) {
              resumeTimer()
            } else if (isTimerRunning) {
              pauseTimer()
            } else {
              setIsTimerRunning(true)
            }
          } else {
            startPomodoro()
          }
          break
        case "KeyR":
          e.preventDefault()
          resetTimer()
          break
        case "KeyW":
          e.preventDefault()
          switchSessionType("work")
          break
        case "KeyB":
          e.preventDefault()
          switchSessionType("break")
          break
        case "KeyM":
          e.preventDefault()
          setSoundEnabled((prev) => !prev)
          break
      }
    },
    [currentSession, isPaused, isTimerRunning, pauseTimer, resumeTimer, resetTimer, switchSessionType],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [handleKey])

  // Memoised data
  const pendingTodos = useMemo(() => todos.filter((t) => !t.completed), [todos])

  // Render
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Todo App</h1>
          <p className="text-gray-600">3-Tier Architecture Demo</p>
        </div>

        {/* Stats Dashboard */}
        <Stats stats={stats} />

        {/* Enhanced Pomodoro Timer */}
        <section
          tabIndex={0}
          aria-label="Pomodoro timer – Space: play/pause, R: reset, W: work mode, B: break mode, M: toggle sound"
          className="bg-white rounded-lg shadow-md p-6 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-red-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">Pomodoro Timer</h2>
            </div>
            <button
              onClick={() => setSoundEnabled((s) => !s)}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label={soundEnabled ? "Mute sound (M)" : "Enable sound (M)"}
              title={soundEnabled ? "Mute sound (M)" : "Enable sound (M)"}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>

          <EnhancedTimerDisplay
            timeLeft={timeLeft}
            initialTime={initialTime}
            sessionType={sessionType}
            currentSession={currentSession}
            pendingTodos={pendingTodos}
            selectedTaskId={selectedTaskId}
            setSelectedTaskId={setSelectedTaskId}
            isPaused={isPaused}
          />

          <EnhancedTimerControls
            sessionType={sessionType}
            switchSessionType={switchSessionType}
            currentSession={currentSession}
            isTimerRunning={isTimerRunning}
            isPaused={isPaused}
            startPomodoro={startPomodoro}
            pauseTimer={pauseTimer}
            resumeTimer={resumeTimer}
            resetTimer={resetTimer}
          />

          {/* Keyboard shortcuts help */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            <kbd className="px-1 py-0.5 bg-gray-100 rounded">Space</kbd> Play/Pause •{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded">R</kbd> Reset •{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded">W</kbd> Work •{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded">B</kbd> Break •{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded">M</kbd> Sound
          </div>
        </section>

        {/* Add Todo Form */}
        <form onSubmit={createTodo} className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a new task..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !newTask.trim()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Plus size={16} />
              {loading ? "Adding…" : "Add"}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center">
            <X size={16} className="mr-2 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-red-500 hover:text-red-700">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Todo List */}
        <TodoList todos={todos} toggleTodo={toggleTodo} deleteTodo={deleteTodo} />

        {/* Footer */}
        <footer className="text-center mt-8 text-gray-500 text-sm">
          Frontend: React | Backend: Flask | Database: SQLite
          <br />
          Features: Todo Management + Enhanced Pomodoro Timer
        </footer>

        {/* Enhanced Audio element with multiple sounds */}
        <audio ref={audioRef} preload="auto">
          <source
            src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU..."
            type="audio/wav"
          />
        </audio>
      </div>
    </div>
  )
}

/* ==================================================================== */
/* Enhanced Sub-components                                              */
/* ==================================================================== */

function Stats({ stats }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center mb-4">
        <BarChart3 className="h-5 w-5 text-indigo-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-800">Statistics</h2>
      </div>

      {/* Todo Stats */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-600 mb-3">Tasks</h3>
        <div className="grid grid-cols-4 gap-4">
          <StatBox value={stats.todos.total} label="Total" color="text-blue-600" />
          <StatBox value={stats.todos.completed} label="Done" color="text-green-600" />
          <StatBox value={stats.todos.pending} label="Pending" color="text-orange-600" />
          <StatBox value={`${stats.todos.completion_rate}%`} label="Rate" color="text-purple-600" />
        </div>
      </div>

      {/* Pomodoro Stats */}
      <div>
        <h3 className="text-sm font-medium text-gray-600 mb-3">Focus</h3>
        <div className="grid grid-cols-4 gap-4">
          <StatBox value={stats.pomodoro.work_sessions} label="Work" color="text-red-600" />
          <StatBox value={stats.pomodoro.break_sessions} label="Breaks" color="text-blue-600" />
          <StatBox value={stats.pomodoro.focus_time_minutes} label="Minutes" color="text-green-600" />
          <StatBox value={stats.pomodoro.completed_sessions} label="Sessions" color="text-purple-600" />
        </div>
      </div>
    </div>
  )
}

const StatBox = ({ value, label, color }) => (
  <div className="text-center">
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    <div className="text-sm text-gray-600">{label}</div>
  </div>
)

function EnhancedTimerDisplay({
  timeLeft,
  initialTime,
  sessionType,
  currentSession,
  pendingTodos,
  selectedTaskId,
  setSelectedTaskId,
  isPaused,
}) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const progress = initialTime > 0 ? (initialTime - timeLeft) / initialTime : 0
  const strokeDashoffset = circumference - progress * circumference

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="text-center">
      {/* Enhanced circular progress */}
      <div className="relative w-48 h-48 mx-auto mb-6">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
          {/* Background circle */}
          <circle cx="80" cy="80" r={radius} strokeWidth="8" className="stroke-gray-200" fill="transparent" />
          {/* Progress circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`transition-all duration-300 ${
              sessionType === "work"
                ? "stroke-red-500"
                : sessionType === "break"
                  ? "stroke-blue-500"
                  : "stroke-green-500"
            }`}
            fill="transparent"
          />
        </svg>

        {/* Timer display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className={`text-4xl font-mono font-bold transition-colors ${
              isPaused ? "text-yellow-600" : "text-gray-800"
            }`}
          >
            {formatTime(timeLeft)}
          </div>
          {isPaused && <div className="text-sm text-yellow-600 font-medium mt-1">PAUSED</div>}
        </div>
      </div>

      {/* Session type indicator */}
      <div className="mb-4">
        <span
          className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            sessionType === "work"
              ? "bg-red-100 text-red-800"
              : sessionType === "break"
                ? "bg-blue-100 text-blue-800"
                : "bg-green-100 text-green-800"
          }`}
        >
          {sessionType === "work" ? (
            <>
              <Clock size={16} className="mr-2" />
              Work Session
            </>
          ) : (
            <>
              <Coffee size={16} className="mr-2" />
              Break Time
            </>
          )}
        </span>
      </div>

      {/* Task selector for work sessions */}
      {!currentSession && sessionType === "work" && (
        <div className="mb-4">
          {pendingTodos.length > 0 ? (
            <select
              value={selectedTaskId || ""}
              onChange={(e) => setSelectedTaskId(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">— Select a task (optional) —</option>
              {pendingTodos.map((todo) => (
                <option key={todo.id} value={todo.id}>
                  {todo.task.length > 50 ? `${todo.task.substring(0, 50)}...` : todo.task}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-500 italic">No pending tasks available</p>
          )}
        </div>
      )}

      {/* Active task display */}
      {currentSession && currentSession.task && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
          <div className="text-sm text-gray-600 mb-1">Currently working on:</div>
          <div className="font-medium text-gray-800">{currentSession.task}</div>
        </div>
      )}
    </div>
  )
}

function EnhancedTimerControls({
  sessionType,
  switchSessionType,
  currentSession,
  isTimerRunning,
  isPaused,
  startPomodoro,
  pauseTimer,
  resumeTimer,
  resetTimer,
}) {
  return (
    <>
      {/* Main controls */}
      <div className="flex justify-center gap-3 mb-6">
        {!currentSession ? (
          <button
            onClick={startPomodoro}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2 font-medium transition-colors"
          >
            <Play size={18} />
            Start {sessionType === "work" ? "Work" : "Break"}
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={resumeTimer}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2 font-medium transition-colors"
              >
                <Play size={18} />
                Resume
              </button>
            ) : isTimerRunning ? (
              <button
                onClick={pauseTimer}
                className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 flex items-center gap-2 font-medium transition-colors"
              >
                <Pause size={18} />
                Pause
              </button>
            ) : (
              <button
                onClick={resumeTimer}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2 font-medium transition-colors"
              >
                <Play size={18} />
                Resume
              </button>
            )}

            <button
              onClick={resetTimer}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center gap-2 font-medium transition-colors"
            >
              <RotateCcw size={18} />
              Reset
            </button>
          </>
        )}
      </div>

      {/* Session type toggles */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => switchSessionType("work")}
          disabled={!!currentSession}
          className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 ${
            sessionType === "work"
              ? "bg-red-600 text-white focus:ring-red-500"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Work (25min)
        </button>
        <button
          onClick={() => switchSessionType("break")}
          disabled={!!currentSession}
          className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 ${
            sessionType === "break"
              ? "bg-blue-600 text-white focus:ring-blue-500"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Break (5min)
        </button>
      </div>
    </>
  )
}

function TodoList({ todos, toggleTodo, deleteTodo }) {
  if (!todos.length) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
        <div className="text-4xl mb-4">📝</div>
        <p className="text-lg mb-2">No tasks yet</p>
        <p className="text-sm">Add a task above to get started with your productivity journey!</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Your Tasks ({todos.length})</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {todos.map((todo) => (
          <div key={todo.id} className="p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
            <button
              onClick={() => toggleTodo(todo.id, todo.completed)}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                todo.completed
                  ? "bg-green-500 border-green-500 focus:ring-green-500"
                  : "border-gray-300 hover:border-green-500 focus:ring-green-500"
              }`}
              aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
            >
              {todo.completed && <Check size={14} className="text-white" />}
            </button>

            <div className="flex-1 min-w-0">
              <div className={`transition-all ${todo.completed ? "line-through text-gray-500" : "text-gray-800"}`}>
                {todo.task}
              </div>
              <div className="text-xs text-gray-400 mt-1">{new Date(todo.created_at).toLocaleString()}</div>
            </div>

            <button
              onClick={() => deleteTodo(todo.id)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Delete task"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
