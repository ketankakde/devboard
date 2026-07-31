import { FormEvent, useEffect, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

// ── Types ──────────────────────────────────────────────────────────────────────
// IDs are MongoDB ObjectId strings
type Project  = { id: string; title: string; description?: string; createdAt: string }
type Task     = { id: string; projectId: string; title: string; description?: string; status: Status; priority: Priority; dueDate?: string }
type Collab   = { id: string; projectId: string; userId: string; createdAt: string }
type Status   = 'TODO' | 'IN_PROGRESS' | 'DONE'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH'
type Page<T>  = { content: T[]; totalElements: number; totalPages: number }

// ── API ────────────────────────────────────────────────────────────────────────
const api = async <T,>(path: string, opts: RequestInit = {}): Promise<T> => {
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } })
  const b = await r.json().catch(() => null)
  if (!r.ok) throw new Error(b?.message || `Error ${r.status}`)
  return b as T
}
const kh = (k: string) => ({ 'X-API-Key': k })

// ── Avatar colours ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7c3aed','#a855f7','#6366f1','#8b5cf6','#c084fc','#818cf8']
function strHash(s: string) { return s ? [...s].reduce((a, c) => a + c.charCodeAt(0), 0) : 0 }
function initials(name: string) { return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) }
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const color = AVATAR_COLORS[strHash(name || '') % AVATAR_COLORS.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.36, flexShrink: 0, border: '2px solid #1e1b2e' }}>
      {initials(name)}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  LANDING PAGE
// ══════════════════════════════════════════════════════════════════════════════
function LandingPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing">
      <nav className="land-nav">
        <div className="land-logo"><span className="land-logo-icon">◆</span> DevBoard</div>
        <div className="land-nav-links">
          <a href="#">Pricing</a><a href="#">Features</a><a href="#">Use cases ▾</a>
        </div>
        <div className="land-nav-actions">
          <button className="land-signin" onClick={onEnter}>Sign In</button>
          <button className="land-demo"   onClick={onEnter}>Get started</button>
        </div>
      </nav>
      <section className="land-hero">
        <h1 className="land-headline">
          Team collaboration for<br />
          <span className="land-headline-accent">new startups that scale</span>
        </h1>
        <div className="orbital-wrap">
          <div className="ring ring-1" /><div className="ring ring-2" /><div className="ring ring-3" />
          <button className="orbital-cta" onClick={onEnter}>
            <span className="orbital-cta-icon">✦</span> Get started for free
          </button>
          <div className="orb orb-top-left"><img src="https://i.pravatar.cc/72?img=12" alt="" /></div>
          <div className="orb orb-top-center"><img src="https://i.pravatar.cc/72?img=33" alt="" /></div>
          <div className="orb orb-top-right"><img src="https://i.pravatar.cc/72?img=47" alt="" /></div>
          <div className="orb orb-bottom-left"><img src="https://i.pravatar.cc/72?img=52" alt="" /></div>
          <div className="orb orb-bottom-center"><img src="https://i.pravatar.cc/72?img=68" alt="" /></div>
          <div className="orb orb-bottom-right"><img src="https://i.pravatar.cc/72?img=25" alt="" /></div>
          <div className="icon-badge badge-lock">🔒</div>
          <div className="icon-badge badge-cursor">👆</div>
          <div className="icon-badge badge-like">👍</div>
        </div>
        <div className="land-cursor">▶</div>
      </section>
      <footer className="land-backers">
        <p>Backed by leading e-commerce investors and founders</p>
        <div className="backer-logos">
          <span>⚡ Flash</span><span>◉ Invert</span><span>ℍ Hitech</span>
          <span>⚙ Proline</span><span>◎ DevWise</span><span>⚡ Flash</span>
        </div>
      </footer>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  AUTH SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function AuthScreen({ onAuthenticated, onBack }: { onAuthenticated: (t: string) => void; onBack: () => void }) {
  const [mode, setMode]       = useState<'login'|'register'>('login')
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('')
    if (mode === 'register' && password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    try {
      if (mode === 'register')
        await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })
      const { accessToken } = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      })
      onAuthenticated(accessToken)
    } catch (err) { setError((err as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-screen">
      <button className="auth-back" onClick={onBack}>← Back</button>
      <div className="auth-box">
        <div className="auth-brand"><span>◆</span> DevBoard</div>
        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
        </div>
        <h2 className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h2>
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label>Full name<input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" required /></label>
          )}
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPass(e.target.value)} placeholder="Min. 8 characters" minLength={8} required /></label>
          {mode === 'register' && (
            <label>Confirm password<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required /></label>
          )}
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="auth-switch">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  API-KEY SETUP SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function SetupScreen({ token, onReady, onLogout }: { token: string; onReady: (k: string) => void; onLogout: () => void }) {
  const [error, setError] = useState('')
  const generate = async () => {
    try {
      const { apiKey } = await api<{ apiKey: string }>('/auth/api-key', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      localStorage.setItem('devboard_key', apiKey)
      onReady(apiKey)
    } catch (e) { setError((e as Error).message) }
  }
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-icon">⌘</div>
        <h2>One last step</h2>
        <p>DevBoard uses an API key to secure your projects. Generate yours to continue.</p>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn-primary" onClick={generate}>Generate API key</button>
        <button className="btn-ghost" onClick={onLogout}>Sign out</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODAL
// ══════════════════════════════════════════════════════════════════════════════
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-box" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  KANBAN CARD
// ══════════════════════════════════════════════════════════════════════════════
const PRIORITY_COLORS: Record<Priority, string> = {
  HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e',
}

function KanbanCard({ task, apiKey, onUpdate, onDelete }: {
  task: Task; apiKey: string; onUpdate: (t: Task) => void; onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const move = async (status: Status) => {
    setMenuOpen(false)
    try {
      const updated = await api<Task>(`/tasks/${task.id}`, {
        method: 'PUT', headers: kh(apiKey),
        body: JSON.stringify({ title: task.title, description: task.description || '', priority: task.priority, dueDate: task.dueDate || null, status }),
      })
      onUpdate(updated)
    } catch (e) { alert((e as Error).message) }
  }

  const del = async () => {
    setMenuOpen(false)
    if (!confirm(`Delete "${task.title}"?`)) return
    try {
      await api(`/tasks/${task.id}`, { method: 'DELETE', headers: kh(apiKey) })
      onDelete(task.id)
    } catch (e) { alert((e as Error).message) }
  }

  return (
    <>
      <div className="k-card">
        <div className="k-card-head">
          <span className="k-priority-tag" style={{ background: PRIORITY_COLORS[task.priority] + '22', color: PRIORITY_COLORS[task.priority] }}>
            {task.priority}
          </span>
          <div style={{ position: 'relative' }}>
            <button className="k-menu-btn" onClick={() => setMenuOpen(v => !v)}>⋯</button>
            {menuOpen && (
              <div className="k-dropdown">
                <button onClick={() => { setMenuOpen(false); setEditing(true) }}>✎ Edit</button>
                {task.status !== 'IN_PROGRESS' && <button onClick={() => move('IN_PROGRESS')}>→ In Progress</button>}
                {task.status !== 'DONE'        && <button onClick={() => move('DONE')}>✓ Mark Done</button>}
                {task.status !== 'TODO'        && <button onClick={() => move('TODO')}>↩ Reopen</button>}
                <button className="danger" onClick={del}>✕ Delete</button>
              </div>
            )}
          </div>
        </div>
        <h4 className="k-card-title">{task.title}</h4>
        {task.description && <p className="k-card-desc">{task.description}</p>}
        <div className="k-card-foot">
          {task.dueDate && <span className="k-due">◷ {new Date(task.dueDate).toLocaleDateString()}</span>}
          <Avatar name={task.title} size={24} />
        </div>
      </div>
      {editing && (
        <EditTaskModal task={task} apiKey={apiKey}
          onSave={t => { onUpdate(t); setEditing(false) }}
          onClose={() => setEditing(false)} />
      )}
    </>
  )
}

// ── Edit Task Modal ────────────────────────────────────────────────────────────
function EditTaskModal({ task, apiKey, onSave, onClose }: {
  task: Task; apiKey: string; onSave: (t: Task) => void; onClose: () => void
}) {
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('')
    setLoading(true)
    try {
      const f = new FormData(e.currentTarget)
      const updated = await api<Task>(`/tasks/${task.id}`, {
        method: 'PUT', headers: kh(apiKey),
        body: JSON.stringify({
          title:       f.get('title'),
          description: f.get('description') || '',
          status:      f.get('status'),
          priority:    f.get('priority'),
          dueDate:     f.get('dueDate') || null,
        }),
      })
      onSave(updated)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title="Edit task" onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <label>Title<input name="title" defaultValue={task.title} required /></label>
        <label>Description<textarea name="description" defaultValue={task.description || ''} /></label>
        <div className="form-row">
          <label>Status
            <select name="status" defaultValue={task.status}>
              <option value="TODO">New Request</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Complete</option>
            </select>
          </label>
          <label>Priority
            <select name="priority" defaultValue={task.priority}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>
        </div>
        <label>Due date<input name="dueDate" type="date" defaultValue={task.dueDate?.slice(0, 10) || ''} /></label>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn-primary full" disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</button>
      </form>
    </Modal>
  )
}

// ── Collaborators Modal ────────────────────────────────────────────────────────
// Members are looked up by email — the auth service returns their userId (string ObjectId)
// which is what project-service needs.
function CollabModal({ project, apiKey, onClose }: { project: Project; apiKey: string; onClose: () => void }) {
  const [list, setList]       = useState<Collab[]>([])
  const [email, setEmail]     = useState('')
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api<unknown>(`/projects/${project.id}/collaborators`, { headers: kh(apiKey) })
      .then(raw => setList(Array.isArray(raw) ? raw : []))
      .catch(e => setErr((e as Error).message))
  }, [project.id, apiKey])

  const add = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      // Look up the user by email to get their string userId
      const me = await api<{ id: string; email: string; name: string }>('/auth/me', {
        headers: { Authorization: `Bearer ${localStorage.getItem('devboard_token') || ''}` },
      })
      // We call /auth/register lookup — but actually the API doesn't expose a user-search
      // endpoint, so we accept a raw userId string directly (copied from /auth/me response)
      const c = await api<Collab>(`/projects/${project.id}/collaborators`, {
        method: 'POST', headers: kh(apiKey),
        body: JSON.stringify({ userId: email.trim() }),
      })
      setList(p => [...p, c]); setEmail('')
    } catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }

  const remove = async (userId: string) => {
    try {
      await api(`/projects/${project.id}/collaborators/${userId}`, { method: 'DELETE', headers: kh(apiKey) })
      setList(p => p.filter(c => c.userId !== userId))
    } catch (e) { setErr((e as Error).message) }
  }

  return (
    <Modal title={`Members — ${project.title}`} onClose={onClose}>
      <div className="collab-list">
        {list.length === 0 && <p className="muted-text">No members yet.</p>}
        {list.map(c => (
          <div key={c.id} className="collab-row">
            <Avatar name={c.userId} size={32} />
            <span className="collab-uid" title={c.userId}>ID: {c.userId.slice(-8)}</span>
            <button className="icon-danger" onClick={() => remove(c.userId)}>✕</button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="modal-form" style={{ marginTop: 16 }}>
        <label>
          Add by User ID
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Paste user ID from /auth/me"
            required
          />
        </label>
        <p className="muted-text" style={{ fontSize: '.75rem', marginTop: -8 }}>
          Get a user's ID from their profile (GET /auth/me returns <code style={{color:'#a78bfa'}}>"id"</code>)
        </p>
        {err && <p className="auth-error">{err}</p>}
        <button className="btn-primary full" disabled={loading}>{loading ? 'Adding…' : 'Add member'}</button>
      </form>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN APP (Kanban dashboard)
// ══════════════════════════════════════════════════════════════════════════════
const COLUMNS: { status: Status; label: string; color: string }[] = [
  { status: 'TODO',        label: 'New Request', color: '#7c3aed' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: '#f59e0b' },
  { status: 'DONE',        label: 'Complete',    color: '#22c55e' },
]

function AppDashboard({ token, apiKey, onLogout }: { token: string; apiKey: string; onLogout: () => void }) {
  const [projects, setProjects]     = useState<Project[]>([])
  const [selected, setSelected]     = useState<Project | null>(null)
  const [tasks, setTasks]           = useState<Task[]>([])
  const [notice, setNotice]         = useState('')
  const [showNewProject, setShowNP] = useState(false)
  const [showNewTask, setShowNT]    = useState(false)
  const [showCollabs, setShowColl]  = useState(false)
  const [sidebarOpen, setSidebar]   = useState(true)
  const [npLoading, setNpLoading]   = useState(false)
  const [ntLoading, setNtLoading]   = useState(false)
  const [npError, setNpError]       = useState('')
  const [ntError, setNtError]       = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizeId = <T,>(obj: any): T => {
    if (obj && !obj.id && obj._id) obj.id = String(obj._id)
    return obj as T
  }

  const loadProjects = useCallback(async () => {
    try {
      const raw = await api<unknown>('/projects', { headers: kh(apiKey) })
      console.log('loadProjects raw:', raw)
      const list: Project[] = Array.isArray(raw) ? raw.map(o => normalizeId<Project>(o)) : []
      console.log('loadProjects list:', list)
      setProjects(list)
      setSelected(cur => list.find(p => p.id === cur?.id) ?? list[0] ?? null)
    } catch (e) {
      console.error('loadProjects error:', e)
      setNotice((e as Error).message)
    }
  }, [apiKey])

  const loadTasks = useCallback(async (pid: string) => {
    try {
      const raw = await api<unknown>(`/projects/${pid}/tasks?size=100`, { headers: kh(apiKey) })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as Page<Task>)?.content)
          ? (raw as Page<Task>).content
          : []
      setTasks(items.map(o => normalizeId<Task>(o)))
    } catch (e) { setNotice((e as Error).message) }
  }, [apiKey])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => { if (selected?.id) loadTasks(selected.id); else setTasks([]) }, [selected?.id, loadTasks])

  const createProject = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setNpError(''); setNpLoading(true)
    try {
      const f = new FormData(e.currentTarget)
      const p = await api<Project>('/projects', {
        method: 'POST', headers: kh(apiKey),
        body: JSON.stringify({ title: f.get('title'), description: f.get('description') || '' }),
      })
      setProjects(cur => [p, ...cur]); setSelected(p); setShowNP(false)
    } catch (e) { setNpError((e as Error).message) }
    finally { setNpLoading(false) }
  }

  const deleteProject = async (id: string) => {
    if (!confirm('Delete this project and all its tasks?')) return
    try {
      await api(`/projects/${id}`, { method: 'DELETE', headers: kh(apiKey) })
      const rest = projects.filter(p => p.id !== id)
      setProjects(rest); setSelected(rest[0] ?? null)
    } catch (e) { setNotice((e as Error).message) }
  }

  const createTask = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setNtError(''); setNtLoading(true)
    if (!selected) return
    try {
      const f = new FormData(e.currentTarget)
      const t = await api<Task>(`/projects/${selected.id}/tasks`, {
        method: 'POST', headers: kh(apiKey),
        body: JSON.stringify({
          title:       f.get('title'),
          description: f.get('description') || '',
          priority:    f.get('priority'),
          dueDate:     f.get('dueDate') || null,
        }),
      })
      setTasks(cur => [t, ...cur]); setShowNT(false)
    } catch (e) { setNtError((e as Error).message) }
    finally { setNtLoading(false) }
  }

  const exportProject = async () => {
    if (!selected) return
    try {
      const data = await api<object>(`/projects/${selected.id}/export`, { headers: kh(apiKey) })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      a.download = `${selected.title.replace(/\s+/g, '_')}.json`; a.click()
    } catch (e) { setNotice((e as Error).message) }
  }

  const byStatus = (s: Status) => tasks.filter(t => t.status === s)

  return (
    <div className="dashboard">
      {/* ── Left Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sb-brand">
          <span className="sb-logo">◆</span>
          {sidebarOpen && <span>DevBoard</span>}
        </div>

        <div className="sb-icon-row">
          <button className="sb-icon active" title="Projects">⊞</button>
          <button className="sb-icon" title="Search">⌕</button>
          <button className="sb-icon" title="Notifications">🔔</button>
          <button className="sb-icon" title="Settings">⚙</button>
        </div>

        {sidebarOpen && (
          <>
            <p className="sb-section-label">FAVORITES</p>
            {projects.slice(0, 3).map(p => (
              <div key={`fav-${p.id}`}
                className={`sb-project-item ${selected?.id === p.id ? 'active' : ''}`}
                onClick={() => setSelected(p)}>
                <span className="sb-dot" style={{ background: AVATAR_COLORS[strHash(p.id) % AVATAR_COLORS.length] }} />
                <span className="sb-project-name">{p.title}</span>
              </div>
            ))}

            <p className="sb-section-label" style={{ marginTop: 16 }}>ALL PROJECTS</p>
            {projects.map(p => (
              <div key={`all-${p.id}`}
                className={`sb-project-item ${selected?.id === p.id ? 'active' : ''}`}
                onClick={() => setSelected(p)}>
                <span className="sb-dot" style={{ background: AVATAR_COLORS[strHash(p.id) % AVATAR_COLORS.length] }} />
                <span className="sb-project-name">{p.title}</span>
                <button className="sb-del" onClick={e => { e.stopPropagation(); deleteProject(p.id) }}>✕</button>
              </div>
            ))}
          </>
        )}

        <div className="sb-bottom">
          <button className="sb-new-project" onClick={() => setShowNP(true)}>
            {sidebarOpen ? '+ New Project' : '+'}
          </button>
          <button className="sb-icon" title="Collapse" onClick={() => setSidebar(v => !v)}>
            {sidebarOpen ? '‹' : '›'}
          </button>
          <button className="sb-icon" title="Sign out" onClick={onLogout}>⏻</button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="board-area">
        {/* Top bar */}
        <header className="board-header">
          <div className="board-breadcrumb">
            <span className="board-project-icon">◈</span>
            <span className="board-project-name">{selected?.title || 'Select a project'}</span>
            {selected?.description && <span className="board-sep">›</span>}
            {selected?.description && <span className="board-sub">{selected.description}</span>}
          </div>
          <div className="board-header-actions">
            {selected && (
              <>
                <button className="btn-ghost-sm" onClick={() => setShowColl(true)}>👥 Members</button>
                <button className="btn-ghost-sm" onClick={exportProject}>↓ Export</button>
                <button className="btn-primary-sm" onClick={() => { setNtError(''); setShowNT(true) }}>+ Add task</button>
              </>
            )}
            <div className="board-avatar-stack">
              {['Alice', 'Bob', 'Carol'].map(n => <Avatar key={n} name={n} size={30} />)}
              <div className="avatar-count">+{Math.max(0, tasks.length - 3)}</div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="board-tabs">
          <button className="board-tab active">⊞ Kanban</button>
          <button className="board-tab">≡ Table</button>
          <button className="board-tab">≣ List View</button>
        </div>

        {notice && (
          <div className="board-notice">
            {notice} <button onClick={() => setNotice('')}>✕</button>
          </div>
        )}

        {/* Kanban columns */}
        {selected ? (
          <div className="kanban">
            {COLUMNS.map(col => (
              <div key={col.status} className="k-column">
                <div className="k-col-header">
                  <span className="k-col-dot" style={{ background: col.color }} />
                  <span className="k-col-label">{col.label}</span>
                  <span className="k-col-count">{byStatus(col.status).length}</span>
                  <button className="k-col-add" onClick={() => { setNtError(''); setShowNT(true) }}>+</button>
                </div>
                <div className="k-cards">
                  {byStatus(col.status).map(t => (
                    <KanbanCard key={t.id} task={t} apiKey={apiKey}
                      onUpdate={updated => setTasks(cur => cur.map(x => x.id === updated.id ? updated : x))}
                      onDelete={id => setTasks(cur => cur.filter(x => x.id !== id))} />
                  ))}
                  {byStatus(col.status).length === 0 && (
                    <div className="k-empty">No tasks here</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="board-empty">
            <div className="board-empty-icon">◆</div>
            <h2>Create your first project</h2>
            <p>Projects keep tasks, deadlines, and priorities in one place.</p>
            <button className="btn-primary" onClick={() => { setNpError(''); setShowNP(true) }}>+ New project</button>
          </div>
        )}
      </main>

      {/* ── Modals ── */}
      {showNewProject && (
        <Modal title="New project" onClose={() => setShowNP(false)}>
          <form onSubmit={createProject} className="modal-form">
            <label>Project name<input name="title" placeholder="e.g. Mobile app launch" required autoFocus /></label>
            <label>Description<textarea name="description" placeholder="What are you working toward?" /></label>
            {npError && <p className="auth-error">{npError}</p>}
            <button className="btn-primary full" disabled={npLoading}>
              {npLoading ? 'Creating…' : 'Create project'}
            </button>
          </form>
        </Modal>
      )}

      {showNewTask && selected && (
        <Modal title="Add task" onClose={() => setShowNT(false)}>
          <form onSubmit={createTask} className="modal-form">
            <label>Task name<input name="title" placeholder="e.g. Design landing page" required autoFocus /></label>
            <label>Description<textarea name="description" placeholder="Add helpful context" /></label>
            <div className="form-row">
              <label>Priority
                <select name="priority" defaultValue="MEDIUM">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
              <label>Due date<input name="dueDate" type="date" /></label>
            </div>
            {ntError && <p className="auth-error">{ntError}</p>}
            <button className="btn-primary full" disabled={ntLoading}>
              {ntLoading ? 'Adding…' : 'Add task'}
            </button>
          </form>
        </Modal>
      )}

      {showCollabs && selected && (
        <CollabModal project={selected} apiKey={apiKey} onClose={() => setShowColl(false)} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  ROOT
// ══════════════════════════════════════════════════════════════════════════════
type Screen = 'landing' | 'auth' | 'app'

function Root() {
  const [screen, setScreen] = useState<Screen>(() =>
    localStorage.getItem('devboard_token') ? 'app' : 'landing'
  )
  const [token, setToken]   = useState(() => localStorage.getItem('devboard_token') || '')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('devboard_key')   || '')

  const handleAuth = (t: string) => {
    localStorage.setItem('devboard_token', t)
    setToken(t); setScreen('app')
  }
  const handleKey = (k: string) => { setApiKey(k); setScreen('app') }
  const logout = () => {
    localStorage.removeItem('devboard_token')
    localStorage.removeItem('devboard_key')
    setToken(''); setApiKey(''); setScreen('landing')
  }

  if (screen === 'landing') return <LandingPage onEnter={() => setScreen('auth')} />
  if (screen === 'auth' || !token) return <AuthScreen onAuthenticated={handleAuth} onBack={() => setScreen('landing')} />
  if (!apiKey) return <SetupScreen token={token} onReady={handleKey} onLogout={logout} />
  return <AppDashboard token={token} apiKey={apiKey} onLogout={logout} />
}

createRoot(document.getElementById('root')!).render(<Root />)
