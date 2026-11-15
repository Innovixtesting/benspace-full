
import { useRef } from 'react'

function AboutBenSpace() {
  const dialogRef = useRef(null)

  return (
    <>
      <button
        type="button"
        className="about-trigger"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        About
      </button>

      <dialog
        ref={dialogRef}
        className="about-dialog"
        aria-labelledby="about-benspace-title"
      >
        <h2 id="about-benspace-title">About BenSpace</h2>

        <p>
          BenSpace is a student wellbeing platform designed for
          university students. It brings together mood check-ins,
          guided breathing, meditation, wellbeing games, peer
          support, and appointments with psychologists and
          counsellors. Urgent help is accessible before sign-in.
        </p>

        <dl className="about-details">
          <dt>Platform</dt>
          <dd>Responsive web application</dd>

          <dt>Built with</dt>
          <dd>React and Vite · Node.js API · PostgreSQL database</dd>

          <dt>Concept and Creative Head</dt>
          <dd>Sai Tamanna Srinivasan</dd>

          <dt>App Developed By</dt>
          <dd>Innovix Technologies PVT LTD</dd>
        </dl>

        <form method="dialog">
          <button type="submit" className="primary" autoFocus>
            Close
          </button>
        </form>
      </dialog>
    </>
  )
}

export default AboutBenSpace
