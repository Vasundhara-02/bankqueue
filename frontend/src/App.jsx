import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import api from './api/axios'

const services = [
  { id: 1, name: 'Cash Deposit', description: 'Deposit cash into your account', icon: Wallet, time: 8 },
  { id: 2, name: 'Cash Withdrawal', description: 'Withdraw cash from your account', icon: Building2, time: 7 },
  { id: 3, name: 'Account Opening', description: 'Open a new bank account', icon: Users, time: 20 },
  { id: 4, name: 'Loan Enquiry', description: 'Discuss loans and eligibility', icon: Activity, time: 15 },
]

const initialForm = { name: '', email: '', phone: '', password: '' }

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bankqueue_user')) || null
    } catch {
      return null
    }
  })
  const [authMode, setAuthMode] = useState('login')
  const [form, setForm] = useState(initialForm)
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [branchServices, setBranchServices] = useState(services)
  const [selectedService, setSelectedService] = useState('')
  const [queue, setQueue] = useState(null)
  const [queueList, setQueueList] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [view, setView] = useState('customer')
  const [counters, setCounters] = useState([])
const [selectedCounterId, setSelectedCounterId] = useState(
  localStorage.getItem('bankqueue_selected_counter') || ''
)
  const [staffActionLoading, setStaffActionLoading] = useState(false)

  useEffect(() => {
    loadBranches()
  }, [])

  useEffect(() => {
    if (branchId) loadServices(branchId)
  }, [branchId])


  // Restore the logged-in customer's active queue token.
  useEffect(() => {
    if (!user || !branchId) {
      if (!user) setQueue(null)
      return
    }

    let cancelled = false

    async function loadMyActiveQueue() {
      try {
        const response = await api.get('/queue/my-active', {
          params: { branch_id: Number(branchId) },
        })

        if (!cancelled) {
          setQueue(response.data)
          await loadQueueList(branchId)
        }
      } catch (err) {
        console.error('Unable to restore active queue token:', err)
      }
    }

    loadMyActiveQueue()

    return () => {
      cancelled = true
    }
  }, [user, branchId])

  // Keep branch activity updated for visitors and logged-in customers.
  useEffect(() => {
    if (!branchId) return

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const WS_URL = API_URL.replace(/^http/, 'ws');

const socket = new WebSocket(`${WS_URL}/ws/queue`);

    socket.onmessage = (event) => {
      let update

      try {
        update = JSON.parse(event.data)
      } catch (error) {
        console.warn('Invalid BankQueue WebSocket message:', error)
        return
      }

      // Update the signed-in customer's own token when it changes.
      if (
        queue?.token_number &&
        update.token_number === queue.token_number
      ) {
        setQueue((current) => current ? { ...current, ...update } : current)
        setMessage(`Queue update: ${update.status}`)
      }

      // Refresh activity for the currently selected branch.
      if (
        update.branch_id == null ||
        Number(update.branch_id) === Number(branchId)
      ) {
        loadQueueList(branchId)
      }
    }

    socket.onerror = () => {
      console.warn('BankQueue WebSocket connection error')
    }

    return () => socket.close()
  }, [branchId, queue?.token_number])

  async function loadBranches() {
    try {
      const response = await api.get('/branches')
      setBranches(response.data)
      if (response.data.length) setBranchId(String(response.data[0].id))
    } catch {
      setError('Cannot connect to the backend. Make sure FastAPI is running on port 8000.')
    }
  }

  async function loadServices(id) {
    try {
      const response = await api.get(`/branches/${id}/services`)
      const data = response.data
      setBranchServices(data.length ? data.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description || 'Banking service',
        icon: Wallet,
        time: item.average_service_time || 10,
      })) : services)
    } catch {
      setBranchServices(services)
    }
  }

  async function loadQueueList(id = branchId) {
    if (!id) return
    try {
      const response = await api.get(`/queue/branch/${id}`)
      setQueueList(response.data)
    } catch (err) {
      console.error('Unable to load queue:', err)
    }
  }

  async function loadCounters(id = branchId) {
    if (!id) return

    try {
      const response = await api.get(`/counters/branch/${id}`)
      setCounters(response.data)
    } catch (err) {
      console.error('Failed to load counters:', err)
    }
  }

  async function performStaffAction(counterId, action) {
    const endpoints = {
      callNext: 'call-next',
      startServing: 'start-serving',
      complete: 'complete',
      skip: 'skip',
    }

    const endpoint = endpoints[action]
    if (!endpoint) return

    setStaffActionLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await api.post(
        `/counters/${counterId}/${endpoint}`
      )

      setMessage(response.data?.message || 'Staff action completed.')

      await Promise.all([
        loadCounters(),
        loadQueueList(),
      ])
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Staff action failed. Please try again.'
      )

      await Promise.all([
        loadCounters(),
        loadQueueList(),
      ])
    } finally {
      setStaffActionLoading(false)
    }
  }

  async function submitAuth(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
      const payload = authMode === 'login'
        ? { email: form.email, password: form.password }
        : form

      const response = await api.post(endpoint, payload)

      if (authMode === 'login') {
        const token = response.data.access_token
        localStorage.setItem('bankqueue_token', token)

const userData = response.data.user

if (!userData || !userData.role) {
  throw new Error('Login succeeded, but user details were missing.')
}

        localStorage.setItem('bankqueue_user', JSON.stringify(userData))
        setUser(userData)
        setShowAuth(false)
        setForm(initialForm)
        setMessage('Welcome back! You are signed in.')
      } else {
        setAuthMode('login')
        setMessage('Account created! Please sign in.')
        setForm({ ...initialForm, email: form.email })
      }
    } catch (err) {
setError(
  authMode === 'login'
    ? (err.response?.status === 401
        ? 'Invalid email or password.'
        : err.response?.data?.detail || 'Login failed. Please try again.')
    : err.response?.data?.detail || 'Registration failed. Please try again.'
)
    } finally {
      setLoading(false)
    }
  }

  async function joinQueue(serviceId) {
    if (!user) {
      setSelectedService(String(serviceId))
      setAuthMode('login')
      setShowAuth(true)
      setError('Please sign in before joining the queue.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await api.post('/queue/join', {
        branch_id: Number(branchId),
        service_id: Number(serviceId),
      })

      setQueue(response.data)
      setSelectedService('')
      setMessage(`Your token ${response.data.token_number} is ready!`)
      await loadQueueList()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not join the queue.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshQueue() {
    if (!queue?.token_number) return

    try {
      const response = await api.get(`/queue/status/${encodeURIComponent(queue.token_number)}`)
      setQueue(response.data)
      await loadQueueList()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not refresh queue status.')
    }
  }

  async function cancelQueue() {
    if (!queue?.token_number) return
    if (!window.confirm('Are you sure you want to cancel this token?')) return

    setLoading(true)
    setError('')

    try {
      await api.post(`/queue/cancel/${encodeURIComponent(queue.token_number)}`)
      setQueue(null)
      setMessage('Your queue token has been cancelled.')
      await loadQueueList()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not cancel this token.')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('bankqueue_token')
    localStorage.removeItem('bankqueue_user')
    setUser(null)
    setQueue(null)
    setMessage('You have signed out.')
  }

  const activeQueue = queueList.filter((item) =>
    ['waiting', 'called', 'serving'].includes(item.status),
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-200">
              <Building2 size={23} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">BankQueue</h1>
              <p className="text-xs text-slate-500">Banking, without the wait.</p>
            </div>
          </a>

{user && user.role === 'staff' && (
            <div className="flex items-center gap-2">

              <button
                onClick={() => {
                  setView('staff')
                  if (branchId) {
                    loadCounters(branchId)
                    loadQueueList(branchId)
                  }
                }}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${
                  view === 'staff'
                    ? 'bg-blue-700 text-white'
                    : 'border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Staff Dashboard
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-bold">{user.name}</p>
                  <p className="text-xs capitalize text-slate-500">{user.role || 'customer'}</p>
                </div>
                <button onClick={logout} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold hover:bg-slate-50">
                  <LogOut size={16} /> Sign out
                </button>
              </>
            ) : (
              <button onClick={() => { setShowAuth(true); setAuthMode('login'); setError('') }} className="flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800">
                <LogIn size={16} /> Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {view === 'staff' && user && ['staff', 'admin'].includes(user.role) ? (
          <section className="min-h-screen bg-slate-50 px-5 py-10 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
                    BankQueue Operations
                  </p>
                  <h1 className="mt-2 text-3xl font-black text-slate-900">
                    Staff Dashboard
                  </h1>
                  <p className="mt-2 text-slate-500">
                    Manage customers, counters, and service progress.
                  </p>
<div className="mt-5 max-w-md">
  <label
    htmlFor="workingCounter"
    className="mb-2 block text-sm font-bold text-slate-700"
  >
    Select Your Working Counter
  </label>

  <select
    id="workingCounter"
    value={selectedCounterId}
    onChange={(event) => {
      const counterId = event.target.value
      setSelectedCounterId(counterId)
      localStorage.setItem('bankqueue_selected_counter', counterId)
    }}
    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
  >
<option value="" disabled>
  Choose your working counter
</option>
    {counters.map((counter) => (
      <option key={counter.id} value={counter.id}>
{branchServices.find(
  service => Number(service.id) === Number(counter.service_id)
)?.name || counter.name}
      </option>
    ))}
  </select>
</div>
                </div>

                <button
                  onClick={() => {
                    loadCounters()
                    loadQueueList()
                  }}
                  disabled={staffActionLoading}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold hover:bg-slate-100 disabled:opacity-50"
                >
                  <RefreshCw size={16} />
                  Refresh counters
                </button>
              </div>

              {message && (
                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  {message}
                </div>
              )}

              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              <div className="mb-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">Total counters</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">
                    {counters.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">Waiting customers</p>
                  <p className="mt-2 text-3xl font-black text-amber-600">
                    {queueList.filter(item => item.status === 'waiting').length}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">Currently serving</p>
                  <p className="mt-2 text-3xl font-black text-emerald-600">
                    {queueList.filter(item => item.status === 'serving').length}
                  </p>
                </div>
              </div>

{!selectedCounterId ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <Building2 className="mx-auto text-slate-400" size={40} />
                  <h2 className="mt-4 text-lg font-bold text-slate-900">
Select a working counter
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
Choose your assigned counter from the dropdown above to manage its queue.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
{counters
  .filter(counter =>
    selectedCounterId === ''
      ? true
      : Number(counter.id) === Number(selectedCounterId)
  )
  .map(counter => {
                    const currentEntry = queueList.find(
                      item => Number(item.id) === Number(counter.current_queue_id)
                    )

                    const serviceName =
                      branchServices.find(
                        service => Number(service.id) === Number(counter.service_id)
                      )?.name || 'All services'

                    return (
                      <article
                        key={counter.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="border-b border-slate-100 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Counter {counter.counter_number}
                              </p>
                              <h2 className="mt-1 text-xl font-black text-slate-900">
                                {counter.name}
                              </h2>
                            </div>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                                counter.status === 'busy'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {counter.status}
                            </span>
                          </div>

                          <div className="mt-4 rounded-xl bg-blue-50 p-3">
                            <p className="text-xs font-semibold text-blue-600">
                              ASSIGNED SERVICE
                            </p>
                            <p className="mt-1 font-bold text-blue-950">
                              {serviceName}
                            </p>
                          </div>
                        </div>

                        <div className="p-5">
                          <p className="text-sm font-semibold text-slate-500">
                            Current customer
                          </p>

                          {currentEntry ? (
                            <>
                              <p className="mt-2 text-2xl font-black text-slate-900">
                                {currentEntry.token_number}
                              </p>
                              <p className="mt-1 text-sm capitalize text-slate-500">
                                Status: {currentEntry.status}
                              </p>
                            </>
                          ) : (
                            <p className="mt-2 text-lg font-bold text-slate-400">
                              No customer assigned
                            </p>
                          )}

                          <div className="mt-5 grid grid-cols-2 gap-3">
                            {!counter.current_queue_id ? (
                              <button
                                onClick={() => performStaffAction(counter.id, 'callNext')}
                                disabled={staffActionLoading}
                                className="col-span-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                              >
                                Call Next Customer
                              </button>
                            ) : (
                              <>
                                {currentEntry?.status === 'called' && (
                                  <button
                                    onClick={() => performStaffAction(counter.id, 'startServing')}
                                    disabled={staffActionLoading}
                                    className="rounded-xl bg-blue-700 px-3 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                                  >
                                    Start Serving
                                  </button>
                                )}

                                {currentEntry?.status === 'serving' && (
                                  <button
                                    onClick={() => performStaffAction(counter.id, 'complete')}
                                    disabled={staffActionLoading}
                                    className="rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    Complete
                                  </button>
                                )}

                                {['called', 'serving'].includes(currentEntry?.status) && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm('Skip this customer?')) {
                                        performStaffAction(counter.id, 'skip')
                                      }
                                    }}
                                    disabled={staffActionLoading}
                                    className="rounded-xl border border-red-200 px-3 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Skip
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        ) : (
<>
        <section className="overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24 lg:px-8">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-blue-100">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Smart banking queue management
              </div>
              <h2 className="max-w-xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Your time matters. <span className="text-blue-300">Skip the wait.</span>
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-blue-100">
                Join your branch queue online, track your position live, and spend less time waiting at the bank.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#services" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-4 font-bold text-blue-950 shadow-lg hover:bg-blue-50">
                  Get a queue token <ArrowRight size={18} />
                </a>
                <a href="#live-queue" className="rounded-xl border border-white/30 px-6 py-4 font-bold hover:bg-white/10">
                  View live queue
                </a>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 text-sm text-blue-100">
                <span className="flex items-center gap-2"><ShieldCheck size={18} /> Secure sign-in</span>
                <span className="flex items-center gap-2"><Activity size={18} /> Live updates</span>
                <span className="flex items-center gap-2"><Clock3 size={18} /> Estimated wait</span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-5 rounded-[2rem] bg-blue-400/20 blur-3xl" />
              <div className="relative rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-200">Live branch overview</p>
                    <h3 className="mt-1 text-2xl font-extrabold">Queue dashboard</h3>
                  </div>
                  <div className="rounded-2xl bg-emerald-400/20 p-3 text-emerald-300"><Activity size={26} /></div>
                </div>
                <div className="mt-7 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white/10 p-5">
                    <p className="text-sm text-blue-100">Active customers</p>
                    <p className="mt-2 text-4xl font-black">{activeQueue.length}</p>
                    <p className="mt-1 text-xs text-blue-200">Live queue entries</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-5">
                    <p className="text-sm text-blue-100">Your wait time</p>
                    <p className="mt-2 text-4xl font-black">{queue?.estimated_wait ?? '—'}<span className="ml-1 text-base font-semibold">min</span></p>
                    <p className="mt-1 text-xs text-blue-200">Based on current queue</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-white p-5 text-slate-900">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-500">YOUR QUEUE STATUS</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">LIVE</span>
                  </div>
                  {queue ? (
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-3xl font-black text-blue-800">{queue.token_number}</p>
                        <p className="mt-1 text-sm capitalize text-slate-500">{queue.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black">{queue.queue_position ?? '—'}</p>
                        <p className="text-xs text-slate-500">Position</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <Ticket className="mx-auto text-blue-700" size={32} />
                      <p className="mt-2 font-bold">No active token</p>
                      <p className="mt-1 text-sm text-slate-500">Join a service queue to get started.</p>
                    </div>
                  )}
                  {queue && <div className="mt-4 flex gap-2">
                    <button onClick={refreshQueue} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 py-3 text-sm font-bold text-white hover:bg-blue-800"><RefreshCw size={15} /> Refresh</button>
                    <button onClick={cancelQueue} disabled={loading} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50">Cancel</button>
                  </div>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          {message && <div role="status" className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><CheckCircle2 size={19} /> {message}<button onClick={() => setMessage('')} className="ml-auto"><X size={17} /></button></div>}
          {error && <div role="alert" className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"><X size={19} /> {error}<button onClick={() => setError('')} className="ml-auto"><X size={17} /></button></div>}

          <div id="services" className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">Choose a service</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">What can we help you with?</h2>
              <p className="mt-3 max-w-2xl text-slate-500">Select a banking service and reserve your place in the queue before arriving.</p>
            </div>
            <div className="min-w-64">
              <label htmlFor="branch" className="mb-2 block text-sm font-bold">Select branch</label>
              <select id="branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
                {branches.length ? branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>) : <option value="">Loading branches…</option>}
              </select>
            </div>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {branchServices.map((service) => {
              const Icon = service.icon || Wallet
              return (
                <article key={service.id} className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100/60">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white"><Icon size={24} /></div>
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"><Clock3 size={13} /> {service.time} min</span>
                  </div>
                  <h3 className="mt-6 text-lg font-extrabold">{service.name}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{service.description}</p>
                  <button onClick={() => joinQueue(service.id)} disabled={loading || !branchId} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                    Get token <ArrowRight size={16} />
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        <section id="live-queue" className="border-y border-slate-200 bg-white py-14">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">Live queue</p>
                <h2 className="mt-2 text-3xl font-black">Branch Activity</h2>
                <p className="mt-2 text-slate-500">Live customer activity across all services. Positions are calculated separately for each service queue.</p>
              </div>
              <button onClick={() => loadQueueList()} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold hover:bg-slate-50"><RefreshCw size={16} /> Refresh queue</button>
            </div>
            <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-3 bg-slate-50 px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 sm:grid-cols-4">
                <span>Token</span><span>Status</span><span className="hidden sm:block">Counter</span><span>Position</span>
              </div>
              {activeQueue.length ? activeQueue.map((item) => (
                <div key={item.id} className="grid grid-cols-3 items-center border-t border-slate-100 px-5 py-4 text-sm sm:grid-cols-4">
                  <div>
                    <span className="font-extrabold text-blue-800">{item.token_number}</span>
                    <p className="mt-1 text-xs text-slate-500">
                      {branchServices.find((service) => Number(service.id) === Number(item.service_id))?.name || `Service ${item.service_id}`}
                    </p>
                  </div>
                  <span className="capitalize">{item.status}</span>
                  <span className="hidden text-slate-500 sm:block">{item.counter_id ? `Counter ${item.counter_id}` : 'Waiting'}</span>
                  <span className="font-semibold">
                    {item.status === 'called'
                      ? 'Called'
                      : item.status === 'serving'
                        ? 'Serving'
                        : item.queue_position ?? '—'}
                  </span>
                </div>
              )) : (
                <div className="px-5 py-12 text-center">
                  <Users className="mx-auto text-slate-300" size={34} />
                  <p className="mt-3 font-bold text-slate-700">No active queue entries loaded</p>
                  <p className="mt-1 text-sm text-slate-500">Select a branch and refresh to see live activity.</p>
                </div>
              )}
            </div>
          </div>
        </section>
</>
)}
      </main>

      <footer className="bg-slate-950 py-8 text-center text-sm text-slate-400">
        <p className="font-bold text-white">BankQueue</p>
        <p className="mt-2">Smart branch queue and appointment management.</p>
        <p className="mt-1">Final-year full-stack project · Built with React and FastAPI</p>
      </footer>

      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAuth(false) }}>
          <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white"><ShieldCheck size={25} /></div>
                <h2 className="mt-5 text-2xl font-black">{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
                <p className="mt-2 text-sm text-slate-500">{authMode === 'login' ? 'Sign in to manage your queue token.' : 'Register to access BankQueue services.'}</p>
              </div>
              <button onClick={() => setShowAuth(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <form onSubmit={submitAuth} className="mt-7 space-y-4">
              {authMode === 'register' && <>
                <div><label className="mb-1.5 block text-sm font-bold">Full name</label><input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600" placeholder="Your full name" /></div>
                <div><label className="mb-1.5 block text-sm font-bold">Phone number</label><input required type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} minLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600" placeholder="Enter 10-digit mobile number" title="Enter exactly 10 digits" /></div>
              </>}
              <div><label className="mb-1.5 block text-sm font-bold">Email address</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600" placeholder="you@example.com" /></div>
              <div><label className="mb-1.5 block text-sm font-bold">Password</label><input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600" placeholder="At least 8 characters" /></div>
              <button disabled={loading} className="w-full rounded-xl bg-blue-700 px-4 py-3.5 font-bold text-white hover:bg-blue-800 disabled:opacity-50">{loading ? 'Please wait…' : authMode === 'login' ? 'Sign in securely' : 'Create account'}</button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">{authMode === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}<button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); setForm(initialForm) }} className="font-bold text-blue-700 hover:underline">{authMode === 'login' ? 'Create one' : 'Sign in'}</button></p>
          </div>
        </div>
      )}
    </div>
  )
}
