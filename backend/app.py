from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Database setup
DATABASE = "todos.db"


def init_db():
    """Initialize the database with todos and pomodoro_sessions tables"""
    conn = sqlite3.connect(DATABASE)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task TEXT NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS pomodoro_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            session_type TEXT NOT NULL DEFAULT 'work',
            duration INTEGER NOT NULL DEFAULT 25,
            completed BOOLEAN NOT NULL DEFAULT 0,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES todos (id)
        )
    """)

    conn.commit()
    conn.close()


def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify(
        {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "service": "todo-api",
        }
    )


@app.route("/api/todos", methods=["GET"])
def get_todos():
    """Get all todos"""
    conn = get_db_connection()
    todos = conn.execute("SELECT * FROM todos ORDER BY created_at DESC").fetchall()
    conn.close()

    return jsonify(
        [
            {
                "id": todo["id"],
                "task": todo["task"],
                "completed": bool(todo["completed"]),
                "created_at": todo["created_at"],
            }
            for todo in todos
        ]
    )


@app.route("/api/todos", methods=["POST"])
def create_todo():
    """Create a new todo"""
    data = request.get_json()

    if not data or "task" not in data:
        return jsonify({"error": "Task is required"}), 400

    conn = get_db_connection()
    cursor = conn.execute("INSERT INTO todos (task) VALUES (?)", (data["task"],))
    todo_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return (
        jsonify(
            {
                "id": todo_id,
                "task": data["task"],
                "completed": False,
                "message": "Todo created successfully",
            }
        ),
        201,
    )


@app.route("/api/todos/<int:todo_id>", methods=["PUT"])
def update_todo(todo_id):
    """Update a todo"""
    data = request.get_json()

    conn = get_db_connection()
    todo = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()

    if not todo:
        conn.close()
        return jsonify({"error": "Todo not found"}), 404

    task = data.get("task", todo["task"])
    completed = data.get("completed", todo["completed"])

    conn.execute(
        "UPDATE todos SET task = ?, completed = ? WHERE id = ?",
        (task, completed, todo_id),
    )
    conn.commit()
    conn.close()

    return jsonify(
        {
            "id": todo_id,
            "task": task,
            "completed": bool(completed),
            "message": "Todo updated successfully",
        }
    )


@app.route("/api/todos/<int:todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    """Delete a todo"""
    conn = get_db_connection()
    todo = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()

    if not todo:
        conn.close()
        return jsonify({"error": "Todo not found"}), 404

    conn.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Todo deleted successfully"})


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Get todo and pomodoro statistics"""
    conn = get_db_connection()

    # Todo stats
    total = conn.execute("SELECT COUNT(*) as count FROM todos").fetchone()["count"]
    completed = conn.execute(
        "SELECT COUNT(*) as count FROM todos WHERE completed = 1"
    ).fetchone()["count"]
    pending = total - completed

    # Pomodoro stats
    total_sessions = conn.execute(
        "SELECT COUNT(*) as count FROM pomodoro_sessions"
    ).fetchone()["count"]
    completed_sessions = conn.execute(
        "SELECT COUNT(*) as count FROM pomodoro_sessions WHERE completed = 1"
    ).fetchone()["count"]
    work_sessions = conn.execute(
        'SELECT COUNT(*) as count FROM pomodoro_sessions WHERE session_type = "work" AND completed = 1'
    ).fetchone()["count"]
    break_sessions = conn.execute(
        'SELECT COUNT(*) as count FROM pomodoro_sessions WHERE session_type = "break" AND completed = 1'
    ).fetchone()["count"]

    # Calculate total focus time (completed work sessions * duration)
    focus_time = (
        conn.execute(
            'SELECT SUM(duration) as total FROM pomodoro_sessions WHERE session_type = "work" AND completed = 1'
        ).fetchone()["total"]
        or 0
    )

    conn.close()

    return jsonify(
        {
            "todos": {
                "total": total,
                "completed": completed,
                "pending": pending,
                "completion_rate": round(
                    (completed / total * 100) if total > 0 else 0, 2
                ),
            },
            "pomodoro": {
                "total_sessions": total_sessions,
                "completed_sessions": completed_sessions,
                "work_sessions": work_sessions,
                "break_sessions": break_sessions,
                "focus_time_minutes": focus_time,
            },
        }
    )


# Pomodoro API endpoints
@app.route("/api/pomodoro/sessions", methods=["GET"])
def get_pomodoro_sessions():
    """Get all pomodoro sessions"""
    conn = get_db_connection()
    sessions = conn.execute("""
        SELECT p.*, t.task 
        FROM pomodoro_sessions p 
        LEFT JOIN todos t ON p.task_id = t.id 
        ORDER BY p.started_at DESC
    """).fetchall()
    conn.close()

    return jsonify(
        [
            {
                "id": session["id"],
                "task_id": session["task_id"],
                "task": session["task"],
                "session_type": session["session_type"],
                "duration": session["duration"],
                "completed": bool(session["completed"]),
                "started_at": session["started_at"],
                "completed_at": session["completed_at"],
            }
            for session in sessions
        ]
    )


@app.route("/api/pomodoro/sessions", methods=["POST"])
def create_pomodoro_session():
    """Create a new pomodoro session"""
    data = request.get_json()

    if not data or "session_type" not in data:
        return jsonify({"error": "Session type is required"}), 400

    session_type = data["session_type"]  # 'work' or 'break'
    task_id = data.get("task_id")
    duration = data.get("duration", 25 if session_type == "work" else 5)

    conn = get_db_connection()
    cursor = conn.execute(
        "INSERT INTO pomodoro_sessions (task_id, session_type, duration) VALUES (?, ?, ?)",
        (task_id, session_type, duration),
    )
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return (
        jsonify(
            {
                "id": session_id,
                "task_id": task_id,
                "session_type": session_type,
                "duration": duration,
                "completed": False,
                "message": "Pomodoro session created successfully",
            }
        ),
        201,
    )


@app.route("/api/pomodoro/sessions/<int:session_id>/complete", methods=["PUT"])
def complete_pomodoro_session(session_id):
    """Mark a pomodoro session as completed"""
    conn = get_db_connection()
    session = conn.execute(
        "SELECT * FROM pomodoro_sessions WHERE id = ?", (session_id,)
    ).fetchone()

    if not session:
        conn.close()
        return jsonify({"error": "Session not found"}), 404

    conn.execute(
        "UPDATE pomodoro_sessions SET completed = ?, completed_at = ? WHERE id = ?",
        (True, datetime.now().isoformat(), session_id),
    )
    conn.commit()
    conn.close()

    return jsonify(
        {
            "id": session_id,
            "completed": True,
            "message": "Pomodoro session completed successfully",
        }
    )


@app.route("/api/pomodoro/active", methods=["GET"])
def get_active_session():
    """Get the currently active pomodoro session"""
    conn = get_db_connection()
    session = conn.execute("""
        SELECT p.*, t.task 
        FROM pomodoro_sessions p 
        LEFT JOIN todos t ON p.task_id = t.id 
        WHERE p.completed = 0 
        ORDER BY p.started_at DESC 
        LIMIT 1
    """).fetchone()
    conn.close()

    if not session:
        return jsonify({"active_session": None})

    return jsonify(
        {
            "active_session": {
                "id": session["id"],
                "task_id": session["task_id"],
                "task": session["task"],
                "session_type": session["session_type"],
                "duration": session["duration"],
                "started_at": session["started_at"],
            }
        }
    )


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
