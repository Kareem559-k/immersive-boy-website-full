import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Lenis from 'lenis'
import Experience from './Experience'
import CommunityPortal from './CommunityPortal'

const HERO_FIRST_NAME = 'YOUR'
const HERO_LAST_NAME = 'NAME'

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

// 0 -> 91% = the 12-card orbit. The last section settles into the final portrait.
const STORY_END = 0.91
const FINALE_START = 0.947

const clamp01 = (value) => Math.min(1, Math.max(0, value))

function smoothstep01(value) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

export default function App() {
  const progressRef = useRef(0)
  const [entered, setEntered] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [uiProgress, setUiProgress] = useState(0)
  const [portalPage, setPortalPage] = useState(null)
  const [transitionTarget, setTransitionTarget] = useState(null)

  useEffect(() => {
    document.body.style.overflow = entered ? '' : 'hidden'

    if (!entered) {
      window.scrollTo(0, 0)
      progressRef.current = 0
      setUiProgress(0)
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [entered])

  useEffect(() => {
    if (!entered) return

    // Faster than V9, but still has weight and inertia.
    const lenis = new Lenis({
      autoRaf: true,
      // A longer easing curve removes the hard wheel-step feeling and lets the
      // camera glide through the helix instead of chasing the browser scroll.
      duration: 1.28,
      smoothWheel: true,
      syncTouch: true,
      wheelMultiplier: 0.82,
      touchMultiplier: 0.95,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    })

    const update = ({ scroll, limit }) => {
      const next = limit > 0 ? clamp01(scroll / limit) : 0
      progressRef.current = next
      setUiProgress(next)
    }

    lenis.on('scroll', update)
    return () => lenis.destroy()
  }, [entered])

  const enterExperience = () => {
    window.scrollTo(0, 0)
    progressRef.current = 0
    setUiProgress(0)
    setEntered(true)
  }

  const storyProgress = clamp01(uiProgress / STORY_END)
  const finaleMix = smoothstep01((uiProgress - FINALE_START) / (1 - FINALE_START))
  const currentMonthIndex = Math.min(11, Math.round(storyProgress * 11))
  const currentMonth = MONTHS[currentMonthIndex]

  const openPortal = (page) => {
    if (transitionTarget) return
    setTransitionTarget(page)
    window.setTimeout(() => {
      setPortalPage(page)
      setTransitionTarget(null)
    }, 620)
  }

  if (portalPage) {
    return (
      <CommunityPortal
        initialPage={portalPage}
        onBack={() => setPortalPage(null)}
      />
    )
  }

  return (
    <main className={entered ? 'app is-entered' : 'app'}>
      <style>{`
        :root {
          --blue: #102d49;
          --blue-mid: #1a4365;
          --blue-dark: #071a2d;
          --cyan: #6ac8ff;
          --white: rgba(247,250,252,.95);
        }

        html,
        body,
        #root {
          margin: 0;
          width: 100%;
          min-height: 100%;
          background: var(--blue);
        }

        body {
          overscroll-behavior: none;
        }

        * {
          box-sizing: border-box;
        }

        .app {
          position: relative;
          min-height: 100vh;
          background:
            radial-gradient(circle at 50% 38%, #214f72 0%, #102d49 47%, #071a2d 100%);
          color: var(--white);
          overflow-x: clip;
        }

        .canvas-shell {
          position: fixed;
          inset: 0;
          z-index: 2;
          width: 100vw;
          height: 100vh;
          will-change: transform;
        }

        .canvas-shell::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 42%, rgba(123,203,255,.055), transparent 33%),
            radial-gradient(circle at center, transparent 51%, rgba(1,10,20,.27) 100%);
        }

        /* INTRO / FINAL BIG NAME */
        .big-name {
          position: fixed;
          inset: 0;
          z-index: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          pointer-events: none;
          font-family: Georgia, 'Times New Roman', serif;
          font-weight: 600;
          font-size: clamp(105px, 17.2vw, 290px);
          line-height: .64;
          letter-spacing: -.07em;
          color: rgba(2, 18, 34, .74);
        }

        .big-name span:first-child { transform: translateX(-13vw); }
        .big-name span:last-child { transform: translateX(10vw); }
        .intro-name { transform: translateY(-7vh); }
        .final-name {
          opacity: ${finaleMix};
          transform: translateY(-5vh) scale(${0.96 + finaleMix * 0.04});
        }

        /* INTRO */
        .gate {
          position: fixed;
          inset: 0;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-end;
          padding: 0 0 8vh 6vw;
          pointer-events: none;
          background: transparent;
        }

        .intro-block {
          width: min(370px, 72vw);
          pointer-events: auto;
        }

        .intro-copy {
          margin: 0;
          color: rgba(238,247,252,.76);
          font: 500 14px/1.68 Arial, sans-serif;
        }

        .explore-button,
        .read-more {
          border: 0;
          border-bottom: 1px solid rgba(150,218,255,.52);
          background: transparent;
          color: white;
          font-family: Georgia, 'Times New Roman', serif;
          font-weight: 600;
          cursor: pointer;
          transition: width .35s ease, opacity .35s ease, transform .35s ease;
        }

        .explore-button {
          display: block;
          margin: 24px 0 0;
          width: 126px;
          padding: 0 0 13px;
          font-size: 17px;
        }

        .explore-button:hover {
          width: 160px;
          opacity: .76;
          transform: translateX(5px);
        }

        /* TIMELINE */
        .story-ui {
          position: fixed;
          inset: 0;
          z-index: 9;
          pointer-events: none;
          opacity: ${1 - finaleMix};
          transition: opacity .2s linear;
        }

        .brand-lockup {
          position: absolute;
          top: 7.5vh;
          left: 5.4vw;
          font: 700 17px/.95 Arial, sans-serif;
          letter-spacing: -.03em;
        }

        .timeline {
          position: absolute;
          top: 8.5vh;
          left: 50%;
          width: min(405px, 34vw);
          transform: translateX(-50%);
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 20px;
          font: 700 13px/1 Arial, sans-serif;
        }

        .timeline-rail {
          position: relative;
          height: 1px;
          background: rgba(206,235,250,.26);
        }

        .timeline-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 1px;
          width: ${storyProgress * 100}%;
          background: #78ceff;
          box-shadow: 0 0 14px rgba(92,190,255,.50);
        }

        .month-caption {
          position: absolute;
          left: 50%;
          bottom: 4.4vh;
          transform: translateX(-50%);
          text-align: center;
          font-family: Georgia, 'Times New Roman', serif;
          color: rgba(255,255,255,.95);
          text-shadow: 0 4px 22px rgba(0,0,0,.22);
        }

        .month-caption small {
          display: block;
          margin-bottom: 4px;
          font: 700 13px/1 Arial, sans-serif;
        }

        .month-caption strong {
          display: block;
          font-size: clamp(52px, 5.5vw, 92px);
          line-height: .86;
          font-weight: 600;
          letter-spacing: -.055em;
          text-transform: capitalize;
        }

        .story-orbit-hint {
          position: absolute;
          left: 5.3vw;
          bottom: 8.5vh;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(180,225,250,.25);
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #79d2ff;
          font-size: 9px;
        }

        /* Faster journey than V9: still enough room for inertia, but less empty travel. */
        .scroll-track {
          position: relative;
          z-index: 0;
          width: 100%;
          height: calc(100vh * 17);
          pointer-events: none;
        }

        /* FINAL */
        .final-copy {
          position: fixed;
          z-index: 8;
          right: 9vw;
          top: 54%;
          width: min(390px, 32vw);
          transform: translateY(-50%) translateX(${(1 - finaleMix) * 35}px);
          opacity: ${finaleMix};
          pointer-events: ${finaleMix > 0.9 ? 'auto' : 'none'};
        }

        .final-copy::before {
          content: '';
          display: block;
          width: 24px;
          height: 1px;
          margin-bottom: 25px;
          background: rgba(142,214,255,.72);
        }

        .final-copy p {
          margin: 0;
          color: rgba(229,241,248,.76);
          font: 600 14px/1.62 Arial, sans-serif;
        }

        .read-more {
          display: block;
          margin: 36px 0 0 auto;
          width: 114px;
          padding: 0 0 14px;
          font-size: 16px;
        }

        .read-more:hover { width: 145px; opacity: .78; }

        .portal-kicker {
          margin: 0 0 9px !important;
          color: #79d2ff !important;
          font: 700 10px/1 Arial, sans-serif !important;
          letter-spacing: .22em;
          text-transform: uppercase;
        }

        .portal-heading {
          margin: 0 0 22px;
          font: 600 clamp(31px, 3.2vw, 49px)/.95 Georgia, 'Times New Roman', serif;
          letter-spacing: -.045em;
        }

        .portal-links {
          display: grid;
          gap: 8px;
        }

        .portal-link {
          width: 100%;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 14px;
          padding: 14px 0;
          border: 0;
          border-bottom: 1px solid rgba(135,205,245,.25);
          background: transparent;
          color: white;
          text-align: left;
          cursor: pointer;
          transition: padding .25s ease, border-color .25s ease, color .25s ease;
        }

        .portal-link:hover {
          padding-left: 10px;
          color: #89d5ff;
          border-color: rgba(137,213,255,.75);
        }

        .portal-link small {
          color: rgba(137,213,255,.62);
          font: 700 10px/1 Arial, sans-serif;
        }

        .portal-link strong {
          font: 600 20px/1 Georgia, 'Times New Roman', serif;
        }

        .portal-link span { font-size: 17px; }

        /* Permanent portal navigation — replaces the social links in the reference. */
        .portal-dock {
          position: fixed;
          z-index: 14;
          right: 5.2vw;
          bottom: 7.2vh;
          width: min(410px, 34vw);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-top: 1px solid rgba(174,222,248,.035);
          pointer-events: auto;
        }

        .dock-link {
          position: relative;
          min-width: 0;
          padding: 10px 8px 4px;
          overflow: hidden;
          border: 0;
          background: transparent;
          color: rgba(231,245,252,.36);
          text-align: left;
          cursor: pointer;
          isolation: isolate;
          transition: color .35s ease, transform .35s cubic-bezier(.2,.8,.2,1);
        }

        .dock-link::before {
          content: '';
          position: absolute;
          z-index: -1;
          inset: 0;
          background: linear-gradient(115deg, rgba(70,181,241,.2), rgba(70,181,241,.025));
          transform: translateY(-105%);
          transition: transform .42s cubic-bezier(.16,1,.3,1);
        }

        .dock-link::after {
          content: '';
          position: absolute;
          top: -1px;
          left: 50%;
          width: 0;
          height: 1px;
          background: #79d2ff;
          box-shadow: 0 0 7px rgba(121,210,255,.95), 0 0 18px rgba(121,210,255,.45);
          transform: translateX(-50%);
          transition: width .48s cubic-bezier(.16,1,.3,1), box-shadow .35s ease;
        }

        .dock-link small {
          display: block;
          margin-bottom: 4px;
          color: rgba(104,191,233,.56);
          font: 700 6px/1 Arial, sans-serif;
          letter-spacing: .12em;
          transition: transform .35s ease;
        }

        .dock-link strong {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font: 600 clamp(9px, .68vw, 11px)/1 Arial, sans-serif;
          letter-spacing: .04em;
          white-space: nowrap;
        }

        .dock-link strong i {
          font: 400 8px/1 Arial, sans-serif;
          opacity: 0;
          transform: translate(-8px, 8px);
          transition: opacity .3s ease, transform .4s cubic-bezier(.16,1,.3,1);
        }

        .dock-link:hover,
        .dock-link:focus-visible,
        .dock-link.is-launching {
          color: white;
          outline: 0;
          transform: translateY(-1px);
        }
        .dock-link:hover::before,
        .dock-link:focus-visible::before,
        .dock-link.is-launching::before { transform: translateY(0); }
        .dock-link:hover::after,
        .dock-link:focus-visible::after,
        .dock-link.is-launching::after { width: calc(100% - 14px); }
        .dock-link:hover small,
        .dock-link:focus-visible small,
        .dock-link.is-launching small { transform: translateX(3px); }
        .dock-link:hover strong i,
        .dock-link:focus-visible strong i,
        .dock-link.is-launching strong i { opacity: 1; transform: translate(0, 0); }

        .portal-wipe {
          position: fixed;
          z-index: 100;
          inset: 0;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: #041525;
          animation: portalWipe .66s cubic-bezier(.76,0,.24,1) both;
          pointer-events: all;
        }

        .portal-wipe::before {
          content: '';
          position: absolute;
          width: 28vw;
          aspect-ratio: 1;
          border: 1px solid rgba(103,199,250,.34);
          border-radius: 50%;
          animation: portalRing .66s ease-out both;
        }

        .portal-wipe span {
          position: relative;
          color: white;
          font: 600 clamp(48px, 9vw, 130px)/1 Georgia, 'Times New Roman', serif;
          letter-spacing: -.06em;
          text-transform: capitalize;
          animation: portalWord .55s cubic-bezier(.2,.8,.2,1) both;
        }

        @keyframes portalWipe {
          from { clip-path: inset(0 0 100% 0); }
          to { clip-path: inset(0); }
        }
        @keyframes portalRing {
          from { transform: scale(.3); opacity: 0; }
          to { transform: scale(2.5); opacity: .12; }
        }
        @keyframes portalWord {
          from { transform: translateY(35px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* VIDEO MODAL */
        .video-modal {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          background: rgba(3,14,26,.92);
          backdrop-filter: blur(14px);
        }

        .video-modal-inner {
          width: min(920px, 84vw);
          aspect-ratio: 16 / 9;
          display: grid;
          place-items: center;
          border: 1px solid rgba(145,215,255,.18);
          background: #071b2d;
          box-shadow: 0 30px 100px rgba(0,0,0,.40);
          color: white;
          font: 700 18px/1 Arial, sans-serif;
        }

        .video-modal-close {
          position: fixed;
          top: 28px;
          right: 34px;
          border: 0;
          background: transparent;
          color: white;
          font: 700 13px/1 Arial, sans-serif;
          cursor: pointer;
        }

        @media (max-width: 760px) {
          .big-name { font-size: clamp(76px, 23vw, 150px); }
          .big-name span:first-child { transform: translateX(-7vw); }
          .big-name span:last-child { transform: translateX(7vw); }
          .gate { padding: 0 22px 8vh; }
          .explore-button { margin-left: 0; }
          .brand-lockup { left: 20px; top: 28px; }
          .timeline {
            top: 30px;
            left: auto;
            right: 20px;
            transform: none;
            width: 49vw;
            gap: 9px;
          }
          .month-caption { bottom: 4vh; }
          .final-copy {
            left: 24px;
            right: 24px;
            top: auto;
            bottom: 8vh;
            width: auto;
          }
          .portal-dock {
            right: 20px;
            bottom: 24px;
            width: calc(100vw - 40px);
          }
          .dock-link { padding: 9px 6px 4px; }
          .dock-link strong { font-size: 9px; }
        }
      `}</style>

      {!entered && (
        <div className="big-name intro-name" aria-hidden="true">
          <span>{HERO_FIRST_NAME}</span>
          <span>{HERO_LAST_NAME}</span>
        </div>
      )}

      {entered && finaleMix > 0.001 && (
        <div className="big-name final-name" aria-hidden="true">
          <span>{HERO_FIRST_NAME}</span>
          <span>{HERO_LAST_NAME}</span>
        </div>
      )}

      <div className="canvas-shell">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 1.78, 12.2], fov: 41, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <Experience
              progressRef={progressRef}
              onSelectCard={setSelectedCard}
              entered={entered}
              storyEnd={STORY_END}
              finaleStart={FINALE_START}
            />
          </Suspense>
        </Canvas>
      </div>

      {!entered && (
        <section className="gate">
          <div className="intro-block">
            <p className="intro-copy">
              An illustrated timeline of one person's story.<br />
              Explore the moments that shaped the journey.
            </p>

            <button className="explore-button" onClick={enterExperience}>
              Explore
            </button>
          </div>
        </section>
      )}

      {entered && (
        <>
          <div className="story-ui">
            <div className="brand-lockup">YOUR<br />NAME</div>

            <div className="timeline">
              <span>JAN</span>
              <div className="timeline-rail">
                <i className="timeline-fill" />
              </div>
              <span>DEC</span>
            </div>

            <div className="month-caption">
              <small>2026</small>
              <strong>{currentMonth.toLowerCase()}</strong>
            </div>

            <div className="story-orbit-hint">▶</div>
          </div>

          <div className="scroll-track" />

          <nav className="portal-dock" aria-label="Explore our community">
            {[
              ['01', 'Bayt', 'bayt'],
              ['02', 'Thuto', 'thuto'],
              ['03', 'Join +', 'join'],
            ].map(([number, label, page]) => (
              <button
                className={transitionTarget === page ? 'dock-link is-launching' : 'dock-link'}
                key={page}
                onClick={() => openPortal(page)}
              >
                <small>{number}</small>
                <strong>{label}<i>↗</i></strong>
              </button>
            ))}
          </nav>
        </>
      )}

      {entered && finaleMix > 0.001 && (
        <section className="final-copy">
          <p>
            Every story grows through belonging, learning and the courage to
            take part. Choose your next space from the menu below.
          </p>
        </section>
      )}

      {transitionTarget && (
        <div className="portal-wipe" aria-hidden="true">
          <span>{transitionTarget === 'join' ? 'Join +' : transitionTarget}</span>
        </div>
      )}

      {selectedCard !== null && (
        <div className="video-modal" role="dialog" aria-modal="true">
          <button className="video-modal-close" onClick={() => setSelectedCard(null)}>
            CLOSE ×
          </button>
          <div className="video-modal-inner">
            VIDEO {String(selectedCard + 1).padStart(2, '0')}
          </div>
        </div>
      )}
    </main>
  )
}
