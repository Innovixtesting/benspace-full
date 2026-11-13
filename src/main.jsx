import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { articles, demoID, demoCode, dailyQuote, formatSlot, modes, moods } from './data.js'
import './style.css'
import { api } from './api.js'
import { Grounding, QuietPause, MemoryMatch, WordScramble } from './activities.jsx'

const nav = ['Home', 'Calm', 'Play', 'Talk']
function readPreference(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function savePreference(key, value) {
  try { localStorage.setItem(key, value) } catch { /* The current session still works. */ }
}

function Access({ onEnter }) {
  const [action, setAction] = useState('signup')
  const [step, setStep] = useState('id')
  const [id, setID] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  function changeAction(next) {
    setAction(next)
    setStep('id')
    setCode('')
    setError('')
  }
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (step === 'id') {
      if (![demoID, 'BU-DEMO-002'].includes(id.trim().toUpperCase())) return setError('Enter the sample college ID shown below.')
      setStep('code')
      setError('')
      return
    }
    setBusy(true)
    try {
      const student = await api('/auth/verify', 'POST', { collegeId: id, code: code.trim(), action })
      onEnter(student)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <section className="card access">
    <img className="access-logo" src={import.meta.env.BASE_URL + 'brand.png'} alt="" />
    <h1>A calm space for every Bennett student.</h1>
    <p>Sign up with your college ID to explore the BenSpace demo.</p>
    <div className="choices" aria-label="Account action">
      <button aria-pressed={action === 'signup'} onClick={() => changeAction('signup')}>Sign up</button>
      <button aria-pressed={action === 'signin'} onClick={() => changeAction('signin')}>Sign in</button>
    </div>
    <form onSubmit={submit} noValidate>
      {step === 'id' ? <>
        <label htmlFor="college-id">College ID</label>
        <input id="college-id" value={id} onChange={e => {setID(e.target.value); setError('')}} autoComplete="off" maxLength={40} aria-describedby="demo-tip" />
        <p id="demo-tip">Sample college IDs <strong>{demoID}</strong> and <strong>BU-DEMO-002</strong>. Use the sample for this demo.</p>
      </> : <>
        <label htmlFor="code">Verification code</label>
        <input id="code" value={code} onChange={e => {setCode(e.target.value); setError('')}} inputMode="numeric" maxLength={6} autoComplete="off" aria-describedby="demo-tip" />
        <p id="demo-tip">Sample code <strong>{demoCode}</strong>. This screen simulates verification.</p>
        <button type="button" className="quiet" onClick={() => changeAction(action)}>Change college ID</button>
      </>}
      {error && <p role="alert" className="error">{error}</p>}
      <button className="primary" type="submit" disabled={busy}>{step === 'id' ? 'Continue' : action === 'signup' ? 'Create demo account' : 'Enter BenSpace'}</button>
    </form>
  </section>
}

function Breath() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const started = useRef(0)
  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      const seconds = Math.min(120, (performance.now() - started.current) / 1000)
      setElapsed(seconds)
      if (seconds >= 120) setRunning(false)
    }, 100)
    return () => clearInterval(interval)
  }, [running])
  const done = elapsed >= 120
  const cycle = elapsed % 8
  const phase = done ? 'Complete' : !running ? (elapsed ? 'Paused' : 'Ready') : cycle < 4 ? 'Breathe in' : 'Breathe out'
  const seconds = Math.ceil(120 - elapsed)
  function toggle() {
    if (running) return setRunning(false)
    const from = done ? 0 : elapsed
    setElapsed(from)
    started.current = performance.now() - from * 1000
    setRunning(true)
  }
  return <><h1>Two-minute breath</h1><p>Follow four seconds in and four seconds out, at a pace that feels comfortable.</p>
    <section className="card breathing">
      <div className="orbit"><div className="bubble" style={{ '--scale': 1 + Math.min(cycle, 8 - cycle) / 16 }} /></div>
      <h2 aria-live="polite">{phase}</h2>
      <p>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} remaining · Breath {Math.min(15, Math.floor(elapsed / 8) + 1)} of 15</p>
      <div className="choices"><button className="primary" onClick={toggle}>{running ? 'Pause' : done ? 'Start again' : elapsed ? 'Resume' : 'Begin'}</button><button onClick={() => {setRunning(false); setElapsed(0)}}>Reset</button></div>
    </section>
  </>
}

function Profile({ provider, slots, bookings, onSave, edit, go }) {
  const [mode, setMode] = useState(edit?.mode ?? modes[0])
  const [slotId, setSlot] = useState(edit?.slotId ?? '')
  const [note, setNote] = useState(edit?.note ?? '')
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const options = slots.filter(slot => slot.providerId === provider.id)
  function unavailable(slot) {
    return (slot.taken && slot.id !== edit?.slotId) || Date.parse(slot.startsAt) <= Date.now() || bookings.some(b => b.id !== edit?.id && b.startsAt === slot.startsAt)
  }
  async function submit(e) {
    e.preventDefault()
    const slot = options.find(item => item.id === slotId)
    if (!slot || unavailable(slot)) return setError('Choose an available time to continue.')
    if (!review) {setReview(true);return}
    setBusy(true)
    try { await onSave({ slotId, mode, note: note.trim() }, edit?.id) }
    catch (err) {setError(err.message);setReview(false)}
    finally {setBusy(false)}
  }
  return <><button className="quiet" onClick={() => go(edit ? 'Sessions' : 'Talk')}>← {edit ? 'Your sessions' : 'Talk'}</button>
    <h1>{provider.name}</h1><p>{provider.role} · Sample profile{provider.role === 'Peer mentor' ? ' · 15-minute chat' : ''}</p>
    <div className="card"><strong>{provider.focus}</strong><p>{provider.bio}</p></div>
    <form className="card" onSubmit={submit}>
      <h2>{review ? 'Review appointment' : edit ? 'Reschedule session' : 'Choose a session'}</h2>
      {review ? <><p>{mode} · {formatSlot(options.find(slot => slot.id === slotId)?.startsAt ?? Date.now())}</p>
        {note.trim() && <p>{note.trim()}</p>}
        <button type="button" onClick={() => setReview(false)}>Edit details</button></> : <>
      <fieldset><legend>How would you like to talk?</legend><div className="choices">{modes.map(value => <label className="option" key={value}><input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)} />{value}</label>)}</div></fieldset>
      <label htmlFor="slot">Time slot</label>
      <select id="slot" value={slotId} onChange={e => {setSlot(e.target.value); setError('')}}><option value="">Select a time</option>{options.map(slot => <option key={slot.id} value={slot.id} disabled={unavailable(slot)}>{formatSlot(slot.startsAt)}{unavailable(slot) ? ' · Unavailable' : ''}</option>)}</select>
      <label htmlFor="note">Optional demo note</label>
      <textarea id="note" value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="Use sample text only" /></>}
      {error && <p role="alert" className="error">{error}</p>}
      <button className="primary" type="submit" disabled={busy}>{review ? 'Confirm appointment' : 'Review appointment'}</button>
    </form>
  </>
}

function App() {
  const [providers, setProviders] = useState([])
  const [slots, setSlots] = useState([])
  const [language, setLanguage] = useState('All')
  const [focusFilter, setFocusFilter] = useState('')
  const [apiError, setApiError] = useState('')
  const [active, setActive] = useState(false)
  const [screen, setScreen] = useState('Access')
  const [previous, setPrevious] = useState('Access')
  const [light, setLight] = useState(() => readPreference('benspace-theme') === 'light')
  const [mood, setMood] = useState(null)
  const [quoteTime, setQuoteTime] = useState(Date.now)
  useEffect(() => {
    const refreshDate = () => setQuoteTime(Date.now())
    const interval = setInterval(refreshDate, 15000)
    window.addEventListener('focus', refreshDate)
    return () => { clearInterval(interval); window.removeEventListener('focus', refreshDate) }
  }, [])
  const [directory, setDirectory] = useState('Counsellors')
  const [provider, setProvider] = useState(null)
  const [edit, setEdit] = useState(null)
  const [bookings, setBookings] = useState([])
  const [confirmation, setConfirmation] = useState(null)
  const [topic, setTopic] = useState('All')
  const [article, setArticle] = useState(null)
  const [articleBack, setArticleBack] = useState('Read')
  const [cancelID, setCancelID] = useState(null)
  const main = useRef(null)
  useEffect(() => {
    if (screen !== 'Access') main.current?.focus({preventScroll: true})
  }, [screen])
  function go(next) {
    setScreen(next)
    window.scrollTo(0, 0)
  }
  function openArticle(item, from) {
    setArticle(item)
    setArticleBack(from)
    go('Article')
  }
  async function refresh() {
    const [directoryData, appointments] = await Promise.all([api('/directory'),api('/bookings')])
    setProviders(directoryData.providers)
    setSlots(directoryData.slots)
    setBookings(appointments)
  }
  async function enter() {
    setActive(true)
    go('Home')
    try {await refresh();setApiError('')} catch (err) {setApiError(err.message)}
  }
  useEffect(() => {
    api('/me').then(enter).catch(err => {if (err.status !== 401) setApiError(err.message)})
  }, [])
  async function saveBooking(body,id) {
    let booking
    try {booking = await api(id ? '/bookings/' + id : '/bookings', id ? 'PATCH' : 'POST', body)}
    catch (err) { if (err.status === 409) await refresh().catch(() => {}); throw err }
    setBookings(current => [...current.filter(item => item.id !== booking.id),booking])
    setConfirmation(booking)
    go('Confirmed')
    await refresh().catch(err => setApiError(err.message))
  }
  async function cancelBooking(id) {
    try {
      await api('/bookings/' + id,'DELETE')
      setBookings(items => items.filter(item => item.id !== id))
      setCancelID(null)
      await refresh()
    } catch (err) { setApiError(err.message) }
  }
  function openProfile(item, booking = null) {
    setProvider(item)
    setEdit(booking)
    go('Profile')
  }
  async function signOut() {
    try { await api('/auth/logout','POST') }
    catch (err) {setApiError(err.message);return}
    setApiError('')
    setActive(false)
    setMood(null)
    setBookings([])
    setProvider(null)
    setEdit(null)
    setConfirmation(null)
    setCancelID(null)
    go('Access')
  }
  const upcoming = bookings.filter(b => Date.parse(b.startsAt) > Date.now()).sort((a,b) => a.startsAt.localeCompare(b.startsAt))
  const nameOf = b => providers.find(p => p.id === b.providerId)?.name ?? 'Sample provider'
  const section = ['Profile','Confirmed','Sessions'].includes(screen) ? 'Talk' : ['Breathe','Grounding','Quiet'].includes(screen) ? 'Calm' : ['Memory','Words'].includes(screen) ? 'Play' : screen
  const articleList = (items, from) => <div className="article-grid">{items.map(item => <button className="card read-card" key={item.title} onClick={() => openArticle(item, from)}><span className="badge">{item.topic} · 1 min</span><strong>{item.title}</strong><span>{item.summary}</span></button>)}</div>
  return <div className={light ? 'shell light' : 'shell'}>
    <header><div className="bar">
      <div className="brand"><img src={import.meta.env.BASE_URL + 'brand.png'} alt="" /><strong>BenSpace</strong></div>
      <div className="header-actions"><button aria-label={light ? 'Switch to Night Calm' : 'Switch to Ocean Breeze'} title={light ? 'Night Calm' : 'Ocean Breeze'} onClick={() => {setLight(!light); savePreference('benspace-theme', light ? 'dark' : 'light')}}>{light ? '☾' : '☼'}</button>
      <button className="urgent" onClick={() => {if (screen !== 'Urgent') setPrevious(screen); go('Urgent')}}>♡ Urgent help</button></div>
    </div></header>
    <main ref={main} tabIndex={-1}>
      <p className="demo-banner">BenSpace demo · Use sample details only{active && <button className="quiet" onClick={signOut}>Sign out</button>}</p>
      {apiError && <p role="alert">{apiError}</p>}
      {screen === 'Access' && <Access onEnter={enter} />}
      {screen === 'Home' && <>
        <h1>How are you today?</h1>
        <section className="card"><h2>Check in with yourself</h2>
          <div className="moods">{moods.map(item => <button key={item[0]} aria-pressed={mood?.[0] === item[0]} onClick={() => setMood(item)}><i aria-hidden="true" style={{background: item[1]}} />{item[0]}</button>)}</div>
          {mood && <div className="mood-response"><p role="status">{mood[2]}</p><button className="primary" onClick={() => {if (mood[3] === 'Talk') setDirectory('Counsellors'); go(mood[3])}}>{mood[4]}</button>{mood[0] === 'Low' && <button onClick={() => {setDirectory('Peer mentors');go('Talk')}}>Talk to a peer mentor</button>}</div>}
        </section>
        <section className="card"><h2>Today’s quote</h2><p role="status">“{dailyQuote(mood?.[0], quoteTime)}”</p></section>
        <div className="shortcuts"><button className="card talk" onClick={() => go('Talk')}><span aria-hidden="true">◌</span><strong>Talk to someone</strong><small>Counsellors and mentors</small></button><button className="card lavender" onClick={() => go('Breathe')}><span aria-hidden="true">≈</span><strong>Two-minute breath</strong><small>Slow down, gently</small></button></div>
        <section className="card"><h2>Peer support</h2><p>Connect with a fellow student who understands campus life.</p><button onClick={() => {setDirectory('Peer mentors');go('Talk')}}>Find a peer mentor</button></section>
        <section className="card"><h2>Your next session</h2>{upcoming[0] ? <><p>{nameOf(upcoming[0])} · {upcoming[0].mode} · {formatSlot(upcoming[0].startsAt)}</p><button onClick={() => go('Sessions')}>Manage sessions</button></> : <p>Nothing booked yet.</p>}</section>
        <div className="row"><h2>For you today</h2><button className="quiet" onClick={() => {setTopic('All'); go('Read')}}>See all</button></div>{articleList(articles.slice(0,2), 'Home')}
      </>}
      {screen === 'Talk' && <><h1>Appointments</h1><p>Explore sample counsellor and mentor profiles.</p>
        <div className="choices">{['Counsellors','Peer mentors','Faculty mentors'].map(tab => <button key={tab} aria-pressed={directory === tab} onClick={() => setDirectory(tab)}>{tab}</button>)}<button onClick={() => go('Sessions')}>Your sessions</button></div>
        {directory === 'Peer mentors' && <div className="card"><p>Peer mentors are fellow students trained to listen and help you find campus resources. You can book a counsellor for professional support.</p>
          <label htmlFor="language">Language</label><select id="language" value={language} onChange={e => setLanguage(e.target.value)}>{['All','English','Bengali','Tamil'].map(value => <option key={value}>{value}</option>)}</select>
          <label htmlFor="focus">Search by topic</label><input id="focus" value={focusFilter} onChange={e => setFocusFilter(e.target.value)} /></div>}
        <div className="stack">{providers.filter(p => ({
          Counsellors:'Counsellor', 'Peer mentors':'Peer mentor', 'Faculty mentors':'Faculty mentor'
        })[directory] === p.role && (directory !== 'Peer mentors' ||
          (language === 'All' || p.languages.split(', ').includes(language)) && p.focus.toLowerCase().includes(focusFilter.trim().toLowerCase()))).map(p => {
          const next = slots.find(slot => slot.providerId === p.id && !slot.taken && Date.parse(slot.startsAt) > Date.now())
          return <section className="card" key={p.id}><span className="badge">{p.role} · Sample</span><h2>{p.name}</h2><p>{p.focus} · {p.languages}</p><p>{next ? 'Next free · ' + formatSlot(next.startsAt) : 'No demo slots available'}</p><button onClick={() => openProfile(p)} aria-label={`View profile for ${p.name}`}>View profile</button></section>
        })}</div><button className="quiet" onClick={() => refresh().then(() => setApiError('')).catch(err => setApiError(err.message))}>Refresh availability</button></>}
      {screen === 'Profile' && <Profile provider={provider} slots={slots} bookings={bookings} onSave={saveBooking} edit={edit} go={go} />}
      {screen === 'Confirmed' && <section className="card"><h1>You took a good step.</h1><p>Demo booking confirmed.</p><p>{nameOf(confirmation)} · {confirmation.mode} · {formatSlot(confirmation.startsAt)}</p><p>Real reminders and appointments require the university integration.</p><div className="choices"><button className="primary" onClick={() => go('Home')}>Go home</button><button onClick={() => go('Breathe')}>Take a breath</button></div></section>}
      {screen === 'Sessions' && <><h1>Your sessions</h1>{!upcoming.length && <p>There are no upcoming demo sessions.</p>}{upcoming.map(b => <section className="card" key={b.id}><h2>{nameOf(b)}</h2><p>{b.mode} · {formatSlot(b.startsAt)}</p><div className="choices">{cancelID === b.id ? <><button className="urgent" onClick={() => {cancelBooking(b.id)}}>Confirm cancellation</button><button onClick={() => setCancelID(null)}>Keep session</button></> : <><button onClick={() => {setCancelID(null); openProfile(providers.find(p => p.id === b.providerId),b)}}>Reschedule</button><button onClick={() => setCancelID(b.id)}>Cancel session</button></>}</div></section>)}</>}
      {screen === 'Read' && <><h1>Read and reflect</h1><p>Short reads for everyday student life.</p><div className="choices" aria-label="Article topics">{['All','Health','Movement','Motivation','Sleep','Stress','Connection'].map(value => <button key={value} aria-pressed={topic === value} onClick={() => setTopic(value)}>{value}</button>)}</div>{articleList(articles.filter(item => topic === 'All' || item.topic === topic), 'Read')}</>}
      {screen === 'Article' && <><button className="quiet" onClick={() => go(articleBack)}>← {articleBack}</button><article className="card"><span className="badge">{article.topic} · 1 min</span><h1>{article.title}</h1><p>{article.summary}</p>{article.body.map(text => <p key={text}>{text}</p>)}<small>Sample article for demonstration.</small></article><button className="primary" onClick={() => go('Talk')}>Find someone to talk to</button></>}
      {screen === 'Calm' && <><h1>Calm</h1><div className="choices">{[['Breathe','Two-minute breathing'],['Grounding','Five senses grounding'],['Quiet','One-minute quiet pause']].map(([key,label]) => <button key={key} onClick={() => go(key)}>{label}</button>)}</div></>}
      {['Breathe','Grounding','Quiet'].includes(screen) && <button className="quiet" onClick={() => go('Calm')}>← Calm</button>}
      {screen === 'Breathe' && <Breath />}
      {screen === 'Grounding' && <Grounding />}
      {screen === 'Quiet' && <QuietPause />}
      {screen === 'Play' && <><h1>Play</h1><div className="choices"><button onClick={() => go('Memory')}>Memory Match</button><button onClick={() => go('Words')}>Campus Word Scramble</button></div></>}
      {['Memory','Words'].includes(screen) && <button className="quiet" onClick={() => go('Play')}>← Play</button>}
      {screen === 'Memory' && <MemoryMatch />}
      {screen === 'Words' && <WordScramble />}
      {screen === 'Urgent' && <><button className="quiet" onClick={() => go(previous)}>← Back</button><h1>You don’t have to handle this alone.</h1>
        <section className="card"><h2>Emergency services</h2><p>If you or someone else is in immediate danger, call emergency services.</p><a className="button urgent" href="tel:112">Call 112</a></section>
        <section className="card"><h2>Tele MANAS</h2><p>Free mental health support, available 24/7 in India.</p><a className="button primary" href="tel:+9114416?oai_link_source=model_response_hotline">Call 14416</a></section>
        <section className="card"><h2>Campus counselling desk</h2><p>Contact details and hours are pending campus confirmation.</p></section>
        <button onClick={() => go(active ? 'Breathe' : 'Guest breath')}>Open breathing exercise</button></>}
      {screen === 'Guest breath' && <><button className="quiet" onClick={() => go('Urgent')}>← Urgent help</button><Breath /></>}
    </main>
    {active && <nav aria-label="Main navigation"><div>{nav.map((label,i) => <button key={label} aria-current={section === label ? 'page' : undefined} onClick={() => go(label)}><span aria-hidden="true">{['⌂','≈','◇','◌'][i]}</span>{label === 'Talk' ? 'Appointments' : label}</button>)}</div></nav>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
