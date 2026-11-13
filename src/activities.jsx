import { useEffect, useState } from 'react'

const grounding = [
  'Notice five things you can see.',
  'Notice four things you can feel.',
  'Notice three sounds around you.',
  'Notice two things you can smell.',
  'Notice one thing you can taste.',
]
export function Grounding() {
  const [step, setStep] = useState(0)
  const done = step === grounding.length
  return <section className="card"><h1>Five senses grounding</h1>
    <p role="status">{done ? 'You’ve reached the end of the exercise.' : `Step ${step + 1} of 5 · ${grounding[step]}`}</p>
    <div className="choices">{done ? <button onClick={() => setStep(0)}>Start again</button> :
      <><button className="primary" onClick={() => setStep(step + 1)}>Next</button>
        <button onClick={() => setStep(step + 1)}>Skip</button>
        <button onClick={() => setStep(grounding.length)}>End exercise</button></>}</div>
  </section>
}

export function QuietPause() {
  const [left, setLeft] = useState(60)
  const [end, setEnd] = useState(null)
  useEffect(() => {
    if (!end) return
    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((end - performance.now()) / 1000))
      setLeft(seconds)
      if (!seconds) setEnd(null)
    }, 120)
    return () => clearInterval(timer)
  }, [end])
  return <section className="card"><h1>One-minute quiet pause</h1>
    <p>Feel your feet on the floor or notice the support of your chair. Let your shoulders rest.</p>
    <p>{left ? `${left} seconds left` : 'Your quiet pause is complete.'}</p>
    <div className="choices"><button className="primary" onClick={() => {
      if (end) setEnd(null)
      else { const remaining = left || 60; setLeft(remaining); setEnd(performance.now() + remaining * 1000) }
    }}>{end ? 'Pause' : !left ? 'Start again' : left === 60 ? 'Start' : 'Resume'}</button>
    <button onClick={() => {setLeft(60);setEnd(null)}}>Reset</button></div>
  </section>
}

const symbols = ['Book','Leaf','Cup','Star','Pen','Bag']
function shuffledCards() {
  const cards = [...symbols,...symbols]
  for (let i=cards.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1))
    ;[cards[i],cards[j]] = [cards[j],cards[i]]
  }
  return cards
}

export function MemoryMatch() {
  const [cards,setCards] = useState(shuffledCards)
  const [shown,setShown] = useState([])
  const [matched,setMatched] = useState([])
  const [notice,setNotice] = useState('')
  useEffect(() => {
    if (shown.length !== 2) return
    const timer = setTimeout(() => setShown([]),850)
    return () => clearTimeout(timer)
  },[shown])
  function flip(index) {
    const first = shown[0]
    if (shown.length === 1 && cards[first] === cards[index]) {
      setMatched([...matched,first,index])
      setShown([])
      setNotice('Pair found.')
    } else {
      setShown([...shown,index])
      setNotice(shown.length ? 'Try another pair.' : '')
    }
  }
  return <section className="card"><h1>Memory Match</h1><p>Flip two cards to find a pair.</p>
    <div className="game-grid">{cards.map((card,index) => {
      const visible = shown.includes(index) || matched.includes(index)
      return <button key={index} aria-label={visible ? `Card ${index+1}, ${card}` : `Flip card ${index+1}`}
        disabled={visible || shown.length===2} onClick={() => flip(index)}>{visible ? card : '?'}</button>
    })}</div>
    <p role="status">{matched.length === cards.length ? 'You found every pair!' : `${matched.length/2} of 6 pairs. ${notice}`}</p>
    <button onClick={() => {setCards(shuffledCards());setShown([]);setMatched([]);setNotice('')}}>Play again</button>
  </section>
}

const words = [['RARYLIB','LIBRARY','A quiet place to read'],['SCAUMP','CAMPUS','The university grounds'],['LETOSH','HOSTEL','A place students live'],['NECANTE','CANTEEN','Where you can get lunch']]
export function WordScramble() {
  const [index,setIndex] = useState(0)
  const [answer,setAnswer] = useState('')
  const [feedback,setFeedback] = useState('')
  const [solved,setSolved] = useState(false)
  const word = words[index]
  function next(i) {setIndex(i);setAnswer('');setFeedback('');setSolved(false)}
  return <section className="card"><h1>Campus Word Scramble</h1>
    {word ? <><h2>{word[0]}</h2><p>{word[2]}</p>
      <form onSubmit={e => {
        e.preventDefault()
        const correct=answer.trim().toUpperCase()===word[1]
        setSolved(correct)
        setFeedback(correct ? 'You got it!' : 'Give it another try.')
      }}>
        <label htmlFor="answer">Your answer</label><input id="answer" value={answer} disabled={solved} onChange={e => setAnswer(e.target.value)} />
        <div className="choices">{solved ? <button type="button" className="primary" onClick={() => next(index+1)}>Next word</button> :
          <><button className="primary" type="submit">Check answer</button><button type="button" onClick={() => {setSolved(true);setFeedback('The answer is '+word[1]+'.')}}>Skip</button></>}</div>
      </form><p role="status">{feedback}</p></> : <><p>You’ve reached the end of the game.</p><button onClick={() => next(0)}>Play again</button></>}
  </section>
}
