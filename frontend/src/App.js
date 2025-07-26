import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Check, X, BarChart3, Play, Pause, Square, Clock, Coffee } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

export default function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [stats, setStats] = useState({ 
    todos: { total: 0, completed: 0, pending: 0, completion_rate: 0 },
    pomodoro: { total_sessions: 0, completed_sessions: 0, work_sessions: 0, break_sessions: 0, focus_time_minutes: 0 }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pomodoro state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionType, setSessionType] = useState('work'); // 'work' or 'break'
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const intervalRef = useRef(null);

  // Debug: Log API configuration
  console.log('API_BASE:', API_BASE);
  console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

  // Fetch todos from API
  const fetchTodos = async () => {
    const url = `${API_BASE}/todos`;
    console.log('Fetching todos from:', url);
    
    try {
      const response = await fetch(url);
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Todos data received:', data);
        setTodos(data);
        setError(''); // Clear any previous errors
      } else {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        setError(`Failed to fetch todos: ${response.status} ${errorText}`);
      }
    } catch (err) {
      console.error('Network error:', err);
      setError(`Connection error: ${err.message}`);
    }
  };

  // Fetch stats from API
  const fetchStats = async () => {
    const url = `${API_BASE}/stats`;
    console.log('Fetching stats from:', url);
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('Stats data received:', data);
        setStats(data);
      } else {
        console.error('Stats API Error:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Check for active pomodoro session
  const checkActiveSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/pomodoro/active`);
      if (response.ok) {
        const data = await response.json();
        if (data.active_session) {
          setCurrentSession(data.active_session);
          // Calculate remaining time
          const startTime = new Date(data.active_session.started_at);
          const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
          const remaining = (data.active_session.duration * 60) - elapsed;
          setTimeLeft(Math.max(0, remaining));
          setSessionType(data.active_session.session_type);
          setSelectedTaskId(data.active_session.task_id);
        }
      }
    } catch (err) {
      console.error('Failed to check active session:', err);
    }
  };

  // Create new todo
  const createTodo = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task: newTask }),
      });

      if (response.ok) {
        setNewTask('');
        fetchTodos();
        fetchStats();
        setError('');
      } else {
        setError('Failed to create todo');
      }
    } catch (err) {
      setError('Connection error');
    }
    setLoading(false);
  };

  // Toggle todo completion
  const toggleTodo = async (id, completed) => {
    try {
      const response = await fetch(`${API_BASE}/todos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: !completed }),
      });

      if (response.ok) {
        fetchTodos();
        fetchStats();
      } else {
        setError('Failed to update todo');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  // Delete todo
  const deleteTodo = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/todos/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTodos();
        fetchStats();
      } else {
        setError('Failed to delete todo');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  // Start pomodoro session
  const startPomodoro = async () => {
    try {
      const duration = sessionType === 'work' ? 25 : 5;
      const response = await fetch(`${API_BASE}/pomodoro/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_type: sessionType,
          task_id: selectedTaskId,
          duration: duration
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data);
        setTimeLeft(duration * 60);
        setIsTimerRunning(true);
        setError('');
      } else {
        setError('Failed to start pomodoro session');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  // Complete pomodoro session
  const completeSession = async () => {
    if (!currentSession) return;

    try {
      const response = await fetch(`${API_BASE}/pomodoro/sessions/${currentSession.id}/complete`, {
        method: 'PUT',
      });

      if (response.ok) {
        setCurrentSession(null);
        setIsTimerRunning(false);
        fetchStats();
        
        // Auto-suggest break or work session
        if (sessionType === 'work') {
          setSessionType('break');
          setTimeLeft(5 * 60);
        } else {
          setSessionType('work');
          setTimeLeft(25 * 60);
        }
      }
    } catch (err) {
      setError('Failed to complete session');
    }
  };

  // Timer logic
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            completeSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isTimerRunning, timeLeft]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Reset timer
  const resetTimer = () => {
    setIsTimerRunning(false);
    setCurrentSession(null);
    setTimeLeft(sessionType === 'work' ? 25 * 60 : 5 * 60);
    clearInterval(intervalRef.current);
  };

  useEffect(() => {
    fetchTodos();
    fetchStats();
    checkActiveSession();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Todo App</h1>
          <p className="text-gray-600">3-Tier Architecture Demo</p>
        </div>

        {/* Stats Dashboard */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center mb-4">
            <BarChart3 className="h-5 w-5 text-indigo-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Statistics</h2>
          </div>
          
          {/* Todo Stats */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-600 mb-3">Tasks</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.todos.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.todos.completed}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.todos.pending}</div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.todos.completion_rate}%</div>
                <div className="text-sm text-gray-600">Complete</div>
              </div>
            </div>
          </div>

          {/* Pomodoro Stats */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3">Pomodoro Focus</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.pomodoro.work_sessions}</div>
                <div className="text-sm text-gray-600">Work</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.pomodoro.break_sessions}</div>
                <div className="text-sm text-gray-600">Breaks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.pomodoro.focus_time_minutes}</div>
                <div className="text-sm text-gray-600">Minutes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.pomodoro.completed_sessions}</div>
                <div className="text-sm text-gray-600">Sessions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Pomodoro Timer */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center mb-4">
            <Clock className="h-5 w-5 text-red-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Pomodoro Timer</h2>
          </div>
          
          <div className="text-center">
            {/* Timer Display */}
            <div className={`text-6xl font-mono font-bold mb-4 ${
              sessionType === 'work' ? 'text-red-600' : 'text-blue-600'
            }`}>
              {formatTime(timeLeft)}
            </div>
            
            {/* Session Type */}
            <div className="flex justify-center mb-4">
              <div className={`flex items-center px-4 py-2 rounded-full ${
                sessionType === 'work' 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {sessionType === 'work' ? (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Work Session
                  </>
                ) : (
                  <>
                    <Coffee className="h-4 w-4 mr-2" />
                    Break Time
                  </>
                )}
              </div>
            </div>
            
            {/* Task Selection for Work Sessions */}
            {sessionType === 'work' && !currentSession && (
              <div className="mb-4">
                <select
                  value={selectedTaskId || ''}
                  onChange={(e) => setSelectedTaskId(e.target.value || null)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a task (optional)</option>
                  {todos.filter(todo => !todo.completed).map(todo => (
                    <option key={todo.id} value={todo.id}>
                      {todo.task}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Current Task Display */}
            {currentSession && currentSession.task && (
              <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                <div className="text-sm text-gray-600">Working on:</div>
                <div className="font-medium">{currentSession.task}</div>
              </div>
            )}
            
            {/* Timer Controls */}
            <div className="flex justify-center gap-2 mb-4">
              {!currentSession ? (
                <button
                  onClick={startPomodoro}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start {sessionType === 'work' ? 'Work' : 'Break'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className={`px-6 py-2 text-white rounded-lg flex items-center gap-2 ${
                      isTimerRunning 
                        ? 'bg-yellow-600 hover:bg-yellow-700' 
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isTimerRunning ? (
                      <>
                        <Pause className="h-4 w-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Resume
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={resetTimer}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </button>
                </>
              )}
            </div>
            
            {/* Session Type Toggle */}
            <div className="flex justify-center gap-2">
              <button
                onClick={() => {
                  if (!currentSession) {
                    setSessionType('work');
                    setTimeLeft(25 * 60);
                  }
                }}
                disabled={!!currentSession}
                className={`px-4 py-2 rounded-lg text-sm ${
                  sessionType === 'work'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                Work (25min)
              </button>
              <button
                onClick={() => {
                  if (!currentSession) {
                    setSessionType('break');
                    setTimeLeft(5 * 60);
                  }
                }}
                disabled={!!currentSession}
                className={`px-4 py-2 rounded-lg text-sm ${
                  sessionType === 'break'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                Break (5min)
              </button>
            </div>
          </div>
        </div>

        {/* Add Todo Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          {/* Debug info */}
          <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
            <div><strong>API Base:</strong> {API_BASE}</div>
            <div><strong>Full API URL:</strong> {`${API_BASE}/todos`}</div>
            <button 
              onClick={async () => {
                console.log('Testing API connection...');
                try {
                  const response = await fetch(`${API_BASE}/todos`);
                  console.log('Test response:', response.status, response.statusText);
                  const text = await response.text();
                  console.log('Test response body:', text);
                } catch (err) {
                  console.error('Test failed:', err);
                }
              }}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs"
            >
              Test API Connection
            </button>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a new task..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
              onKeyPress={(e) => e.key === 'Enter' && createTodo(e)}
            />
            <button
              onClick={createTodo}
              disabled={loading || !newTask.trim()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center">
              <X className="h-4 w-4 mr-2" />
              {error}
            </div>
          </div>
        )}

        {/* Todo List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Your Tasks ({todos.length})
            </h2>
          </div>
          
          {todos.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-4">📝</div>
              <p>No tasks yet. Add one above to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {todos.map((todo) => (
                <div key={todo.id} className="p-4 flex items-center gap-3 hover:bg-gray-50">
                  <button
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      todo.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-green-500'
                    }`}
                  >
                    {todo.completed && <Check className="h-3 w-3" />}
                  </button>
                  
                  <div className="flex-1">
                    <div className={`${
                      todo.completed 
                        ? 'text-gray-500 line-through' 
                        : 'text-gray-800'
                    }`}>
                      {todo.task}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(todo.created_at).toLocaleString()}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Frontend: React | Backend: Flask | Database: SQLite</p>
          <p>Features: Todo Management + Pomodoro Timer</p>
        </div>
        </div>
      </div>
  );
}