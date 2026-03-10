import { useState } from "react";
import { Link } from "react-router-dom";

const GridBackground = () => (
  <svg className="grid-bg" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <pattern id="smallGrid" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,204,0,0.06)" strokeWidth="0.5"/>
      </pattern>
      <pattern id="grid" width="150" height="150" patternUnits="userSpaceOnUse">
        <rect width="150" height="150" fill="url(#smallGrid)"/>
        <path d="M 150 0 L 0 0 0 150" fill="none" stroke="rgba(255,204,0,0.1)" strokeWidth="1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

const NavButton = ({ label, icon, index, href, disabled }) => {
  const [hovered, setHovered] = useState(false);

  const content = (
    <>
      <span className="btn-index">0{index + 1}</span>
      <span className="btn-icon">{icon}</span>
      <span className="btn-label">{label}</span>
      {disabled
        ? <span className="btn-wip">IN PROGRESS</span>
        : <span className="btn-arrow">→</span>
      }
      <div className="btn-glow" />
    </>
  );

  if (disabled) {
    return (
      <div
        className="nav-btn nav-btn-disabled"
        style={{ animationDelay: `${0.4 + index * 0.1}s` }}
      >
        {content}
      </div>
    );
  }

  if (href && href.startsWith('/')) {
    return (
      <Link
        to={href}
        className={`nav-btn ${hovered ? "hovered" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ animationDelay: `${0.4 + index * 0.1}s`, textDecoration: "none" }}
      >
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`nav-btn ${hovered ? "hovered" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ animationDelay: `${0.4 + index * 0.1}s`, textDecoration: "none" }}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      className={`nav-btn ${hovered ? "hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ animationDelay: `${0.4 + index * 0.1}s` }}
    >
      {content}
    </button>
  );
};

export default function App() {
  const pages = [
    { label: "Scouting Dashboard", icon: "◈", href: "/dashboard" },
    { label: "Head Scout Data Collection", icon: "⬡", href: "https://forms.gle/fPTXScLXohLeLscTA", disabled: true },
    { label: "Match Analysis & Playback System", icon: "◎", href: "https://maps.team2996.com/" },
    { label: "Configuration & Data Upload", icon: "⚙", href: "/config" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;700;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #080c10;
          color: #e8e8e4;
          font-family: 'Exo 2', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        .grid-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(130px);
          pointer-events: none;
          z-index: 0;
        }
        .blob-1 { width: 550px; height: 550px; background: #ffcc00; opacity: 0.12; top: -180px; right: -80px; }
        .blob-2 { width: 400px; height: 400px; background: #ff0000; opacity: 0.08; bottom: -80px; left: -80px; }

        .scanlines {
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px
          );
          pointer-events: none;
          z-index: 1;
        }

        /* HEADER */
        header {
          position: relative;
          z-index: 10;
          padding: 28px 48px 0;
          display: flex;
          align-items: center;
          opacity: 0;
          transform: translateY(-20px);
          animation: fadeDown 0.6s ease forwards;
        }

        .logo-zone {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .logo-box {
          width: 54px;
          height: 54px;
          border: 1.5px solid rgba(255,204,0,0.45);
          background: rgba(255,204,0,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          clip-path: polygon(8px 0%, 100% 0%, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%, 0% 8px);
        }
        .logo-box::before {
          content: '';
          position: absolute;
          inset: 3px;
          border: 1px solid rgba(255,204,0,0.18);
          clip-path: polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px);
        }
        .logo-placeholder {
          font-family: 'Share Tech Mono', monospace;
          font-size: 16px;
          color: #ffcc00;
          font-weight: bold;
          letter-spacing: -1px;
        }

        .logo-text-group { display: flex; flex-direction: column; }
        .logo-team {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          color: #ffcc00;
          letter-spacing: 3px;
          text-transform: uppercase;
          opacity: 0.6;
        }
        .logo-name {
          font-family: 'Rajdhani', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #e8e8e4;
          letter-spacing: 1px;
        }

        /* HERO */
        .hero {
          flex: 1;
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 48px;
          text-align: center;
        }

        .title {
          font-family: 'Rajdhani', sans-serif;
          font-size: clamp(56px, 9vw, 104px);
          font-weight: 700;
          line-height: 0.95;
          letter-spacing: -1px;
          margin-bottom: 52px;
          opacity: 0;
          animation: fadeUp 0.7s ease 0.25s forwards;
        }

        .title-line1 { display: block; color: #e8e8e4; }
        .title-line2 {
          display: block;
          color: transparent;
          -webkit-text-stroke: 1.5px rgba(255,204,0,0.5);
        }
        .title-accent {
          display: inline-block;
          color: #ffcc00;
          -webkit-text-stroke: 0;
          position: relative;
          text-shadow: 0 0 40px rgba(255,204,0,0.3);
        }
        .title-accent::after {
          display: none;
        }

        /* NAV BUTTONS */
        .nav-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          width: 100%;
          max-width: 780px;
        }

        .nav-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 22px 24px;
          background: rgba(12, 18, 26, 0.85);
          border: 1px solid rgba(255,204,0,0.14);
          color: #e8e8e4;
          cursor: pointer;
          text-align: left;
          clip-path: polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px);
          transition: all 0.25s ease;
          overflow: hidden;
          opacity: 0;
          animation: fadeUp 0.5s ease forwards;
          backdrop-filter: blur(8px);
        }
        .nav-btn:hover {
          border-color: rgba(255,204,0,0.45);
          background: rgba(255,204,0,0.05);
          transform: translateY(-2px);
        }
        .nav-btn:hover .btn-glow { opacity: 1; }
        .nav-btn:hover .btn-arrow { transform: translateX(4px); color: #ff0000; }
        .nav-btn:hover .btn-label { color: #ffcc00; }
        .nav-btn:hover .btn-icon { color: #ff0000; }

        .btn-index {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          color: rgba(255,204,0,0.35);
          letter-spacing: 1px;
          min-width: 22px;
        }
        .btn-icon {
          font-size: 18px;
          color: #ffcc00;
          min-width: 22px;
          text-align: center;
          transition: color 0.2s;
        }
        .btn-label {
          flex: 1;
          font-family: 'Rajdhani', sans-serif;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 0.5px;
          transition: color 0.2s;
        }
        .btn-arrow {
          font-size: 14px;
          color: rgba(232,232,228,0.25);
          transition: all 0.2s;
        }
        .btn-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,204,0,0.05) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }

        .nav-btn-disabled {
          opacity: 0.38 !important;
          cursor: not-allowed !important;
          border-color: rgba(255,255,255,0.06) !important;
          filter: grayscale(0.6);
          animation: fadeUp 0.5s ease forwards;
        }
        .nav-btn-disabled:hover { transform: none !important; background: rgba(12,18,26,0.85) !important; border-color: rgba(255,255,255,0.06) !important; }
        .nav-btn-disabled .btn-icon { color: rgba(232,232,228,0.3) !important; }
        .btn-wip {
          font-family: 'Share Tech Mono', monospace;
          font-size: 8px; letter-spacing: 2px;
          color: rgba(232,232,228,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 2px 6px;
        }

        /* FOOTER */
        footer {
          position: relative;
          z-index: 10;
          padding: 20px 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(255,204,0,0.08);
          opacity: 0;
          animation: fadeUp 0.6s ease 0.8s forwards;
        }

        .footer-credit {
          font-family: 'Share Tech Mono', monospace;
          font-size: 11px;
          color: rgba(232,232,228,0.28);
          letter-spacing: 1.5px;
        }
        .footer-credit span { color: rgba(255,204,0,0.55); }

        .footer-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,0,0,0.15), rgba(255,204,0,0.15), transparent);
          margin: 0 24px;
        }

        .footer-ver {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          color: rgba(232,232,228,0.18);
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 600px) {
          header { padding: 20px 24px 0; }
          .hero { padding: 30px 24px; }
          .nav-grid { grid-template-columns: 1fr; }
          footer { padding: 16px 24px; flex-direction: column; gap: 8px; text-align: center; }
          .footer-line { display: none; }
        }
      `}</style>

      <div className="page">
        <GridBackground />
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="scanlines" />

        <header>
          <div className="logo-zone">
            <div className="logo-box">
              <span className="logo-placeholder">CGW</span>
            </div>
            <div className="logo-text-group">
              <span className="logo-team">FRC Team 2996</span>
              <span className="logo-name">Cougars Gone Wired</span>
            </div>
          </div>
        </header>

        <main className="hero">
          <h1 className="title">
            <span className="title-line1">SCOUTING</span>
            <span className="title-line2">DASHBOARD</span>
          </h1>

          <nav className="nav-grid">
            {pages.map((p, i) => (
              <NavButton key={p.label} label={p.label} icon={p.icon} index={i} href={p.href} disabled={p.disabled} />
            ))}
          </nav>
        </main>

        <footer>
          <p className="footer-credit">
            CRAFTED BY <span>CLAUDE AI</span>
          </p>
          <div className="footer-line" />
          <p className="footer-ver">www.team2996.com</p>
        </footer>
      </div>
    </>
  );
}