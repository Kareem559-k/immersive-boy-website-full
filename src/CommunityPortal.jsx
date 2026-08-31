import { useState } from 'react'
import './community-portal.css'

const pages = {
  bayt: {
    index: '01',
    title: 'Bayt',
    eyebrow: 'A place to belong',
    description: 'A safe community space to connect, share what matters, and find support when you need it.',
    items: [
      ['Discussions', 'Join thoughtful conversations and share your perspective.'],
      ['Community', 'Meet people, discover groups, and build lasting connections.'],
      ['Support Resources', 'Explore trusted guides and practical wellbeing resources.'],
      ['Get Support', 'Reach out and find the right kind of support for you.'],
    ],
  },
  thuto: {
    index: '02',
    title: 'Thuto',
    eyebrow: 'Learn. Grow. Lead.',
    description: 'A learning platform built to turn curiosity into confidence and potential into real progress.',
    items: [
      ['Courses', 'Follow structured learning paths at your own pace.'],
      ['Learning Resources', 'Browse useful guides, tools, and recommended materials.'],
      ['Workshops', 'Learn live through practical, collaborative sessions.'],
      ['Mentorship', 'Grow with guidance from someone who has walked the path.'],
      ['Progress', 'See your milestones and keep your learning moving forward.'],
    ],
  },
  join: {
    index: '03',
    title: 'Join +',
    eyebrow: 'Your place starts here',
    description: 'Create your space in the community, contribute your skills, or help someone else move forward.',
    items: [
      ['Create Account', 'Choose your role and begin your journey.'],
      ['Login', 'Welcome back. Continue where you left off.'],
    ],
  },
}

const roles = ['Student', 'Volunteer', 'Mentor', 'Ambassador']

function AccountPanel({ mode, onClose }) {
  const isLogin = mode === 'Login'
  const [role, setRole] = useState('Student')

  return (
    <div className="account-overlay" role="dialog" aria-modal="true" aria-labelledby="account-title">
      <div className="account-panel">
        <button className="account-close" onClick={onClose} aria-label="Close account form">×</button>
        <p className="portal-label">JOIN THE COMMUNITY</p>
        <h2 id="account-title">{mode}</h2>
        <p className="account-intro">
          {isLogin ? 'Good to see you again.' : 'Tell us a little about you to get started.'}
        </p>

        <form onSubmit={(event) => event.preventDefault()}>
          {!isLogin && (
            <label>
              Full name
              <input type="text" placeholder="Your name" autoComplete="name" />
            </label>
          )}
          <label>
            Email address
            <input type="email" placeholder="you@example.com" autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" placeholder="At least 8 characters" autoComplete={isLogin ? 'current-password' : 'new-password'} />
          </label>

          {!isLogin && (
            <fieldset>
              <legend>I want to join as</legend>
              <div className="role-grid">
                {roles.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={role === item ? 'role is-selected' : 'role'}
                    onClick={() => setRole(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <button className="submit-account" type="submit">
            {isLogin ? 'Login' : `Create ${role} account`} <span>→</span>
          </button>
        </form>
      </div>
    </div>
  )
}

function JoinCard() {
  const [mode, setMode] = useState('Create Account')
  const [role, setRole] = useState('Student')
  const isLogin = mode === 'Login'

  return (
    <div className="join-card">
      <div className="join-tabs" aria-label="Account action">
        {['Create Account', 'Login'].map((item) => (
          <button
            key={item}
            className={mode === item ? 'is-active' : ''}
            onClick={() => setMode(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="join-card-heading">
        <p>{isLogin ? 'WELCOME BACK' : 'START YOUR JOURNEY'}</p>
        <h2>{mode}</h2>
        <span>{isLogin ? 'Continue from where you left off.' : 'One account. Your space to learn and belong.'}</span>
      </div>

      <form onSubmit={(event) => event.preventDefault()}>
        {!isLogin && (
          <label>
            Full name
            <input type="text" placeholder="Your name" autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input type="email" placeholder="you@example.com" autoComplete="email" />
        </label>
        <label>
          Password
          <input type="password" placeholder="••••••••" autoComplete={isLogin ? 'current-password' : 'new-password'} />
        </label>

        {!isLogin && (
          <fieldset>
            <legend>Choose your role</legend>
            <div className="role-grid">
              {roles.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={role === item ? 'role is-selected' : 'role'}
                  onClick={() => setRole(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <button className="submit-account" type="submit">
          {isLogin ? 'Login' : 'Create account'} <span>→</span>
        </button>
      </form>
    </div>
  )
}

export default function CommunityPortal({ initialPage, onBack }) {
  const [activePage, setActivePage] = useState(initialPage)
  const [accountMode, setAccountMode] = useState(null)
  const page = pages[activePage]

  const handleItem = (title) => {
    if (title === 'Create Account' || title === 'Login') setAccountMode(title)
  }

  return (
    <main className={`community-portal theme-${activePage}`}>
      <div className="portal-noise" aria-hidden="true" />
      <header className="portal-nav">
        <button className="portal-brand" onClick={onBack} aria-label="Back to the story">
          <span className="brand-mark">Y</span>
          <span>YOUR<br />STORY</span>
        </button>

        <nav aria-label="Community navigation">
          {Object.entries(pages).map(([key, item]) => (
            <button
              key={key}
              className={activePage === key ? 'is-active' : ''}
              onClick={() => setActivePage(key)}
            >
              {item.title}
            </button>
          ))}
        </nav>

        <button className="back-story" onClick={onBack}>Back to story <span>↙</span></button>
      </header>

      {activePage === 'join' ? (
        <section className="join-stage">
          <div className="join-stage-title">
            <p className="portal-label">{page.eyebrow}</p>
            <h1>Join +</h1>
          </div>
          <JoinCard />
        </section>
      ) : (
        <section className="portal-hero">
          <div className="portal-title-wrap">
            <p className="portal-label">{page.eyebrow}</p>
            <h1>{page.title}</h1>
            <p className="portal-description">{page.description}</p>
          </div>

          <div className="portal-directory">
            <div className="directory-head">
              <span>Explore {page.title}</span>
              <span>{String(page.items.length).padStart(2, '0')} pathways</span>
            </div>
            {page.items.map(([title, description], index) => (
              <button className="directory-row" key={title} onClick={() => handleItem(title)}>
                <span className="row-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="row-copy"><strong>{title}</strong><small>{description}</small></span>
                <span className="row-arrow">↗</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="portal-footer">
        <span>© 2026 Your Story</span>
        <span>{page.index} / 03</span>
      </footer>

      {accountMode && <AccountPanel mode={accountMode} onClose={() => setAccountMode(null)} />}
    </main>
  )
}
