import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Calendar, CheckSquare, Users, Settings, Flame, HandHeart } from 'lucide-react'

import { useAuth } from './lib/auth.js'
import * as api from './lib/api.js'
import { DEFAULT_CFG, DEFAULT_DESCRIPTION } from './lib/constants.js'
import { dayDate, fmtDay } from './lib/format.js'

import Garland from './components/Garland.jsx'
import Overview from './components/Overview.jsx'
import Schedule from './components/Schedule.jsx'
import Tasks from './components/Tasks.jsx'
import Team from './components/Team.jsx'
import Setup from './components/Setup.jsx'
import PublicDashboard from './components/PublicDashboard.jsx'
import Login from './components/Login.jsx'
import GaneshMark from './components/GaneshMark.jsx'
import Crest from './components/Crest.jsx'
import Sponsors from './components/Sponsors.jsx'
import SponsorPublic from './components/SponsorPublic.jsx'

const JOIN_LINK = window.location.hash === '#join'
const SPONSOR_LINK = window.location.hash === '#sponsor'

const TABS = [
  ['overview', 'Overview', Flame],
  ['schedule', 'Schedule', Calendar],
  ['tasks', 'Tasks', CheckSquare],
  ['sponsors', 'Sponsors', HandHeart],
  ['team', 'Team', Users],
  ['setup', 'Setup', Settings],
]

export default function App() {
  const auth = useAuth()
  const committee = auth.isCommittee

  // app | login | preview | sponsor
  const [screen, setScreen] = useState(JOIN_LINK ? 'login' : SPONSOR_LINK ? 'sponsor' : 'app')
  const [loginMode, setLoginMode] = useState(JOIN_LINK ? 'join' : 'signin')
  const [tab, setTab] = useState('overview')
  const [day, setDay] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [events, setEvents] = useState([])
  const [notes, setNotes] = useState({})
  const [donations, setDonations] = useState([])
  const [tasks, setTasks] = useState([])
  const [people, setPeople] = useState([])
  const [sponsorItems, setSponsorItems] = useState([])
  const [sponsorReqs, setSponsorReqs] = useState([])

  const pull = useCallback(async () => {
    const [c, e, d, si] = await Promise.all([
      api.getConfig(), api.getEvents(), api.getDonations(committee), api.getSponsorItems()])
    setCfg({ ...DEFAULT_CFG, ...c }); setEvents(e); setDonations(d); setSponsorItems(si)
    if (committee) {
      const [t, p, n, sr] = await Promise.all([
        api.getTasks(), api.getPeople(), api.getEventNotes(), api.getSponsorRequests()])
      setTasks(t); setPeople(p); setNotes(n); setSponsorReqs(sr)
    } else { setTasks([]); setPeople([]); setNotes({}); setSponsorReqs([]) }
    setLoaded(true)
  }, [committee])

  useEffect(() => {
    if (auth.status === 'loading') return
    pull()
    const off = api.onChange(() => pull())
    const onFocus = () => pull()
    window.addEventListener('focus', onFocus)
    return () => { off(); window.removeEventListener('focus', onFocus) }
  }, [auth.status, pull])

  useEffect(() => { if (committee && screen === 'login') setScreen('app') }, [committee, screen])

  const openTasks = tasks.filter((t) => t.status !== 'done').length

  const wrap = (fn) => async (...args) => { await fn(...args); await pull() }

  const daysLeft = useMemo(
    () => Math.ceil((new Date(cfg.start_date + 'T12:00:00') - new Date()) / 86400000),
    [cfg.start_date])

  if (auth.status === 'loading' || !loaded) {
    return (
      <div className="mgu-shell mgu-boot">
        <div className="gmark-lamp"><GaneshMark size={96} ring spin label="श्री गणेश" /></div>
        <p className="mgu-eyebrow deva boot-namah">श्री गणेशाय नमः</p>
        <p className="empty" role="status" aria-live="polite">Loading the board…</p>
      </div>
    )
  }

  if (screen === 'login') {
    return <Login auth={auth} onBack={() => setScreen('app')} initialMode={loginMode} />
  }

  // The donor-facing sponsorship page. Open to anyone — no sign-in.
  if (screen === 'sponsor') {
    return (
      <SponsorPublic cfg={cfg} items={sponsorItems}
        submit={async (form) => { const r = await api.submitSponsorship(form); await pull(); return r }}
        onBack={() => { if (window.location.hash) window.location.hash = ''; setScreen('app') }} />
    )
  }

  // Not on the committee, or a member previewing what the public sees.
  if (!committee || screen === 'preview') {
    return (
      <>
        {screen === 'preview' && (
          <div className="preview-bar">
            Previewing the public page
            <button className="btn" onClick={() => setScreen('app')}>Exit preview</button>
          </div>
        )}
        {auth.status === 'pending' && (
          <div className="mgu-shell" style={{ paddingBottom: 0 }}>
            <div className="banner">
              You are signed in as <b>{auth.user?.email}</b>, but this account is not on the committee
              list yet. Have the invite code from the WhatsApp group? Join with it below.
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn" onClick={auth.signOut}>Sign out</button>
                <button className="btn" onClick={() => { setLoginMode('join'); setScreen('login') }}>Enter invite code</button>
              </div>
            </div>
          </div>
        )}
        <PublicDashboard cfg={cfg} events={events} donations={donations}
          sponsorItems={sponsorItems}
          onSponsor={() => setScreen('sponsor')}
          onLogin={() => setScreen('login')} />
      </>
    )
  }

  return (
    <>
      <div className="mgu-shell">
        <header className="mgu-top has-mark">
          <div className="mgu-id">
            <Crest size={76} className="mgu-id-crest" />
            <div className="mgu-id-text">
              <div className="mgu-eyebrow deva">श्री गणेशाय नमः</div>
              <h1 className="mgu-title">{cfg.name}</h1>
              <div className="mgu-sub">
                {daysLeft > 0
                  ? `Sthapana in ${daysLeft} day${daysLeft === 1 ? '' : 's'} · ${fmtDay(dayDate(cfg, 0))}`
                  : daysLeft === 0 ? 'Sthapana is today' : 'Festival underway'}
                {auth.profile?.name ? ` · ${auth.profile.name}` : ''}
              </div>
            </div>
          </div>
          <p className="mgu-desc">{cfg.description || DEFAULT_DESCRIPTION}</p>
          <GaneshMark size={124} className="mark-watermark" />
        </header>

        {auth.demo && (
          <div className="banner">
            <b>Demo mode.</b> No backend configured — no sign-in, nothing shared, data stays in this
            browser. Connect Supabase before the festival (see README).
          </div>
        )}

        <Garland cfg={cfg} day={day} setDay={setDay} events={events} />

        {tab === 'overview' && (
          <Overview cfg={cfg} openTasks={openTasks} sponsorReqs={sponsorReqs}
            tasks={tasks} events={events} day={day} />)}
        {tab === 'schedule' && (
          <Schedule cfg={cfg} day={day} events={events} notes={notes} people={people}
            addEvent={wrap(api.addEvent)} removeEvent={wrap(api.removeEvent)} />)}
        {tab === 'tasks' && (
          <Tasks tasks={tasks} people={people} me={auth.profile?.name}
            addTask={wrap(api.addTask)} updateTask={wrap(api.updateTask)}
            removeTask={wrap(api.removeTask)} />)}
        {tab === 'sponsors' && (
          <Sponsors cfg={cfg} items={sponsorItems} requests={sponsorReqs} day={day}
            addItem={wrap(api.addSponsorItem)} updateItem={wrap(api.updateSponsorItem)}
            removeItem={wrap(api.removeSponsorItem)}
            confirmRequest={wrap(api.confirmSponsorship)} declineRequest={wrap(api.declineSponsorship)}
            submitSponsorship={async (form) => {
              const r = await api.submitSponsorship(form); await pull(); return r }}
            onOpenPublic={() => setScreen('sponsor')} />)}
        {tab === 'team' && <Team people={people} tasks={tasks} me={auth.profile?.name} />}
        {tab === 'setup' && (
          <Setup cfg={cfg} saveConfig={wrap(api.saveConfig)} auth={auth} demo={auth.demo}
            onPreviewPublic={() => setScreen('preview')}
            data={() => ({ cfg, events, notes, donations, tasks, people })}
            counts={{ events: events.length, tasks: tasks.length,
                      donations: donations.length, people: people.length }} />)}
      </div>

      <nav className="tabs">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} className="tab" data-on={tab === id ? '1' : '0'} onClick={() => setTab(id)}>
            <Icon size={17} strokeWidth={2.2} />{label}
          </button>
        ))}
      </nav>
    </>
  )
}
