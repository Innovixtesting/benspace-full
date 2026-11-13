export const demoID = 'BU-DEMO-001'
export const demoCode = '246810'
export const moods = [
  ['Rough', '#d89988', 'That sounds like a hard day. If you’d like to talk, you can start here.', 'Talk', 'Explore support'],
  ['Low', '#c9bff0', 'It’s okay to take things slowly. Would a short pause help?', 'Breathe', 'Take a breath'],
  ['Okay', '#a7c5d7', 'Thanks for checking in. Make a little room for yourself today.', 'Read', 'Find a short read'],
  ['Good', '#9ac8b3', 'Take a moment to notice what’s going well.', 'Read', 'Find a short read'],
  ['Great', '#80b79d', 'Take a moment to enjoy what feels good today.', 'Read', 'Find a short read'],
]
export const modes = ['In person', 'Video', 'Chat']
export const providers = [
  { id: 'maya', name: 'Dr Maya Rao', role: 'Counsellor', focus: 'Anxiety · Exam stress', bio: 'We can start with whatever is on your mind and go at a pace that feels comfortable.' },
  { id: 'aditi', name: 'Aditi Mehra', role: 'Counsellor', focus: 'Burnout · Life transitions', bio: 'I help students make sense of difficult changes and find small steps they can try.' },
  { id: 'riya', name: 'Riya Sen', role: 'Peer mentor', focus: 'Settling in · Campus life', bio: 'I’m a senior student. We can talk about finding your feet and building a routine on campus.' },
  { id: 'leela', name: 'Leela Iyer', role: 'Peer mentor', focus: 'Homesickness · Making friends', bio: 'We can talk about getting comfortable on campus and finding student groups.' },
  { id: 'arun', name: 'Prof Arun Das', role: 'Faculty mentor', focus: 'Academic pressure · Career choices', bio: 'We can work through academic decisions and figure out who can help you with the next step.' },
]
const day = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
const display = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
export const formatSlot = (iso) => display.format(new Date(iso)) + ' IST'
export function demoSlots(provider) {
  return [1, 2, 3].map((offset, i) => {
    const parts = Object.fromEntries(day.formatToParts(Date.now() + offset * 86400000).map(({type, value}) => [type, value]))
    const startsAt = new Date(`${parts.year}-${parts.month}-${parts.day}T${['10:30','14:00','16:00'][i]}:00+05:30`).toISOString()
    return { id: provider.id + ':' + startsAt, startsAt }
  })
}
export const articles = [
  ['Motivation', 'Motivation follows action, not the other way round', 'A two-minute start for a task you’ve been putting off.', 'Choose one task and make the first step small enough to finish in two minutes. Open your notes and write the heading, or take out the book and mark the first page.', 'When two minutes are up, you can stop or keep going. The goal is to make beginning easier.'],
  ['Sleep', 'Give the day a soft landing', 'A short wind-down between campus life and bedtime.', 'Pick one small action that signals the end of study time, such as closing your laptop and writing down the first task for tomorrow.', 'Try the same action for a few evenings and see whether it fits your routine.'],
  ['Movement', 'Make room for a short walk', 'An easy movement break between classes.', 'If a walk is accessible to you, choose a short familiar route. You could invite a friend or take a quieter route on your own.', 'If you prefer to stay seated, take a short break and move in a way that feels comfortable.'],
  ['Health', 'Make lunch easier on busy days', 'Plan one practical break for food and water.', 'Look at your timetable and pick a break you can use for lunch. If the day is packed, decide in advance where you can get something you enjoy.', 'Keep a water bottle handy if that makes breaks easier to remember.'],
  ['Stress', 'Write down what needs doing today', 'Make a crowded to-do list easier to approach.', 'Write your tasks on paper and circle one that needs attention today. Give it a specific first step, such as drafting an email or checking a deadline.', 'Put the rest of the list aside until that step is done.'],
  ['Connection', 'Send a small hello', 'A low-pressure way to reach out.', 'Think of someone you’d like to hear from. You can start with a simple message asking if they want to meet after class or catch up over the weekend.', 'You can also ask a peer mentor about campus groups if you’re looking for ways to meet people.'],
].map(([topic, title, summary, ...body]) => ({ topic, title, summary, body }))

export const quotes = {
  Neutral: ['Take the day one moment at a time.', 'Leave a little room in your day for yourself.', 'You can pause before deciding what comes next.', 'An ordinary moment can be enough.', 'Give yourself a moment between one thing and the next.', 'Make room for something you enjoy.', 'Notice what feels steady today.'],
  Rough: ['You don’t have to figure everything out today.', 'You can ask for help before you have the right words.', 'One manageable step is enough for now.', 'There is room for a pause, even on a hard day.', 'You can reach out while you’re still figuring things out.', 'You’re allowed to give a difficult moment some time.', 'Start with what feels possible right now.'],
  Low: ['It’s okay to make today a little smaller.', 'A quiet moment counts.', 'Give yourself the patience you’d give a friend.', 'Some days call for a gentler pace.', 'Rest can have a place in your plans.', 'Pick one small thing that feels manageable.', 'You can take a pause without earning it.'],
  Okay: ['An ordinary day can still have a moment worth keeping.', 'Notice one thing you’d like to do again tomorrow.', 'Give a small curiosity some room.', 'There’s space for an unplanned moment.', 'A familiar routine can make a good place to begin.', 'Pick something small to look forward to.', 'Let yourself enjoy the ordinary parts of the day.'],
  Good: ['Give yourself a moment to enjoy what’s going well.', 'Take note of one thing that helped today.', 'Enjoy the part of the day you’re in.', 'Make time for one small thing you like.', 'A good moment is worth slowing down for.', 'Notice who or what made today a little lighter.', 'Keep a little room for what feels good.'],
  Great: ['Take a moment to remember what made today feel good.', 'You can enjoy this moment exactly as it is.', 'Share a little of your good day if you feel like it.', 'Think of one thing you’d like to remember from today.', 'Give yourself a moment to enjoy what you worked for.', 'Save one detail that will make you smile later.', 'Let this good moment have your attention.'],
}

export function dailyQuote(mood, now = Date.now()) {
  const options = quotes[mood] ?? quotes.Neutral
  const dayInIndia = Math.floor((now + 19800000) / 86400000)
  return options[dayInIndia % options.length]
}
