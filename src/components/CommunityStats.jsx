
import { useEffect, useState } from 'react'
import { api } from '../api.js'

function CommunityStats() {
  const [totalUsers, setTotalUsers] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let active = true

    api('/stats')
      .then(data => {
        const count = Number(data.totalUsers)

        if (!Number.isSafeInteger(count) || count < 0) {
          throw new Error('Invalid community count')
        }

        if (active) {
          setTotalUsers(count)
          setStatus('success')
        }
      })
      .catch(() => {
        if (active) setStatus('error')
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <section
      className="community-stats"
      aria-labelledby="community-title"
    >
      <div className="community-stats" aria-live="polite">
    <div className="community-stats-heading">
      <span className="community-stats-dot" />
      OUR COMMUNITY
    </div>

    <div className="community-stats-number">
      {status === 'loading'
        ? '—'
        : status === 'error'
          ? '—'
          : totalUsers.toLocaleString('en-IN')}
    </div>

    <p className="community-stats-caption">
      {status === 'error'
        ? 'Community count temporarily unavailable'
        : 'students have joined the BenSpace community'}
    </p>
  </div>
    </section>
  )
}

export default CommunityStats
