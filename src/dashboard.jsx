import { useState, useEffect, useRef, createPortal } from "react";
import { Link } from "react-router-dom";
import { useData } from "./Datacontext";
import "./dashboard.css";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";

// ── GRID BACKGROUND ──
const GridBackground = () => (
  <svg className="grid-bg" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <pattern id="sgGrid" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,204,0,0.08)" strokeWidth="0.5"/>
      </pattern>
      <pattern id="sgGridLarge" width="150" height="150" patternUnits="userSpaceOnUse">
        <rect width="150" height="150" fill="url(#sgGrid)"/>
        <path d="M 150 0 L 0 0 0 150" fill="none" stroke="rgba(255,204,0,0.14)" strokeWidth="1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#sgGridLarge)" />
  </svg>
);

// ── TBA API HELPER ──
function useTBA() {
  const { tbaConfig } = useData();
  const call = async (endpoint) => {
    if (!tbaConfig?.apiKey) throw new Error("No TBA API key configured.");
    const res = await fetch(`https://www.thebluealliance.com/api/v3${endpoint}`, {
      headers: { "X-TBA-Auth-Key": tbaConfig.apiKey },
    });
    if (!res.ok) throw new Error(`TBA error ${res.status}`);
    return res.json();
  };
  return { call, tbaConfig };
}

// ── RANKINGS TABLE ──
// ── TEAM REPORT POPUP ──
// Shown when hovering a row in the rankings table.
// Reuses the same pit/lovat rendering logic as TeamSearchPanel.

const TeamReportPopup = ({ teamNum, rankRow, onClose, tbaCall, tbaConfig }) => {
  const { lovatData, pitData } = useData();

  const [tbaTeam,  setTbaTeam]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [imgError, setImgError] = useState(false);

  const [lovatCols, setLovatCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TS_STORAGE_KEY)) ?? LOVAT_REPORT_FIELDS; }
    catch { return LOVAT_REPORT_FIELDS; }
  });
  const [pitCols, setPitCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TS_PIT_STORAGE_KEY)) ?? DEFAULT_PIT_COLS; }
    catch { return DEFAULT_PIT_COLS; }
  });
  const [lovatPickerOpen, setLovatPickerOpen] = useState(false);
  const [pitPickerOpen,   setPitPickerOpen]   = useState(false);
  const lovatPickerRef = useRef(null);
  const pitPickerRef   = useRef(null);

  // Persist column selections (shared with TeamSearchPanel)
  useEffect(() => {
    try { localStorage.setItem(TS_STORAGE_KEY,     JSON.stringify(lovatCols)); } catch {}
  }, [lovatCols]);
  useEffect(() => {
    try { localStorage.setItem(TS_PIT_STORAGE_KEY, JSON.stringify(pitCols)); }  catch {}
  }, [pitCols]);

  // Close pickers on outside click
  useEffect(() => {
    const h = e => {
      if (lovatPickerRef.current && !lovatPickerRef.current.contains(e.target)) setLovatPickerOpen(false);
      if (pitPickerRef.current   && !pitPickerRef.current.contains(e.target))   setPitPickerOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Close on Escape
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // Fetch TBA team info
  useEffect(() => {
    if (!teamNum || !tbaConfig?.apiKey) { setLoading(false); return; }
    setLoading(true);
    tbaCall(`/team/frc${teamNum}`)
      .then(data => { setTbaTeam(data ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [teamNum]);

  const pitRow   = pitData?.rows?.find(r  => String(r["Team Number"]).trim() === String(teamNum)) ?? null;
  const lovatRow = lovatData?.rows?.find(r => String(r.teamNumber).trim()    === String(teamNum)) ?? null;
  const photoUrl = pitRow ? drivePhotoUrl(pitRow["Picture of robot(Ask first-kindly)"]) : null;

  const fmt = (key, val) => {
    if (val === null || val === undefined || val === "" || val === -1) return "—";
    const n = parseFloat(val);
    if (key.startsWith("perc")) return isNaN(n) ? String(val) : `${n.toFixed(1)}%`;
    if (!isNaN(n) && n !== 0) return n % 1 === 0 ? String(n) : n.toFixed(2);
    return String(val);
  };

  const ratingDots = val => {
    const n = Math.round(parseFloat(val));
    if (isNaN(n)) return "—";
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`rating-dot ${i < n ? "rating-dot-on" : ""}`}>◆</span>
    ));
  };

  const LOVAT_GROUPS_ORDER = ["scoring","climb","defense","feed","driving"];
  const GROUP_LABELS = { scoring:"Scoring", climb:"Climb", defense:"Defense", feed:"Feeding", driving:"Driving" };
  const lovatByGroup = {};
  Object.entries(COL_META).forEach(([k, v]) => {
    if (k === "teamNumber") return;
    if (!lovatByGroup[v.group]) lovatByGroup[v.group] = [];
    lovatByGroup[v.group].push(k);
  });

  return createPortal(
    <div className="trp-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="trp-modal">

        {/* ── MODAL HEADER ── */}
        <div className="trp-modal-header">
          <div className="trp-modal-title">
            <span className="trp-title-num">{teamNum}</span>
            {loading
              ? <span className="spin trp-spin">◎</span>
              : <span className="trp-title-name">{tbaTeam?.nickname ?? pitRow?.["Team Name"] ?? ""}</span>
            }
          </div>
          <button className="trp-close-btn" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        <div className="trp-body">

          {/* ── HEADER CARD ── */}
          <div className="ts-header-card trp-header-card">
            <div className="ts-photo-box">
              {photoUrl && !imgError ? (
                <img src={photoUrl} alt={`Team ${teamNum} robot`} className="ts-photo"
                  onError={() => setImgError(true)} />
              ) : (
                <div className="ts-photo-placeholder">
                  <span>📷</span>
                  <span>{imgError ? "Photo unavailable" : "No photo"}</span>
                </div>
              )}
            </div>

            <div className="ts-identity">
              <div className="ts-team-num">{teamNum}</div>
              <div className="ts-team-name">{tbaTeam?.nickname ?? pitRow?.["Team Name"] ?? "—"}</div>
              {tbaTeam?.city && (
                <div className="ts-team-location">
                  {tbaTeam.city}, {tbaTeam.state_prov}, {tbaTeam.country}
                </div>
              )}
              {tbaTeam?.rookie_year && (
                <div className="ts-team-rookie">Rookie Year: {tbaTeam.rookie_year}</div>
              )}
            </div>

            {rankRow && (
              <div className="ts-rank-card">
                <div className="ts-rank-num">#{rankRow.rank}</div>
                <div className="ts-rank-label">EVENT RANK</div>
                <div className="ts-rank-row">
                  <span className="ts-rank-val win-text">{rankRow.record.wins}W</span>
                  <span className="ts-rank-sep">/</span>
                  <span className="ts-rank-val loss-text">{rankRow.record.losses}L</span>
                  <span className="ts-rank-sep">/</span>
                  <span className="ts-rank-val">{rankRow.record.ties}T</span>
                </div>
                <div className="ts-rank-meta">
                  <span>RP: {rankRow.extra_stats?.[0] ?? "—"}</span>
                  <span>RS: {rankRow.sort_orders?.[0]?.toFixed(2) ?? "—"}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── PIT SCOUTING ── */}
          <div className="ts-section">
            <div className="ts-section-header">
              <span className="ts-section-title">▸ PIT SCOUTING</span>
              <div ref={pitPickerRef} style={{ position: "relative" }}>
                <button className="stats-col-btn ts-lovat-btn" onClick={() => setPitPickerOpen(o => !o)}>
                  ⊞ <span className="stats-col-count">{pitCols.length}</span>
                </button>
                {pitPickerOpen && (
                  <div className="stats-picker ts-lovat-picker">
                    <div className="stats-picker-header">Pit Scouting Fields</div>
                    {["Hardware","Auto","Endgame","Software","Notes"].map(grp => {
                      const fields = PIT_FIELDS.filter(f => f.group === grp);
                      if (!fields.length) return null;
                      return (
                        <div key={grp} className="stats-picker-group">
                          <div className="stats-picker-group-label">{grp}</div>
                          {fields.map(f => (
                            <label key={f.key} className="stats-picker-row">
                              <input type="checkbox" checked={pitCols.includes(f.key)}
                                onChange={() => setPitCols(p => p.includes(f.key) ? p.filter(k=>k!==f.key) : [...p,f.key])} />
                              <span>{f.label}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {pitRow ? (
              <div className="ts-pit-grid">
                {PIT_FIELDS.filter(f => pitCols.includes(f.key)).map(f => {
                  const val = pitRow[f.key];
                  if (!val && val !== 0) return null;
                  const isRating = f.key.includes("rating");
                  const display  = f.fmt === "climb" ? formatClimbValue(String(val))
                                 : isRating          ? ratingDots(val)
                                 : String(val);
                  return (
                    <div key={f.key} className={`ts-pit-field ${f.group === "Notes" ? "ts-pit-field-wide" : ""}`}>
                      <span className="ts-pit-label">{f.label}</span>
                      <span className="ts-pit-value">{display}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ts-no-data">No pit scouting data for team {teamNum}</div>
            )}
          </div>

          {/* ── LOVAT STATS ── */}
          <div className="ts-section">
            <div className="ts-section-header">
              <span className="ts-section-title">▸ LOVAT STATISTICS</span>
              <div ref={lovatPickerRef} style={{ position: "relative" }}>
                <button className="stats-col-btn ts-lovat-btn" onClick={() => setLovatPickerOpen(o => !o)}>
                  ⊞ <span className="stats-col-count">{lovatCols.length}</span>
                </button>
                {lovatPickerOpen && (
                  <div className="stats-picker ts-lovat-picker">
                    <div className="stats-picker-header">Lovat Fields</div>
                    {LOVAT_GROUPS_ORDER.map(g => (
                      <div key={g} className="stats-picker-group">
                        <div className="stats-picker-group-label">{GROUP_LABELS[g]}</div>
                        {(lovatByGroup[g] ?? []).map(key => (
                          <label key={key} className="stats-picker-row">
                            <input type="checkbox" checked={lovatCols.includes(key)}
                              onChange={() => setLovatCols(p => p.includes(key) ? p.filter(k=>k!==key) : [...p,key])} />
                            <span>{COL_META[key]?.label ?? key}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {lovatRow ? (
              <div className="ts-lovat-grid">
                {lovatCols.map(key => {
                  const meta = COL_META[key];
                  if (!meta) return null;
                  const val  = lovatRow[key];
                  const fmtd = fmt(key, val);
                  return (
                    <div key={key} className="ts-lovat-cell">
                      <span className="ts-lovat-label">{meta.label}</span>
                      <span className={`ts-lovat-val ${fmtd === "—" ? "ts-lovat-na" : ""}`}>{fmtd}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ts-no-data">
                {lovatData ? `No Lovat data for team ${teamNum}` : "No Lovat CSV uploaded — go to Config"}
              </div>
            )}
          </div>

        </div>{/* end trp-body */}
      </div>
    </div>,
    document.body
  );
};

// ── RANKINGS TABLE ──
const RankingsPanel = ({ eventCode, tbaCall }) => {
  const [rankings, setRankings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const { tbaConfig } = useData();

  useEffect(() => {
    setLoading(true); setError("");
    tbaCall(`/event/${eventCode}/rankings`)
      .then(data => { setRankings(data?.rankings ?? []); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [eventCode]);

  if (loading) return <div className="panel-state loading"><span className="spin">◎</span> Loading rankings...</div>;
  if (error)   return <div className="panel-state error">✕ {error}</div>;
  if (!rankings?.length) return <div className="panel-state empty">No rankings available yet.</div>;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>RANK</th>
            <th>TEAM</th>
            <th>W / L / T</th>
            <th>MATCHES</th>
            <th>RANKING PTS</th>
            <th>RANKING SCORE</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map(r => (
            <tr
              key={r.team_key}
              className={`rk-row ${r.team_key === `frc${tbaConfig?.teamNumber}` ? "my-team-row" : ""}`}
            >
              <td className="td-rank">{r.rank}</td>
              <td className="td-team">
                {r.team_key.replace("frc","")}
              </td>
              <td className="td-record">{r.record.wins} / {r.record.losses} / {r.record.ties}</td>
              <td>{r.matches_played}</td>
              <td className="td-accent">{r.extra_stats?.[0] ?? "—"}</td>
              <td className="td-accent">{r.sort_orders?.[0]?.toFixed(2) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── MATCHES TABLE ──
const MatchesPanel = ({ eventCode, tbaCall, filterTeam }) => {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    setLoading(true); setError("");
    tbaCall(`/event/${eventCode}/matches`)
      .then(data => {
        const order = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };
        const sorted = (data ?? []).sort((a, b) =>
          (order[a.comp_level] - order[b.comp_level]) || (a.match_number - b.match_number)
        );
        setMatches(sorted); setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [eventCode]);

  if (loading) return <div className="panel-state loading"><span className="spin">◎</span> Loading matches...</div>;
  if (error)   return <div className="panel-state error">✕ {error}</div>;
  if (!matches?.length) return <div className="panel-state empty">No matches scheduled yet.</div>;

  const teamKey  = filterTeam ? `frc${filterTeam}` : null;
  const filtered = teamKey
    ? matches.filter(m => [...m.alliances.red.team_keys, ...m.alliances.blue.team_keys].includes(teamKey))
    : matches;

  if (teamKey && !filtered.length)
    return <div className="panel-state empty">No matches found for team {filterTeam}.</div>;

  const levelLabel = { qm: "Qual", ef: "EF", qf: "QF", sf: "SF", f: "Final" };

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>MATCH</th>
            <th>RED ALLIANCE</th>
            <th>BLUE ALLIANCE</th>
            <th>SCORES</th>
            <th>RESULT</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(m => {
            const redScore  = m.alliances.red.score;
            const blueScore = m.alliances.blue.score;
            const played    = redScore !== -1 && blueScore !== -1;
            const redWin    = played && redScore > blueScore;
            const blueWin   = played && blueScore > redScore;
            const redTeams  = m.alliances.red.team_keys.map(k => k.replace("frc", ""));
            const blueTeams = m.alliances.blue.team_keys.map(k => k.replace("frc", ""));
            const myTeam    = filterTeam?.toString();
            const onRed     = myTeam && redTeams.includes(myTeam);
            const onBlue    = myTeam && blueTeams.includes(myTeam);

            return (
              <tr key={m.key} className={(onRed || onBlue) ? "my-team-row" : ""}>
                <td className="td-match">{levelLabel[m.comp_level] ?? m.comp_level} {m.match_number}</td>
                <td className="td-alliance">
                  <div className="chips red-chips">
                    {redTeams.map(t => (
                      <span key={t} className={`chip chip-red ${t === myTeam ? "chip-mine" : ""}`}>{t}</span>
                    ))}
                  </div>
                </td>
                <td className="td-alliance">
                  <div className="chips blue-chips">
                    {blueTeams.map(t => (
                      <span key={t} className={`chip chip-blue ${t === myTeam ? "chip-mine" : ""}`}>{t}</span>
                    ))}
                  </div>
                </td>
                <td className="td-scores">
                  {played ? (
                    <span className="score-pair">
                      <span className={`score-val ${redWin ? "score-win" : ""}`}>{redScore}</span>
                      <span className="score-sep">–</span>
                      <span className={`score-val ${blueWin ? "score-win" : ""}`}>{blueScore}</span>
                    </span>
                  ) : "—"}
                </td>
                <td className="td-result">
                  {!played
                    ? <span className="badge badge-pending">UPCOMING</span>
                    : onRed
                      ? <span className={`badge ${redWin ? "badge-win" : redScore === blueScore ? "badge-tie" : "badge-loss"}`}>{redWin ? "WIN" : redScore === blueScore ? "TIE" : "LOSS"}</span>
                    : onBlue
                      ? <span className={`badge ${blueWin ? "badge-win" : redScore === blueScore ? "badge-tie" : "badge-loss"}`}>{blueWin ? "WIN" : redScore === blueScore ? "TIE" : "LOSS"}</span>
                      : <span className="badge badge-neutral">{redWin ? "RED" : blueWin ? "BLUE" : "TIE"}</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── PLACEHOLDER ──
const PlaceholderPanel = ({ label }) => (
  <div className="placeholder-panel">
    <span className="placeholder-icon">⬡</span>
    <p className="placeholder-title">{label}</p>
    <p className="placeholder-sub">Under construction</p>
  </div>
);

// ── PICKLIST PANEL ──
const ROLES = ["Offense", "Defense", "Feeder"];
const WATCH_OPTIONS = ["Watch Them", "Talk To Them"];
const NUM_ROWS = 24;
const PICKLIST_STORAGE_KEY = "sgw_picklist_rows";
const PL_EXPORT_KEY        = "sgw_picklist_export_cfg";

function emptyRow(i) {
  return { id: i, teamNumber: "", teamName: "", roles: [], watch: [], notes: "", crossed: false };
}

function loadPicklistRows() {
  try {
    const raw = localStorage.getItem(PICKLIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === NUM_ROWS) {
      // Back-fill `crossed` for older saves
      return parsed.map(r => ({ crossed: false, ...r }));
    }
    return null;
  } catch { return null; }
}

function savePicklistRows(rows) {
  try { localStorage.setItem(PICKLIST_STORAGE_KEY, JSON.stringify(rows)); }
  catch (e) { console.warn("Picklist save failed:", e); }
}

// ── EXPORT MODAL ──
const PL_LOVAT_GROUPS_ORDER = ["scoring","climb","defense","feed","driving"];
const PL_GROUP_LABELS = { scoring:"Scoring", climb:"Climb", defense:"Defense", feed:"Feeding", driving:"Driving" };

const ExportModal = ({ onClose, rows, tbaConfig, lovatData, pitData }) => {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(PL_EXPORT_KEY)) ?? {}; } catch { return {}; } })();

  const [exportType,  setExportType]  = useState(saved.exportType  ?? "initial");
  const [lovatCols,   setLovatCols]   = useState(saved.lovatCols   ?? []);
  const [pitCols,     setPitCols]     = useState(saved.pitCols     ?? []);
  const [lovatOpen,   setLovatOpen]   = useState(false);
  const [pitOpen,     setPitOpen]     = useState(false);
  const [busy,        setBusy]        = useState(false);
  const lovatRef = useRef(null);
  const pitRef   = useRef(null);

  useEffect(() => {
    const h = e => {
      if (lovatRef.current && !lovatRef.current.contains(e.target)) setLovatOpen(false);
      if (pitRef.current   && !pitRef.current.contains(e.target))   setPitOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PL_EXPORT_KEY, JSON.stringify({ exportType, lovatCols, pitCols })); } catch {}
  }, [exportType, lovatCols, pitCols]);

  const lovatByGroup = {};
  Object.entries(COL_META).forEach(([k, v]) => {
    if (k === "teamNumber") return;
    if (!lovatByGroup[v.group]) lovatByGroup[v.group] = [];
    lovatByGroup[v.group].push(k);
  });

  const doExport = async () => {
    setBusy(true);
    try {
      if (!window.XLSX) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const XLSX = window.XLSX;
      const eventLabel = tbaConfig?.eventCode?.toUpperCase() ?? "EVENT";

      const fmtLovat = (key, val) => {
        if (val === null || val === undefined || val === "" || parseFloat(val) === -1) return "";
        const n = parseFloat(val);
        if (key.startsWith("perc")) return isNaN(n) ? String(val) : `${n.toFixed(1)}%`;
        return isNaN(n) ? String(val) : (n % 1 === 0 ? String(n) : n.toFixed(2));
      };

      // Build dynamic extra headers
      const extraLovatHeaders = lovatCols.map(k => COL_META[k]?.label ?? k);
      const extraPitHeaders   = pitCols.map(k => PIT_FIELDS.find(f => f.key === k)?.label ?? k);

      let headers, wsData;

      if (exportType === "final") {
        // Final: Pick #, Team #, Team Name, Role(s), + optional extras
        headers = ["Pick #", "Team #", "Team Name", "Role(s)", ...extraLovatHeaders, ...extraPitHeaders];
        wsData  = [headers];
        rows.filter(r => r.teamNumber).forEach((r, i) => {
          const lovatRow = lovatData?.rows?.find(lr => String(lr.teamNumber).trim() === r.teamNumber) ?? null;
          const pitRow   = pitData?.rows?.find(pr => String(pr["Team Number"]).trim() === r.teamNumber) ?? null;
          wsData.push([
            i + 1,
            r.teamNumber,
            r.teamName,
            r.roles.join(", "),
            ...lovatCols.map(k => fmtLovat(k, lovatRow?.[k])),
            ...pitCols.map(k => {
              const val = pitRow?.[k];
              if (!val && val !== 0) return "";
              return k.includes("rating") ? String(val) : formatClimbValue ? (PIT_FIELDS.find(f=>f.key===k)?.fmt === "climb" ? formatClimbValue(String(val)) : String(val)) : String(val);
            }),
          ]);
        });
      } else {
        // Initial: full picklist with cross-off status, day2 scouting, notes + optional extras
        headers = [
          "Pick #", "Team #", "Team Name", "Role(s)",
          "2nd Day: Watch", "2nd Day: Talk To", "Notes", "Picked (crossed off)",
          ...extraLovatHeaders, ...extraPitHeaders,
        ];
        wsData = [headers];
        rows.forEach((r, i) => {
          const lovatRow = lovatData?.rows?.find(lr => String(lr.teamNumber).trim() === r.teamNumber) ?? null;
          const pitRow   = pitData?.rows?.find(pr => String(pr["Team Number"]).trim() === r.teamNumber) ?? null;
          wsData.push([
            i + 1,
            r.teamNumber,
            r.teamName,
            r.roles.join(", "),
            r.watch.includes("Watch Them") ? "Yes" : "",
            r.watch.includes("Talk To Them") ? "Yes" : "",
            r.notes,
            r.crossed ? "Yes" : "",
            ...lovatCols.map(k => fmtLovat(k, lovatRow?.[k])),
            ...pitCols.map(k => {
              const val = pitRow?.[k];
              if (!val && val !== 0) return "";
              return PIT_FIELDS.find(f=>f.key===k)?.fmt === "climb" ? formatClimbValue(String(val)) : String(val);
            }),
          ]);
        });
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      const baseWidths = exportType === "final"
        ? [7, 9, 22, 24]
        : [7, 9, 22, 24, 14, 16, 40, 16];
      ws["!cols"] = [
        ...baseWidths.map(w => ({ wch: w })),
        ...lovatCols.map(() => ({ wch: 14 })),
        ...pitCols.map(k => {
          const f = PIT_FIELDS.find(p => p.key === k);
          return { wch: f?.group === "Notes" ? 36 : 18 };
        }),
      ];

      // Style header row
      headers.forEach((_, ci) => {
        const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
        if (!ws[ref]) return;
        ws[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1A2535" } }, alignment: { horizontal: "center" } };
      });

      // Style crossed-off rows (light red fill) for initial export
      if (exportType === "initial") {
        rows.forEach((r, i) => {
          if (!r.crossed) return;
          headers.forEach((_, ci) => {
            const ref = XLSX.utils.encode_cell({ r: i + 1, c: ci });
            if (!ws[ref]) ws[ref] = { v: "" };
            ws[ref].s = { ...(ws[ref].s ?? {}), fill: { fgColor: { rgb: "3D1515" } }, font: { color: { rgb: "885555" } } };
          });
        });
      }

      const wb = XLSX.utils.book_new();
      const sheetName = exportType === "final" ? "Final Picklist" : "Initial Picklist";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `picklist_${exportType}_${eventLabel}.xlsx`);
      onClose();
    } catch(e) {
      console.error("XLSX export failed", e);
      alert("Export failed — check console.");
    }
    setBusy(false);
  };

  return (
    <div className="pl-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pl-modal pl-modal-large">
        <div className="pl-modal-header">
          <span className="pl-modal-title">EXPORT PICKLIST</span>
          <button className="pl-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Export type */}
        <div className="pl-modal-section">
          <div className="pl-modal-section-label">EXPORT TYPE</div>
          <div className="pl-export-type-row">
            {[
              { key: "initial", label: "Initial Picklist", desc: "All rows · Day 2 scouting · Notes · Crossed-off status" },
              { key: "final",   label: "Final Picklist",   desc: "Filled rows only · Team + Role · No scouting columns" },
            ].map(t => (
              <button
                key={t.key}
                className={`pl-export-type-btn ${exportType === t.key ? "pl-export-type-active" : ""}`}
                onClick={() => setExportType(t.key)}
              >
                <span className="pl-export-type-name">{t.label}</span>
                <span className="pl-export-type-desc">{t.desc}</span>
              </button>
            ))}
          </div>
          
          {/* Show what columns are included by default */}
          <div className="pl-modal-default-cols">
            <div className="pl-modal-default-label">Included columns:</div>
            <div className="pl-modal-col-preview">
              {exportType === "final" ? (
                <>
                  <span className="pl-modal-col-tag pl-modal-col-default">Pick #</span>
                  <span className="pl-modal-col-tag pl-modal-col-default">Team #</span>
                  <span className="pl-modal-col-tag pl-modal-col-default">Team Name</span>
                  <span className="pl-modal-col-tag pl-modal-col-default">Role(s)</span>
                </>
              ) : (
                <>
                  <span className="pl-modal-col-tag pl-modal-col-default">Pick #</span>
                  <span className="pl-modal-col-tag pl-modal-col-default">Team #</span>
                  <span className="pl-modal-col-tag pl-modal-col-default">Team Name</span>
                  <span className="pl-modal-col-tag pl-modal-col-default">Role(s)</span>
                  <span className="pl-modal-col-tag pl-modal-col-default">2nd Day: Watch</span>
                  <span className="pl-modal-col-tag pl-modal-col-default">2nd Day: Talk To</span>
                  <span className="pl-modal-col-tag pl-modal-col-default">Notes</span>
                  <span className="pl-modal-col-tag pl-modal-col-default">Picked (crossed off)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Extra columns */}
        <div className="pl-modal-section">
          <div className="pl-modal-section-label">ADDITIONAL COLUMNS (OPTIONAL)</div>
          <div className="pl-modal-pickers">

            {/* Lovat picker */}
            <div ref={lovatRef} style={{ position: "relative" }}>
              <button className="stats-col-btn pl-modal-picker-btn" onClick={() => setLovatOpen(o => !o)}>
                LOVAT {lovatCols.length > 0 && <span className="stats-col-count">{lovatCols.length}</span>}
              </button>
              {lovatOpen && (
                <div className="stats-picker pl-modal-drop pl-modal-drop-large">
                  <div className="stats-picker-header">Lovat Fields</div>
                  {PL_LOVAT_GROUPS_ORDER.map(g => (
                    <div key={g} className="stats-picker-group">
                      <div className="stats-picker-group-label">{PL_GROUP_LABELS[g]}</div>
                      {(lovatByGroup[g] ?? []).map(key => (
                        <label key={key} className="stats-picker-row">
                          <input type="checkbox" checked={lovatCols.includes(key)}
                            onChange={() => setLovatCols(p => p.includes(key) ? p.filter(k=>k!==key) : [...p,key])} />
                          <span>{COL_META[key]?.label ?? key}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pit picker */}
            <div ref={pitRef} style={{ position: "relative" }}>
              <button className="stats-col-btn pl-modal-picker-btn" onClick={() => setPitOpen(o => !o)}>
                PIT {pitCols.length > 0 && <span className="stats-col-count">{pitCols.length}</span>}
              </button>
              {pitOpen && (
                <div className="stats-picker pl-modal-drop pl-modal-drop-large">
                  <div className="stats-picker-header">Pit Scouting Fields</div>
                  {["Hardware","Auto","Endgame","Software","Notes"].map(grp => {
                    const fields = PIT_FIELDS.filter(f => f.group === grp);
                    if (!fields.length) return null;
                    return (
                      <div key={grp} className="stats-picker-group">
                        <div className="stats-picker-group-label">{grp}</div>
                        {fields.map(f => (
                          <label key={f.key} className="stats-picker-row">
                            <input type="checkbox" checked={pitCols.includes(f.key)}
                              onChange={() => setPitCols(p => p.includes(f.key) ? p.filter(k=>k!==f.key) : [...p,f.key])} />
                            <span>{f.label}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {(lovatCols.length > 0 || pitCols.length > 0) && (
              <button className="pl-modal-clear-extras"
                onClick={() => { setLovatCols([]); setPitCols([]); }}>
                ✕ Clear extras
              </button>
            )}
          </div>

          {(lovatCols.length > 0 || pitCols.length > 0) && (
            <div className="pl-modal-extras-section">
              <div className="pl-modal-default-label">Additional columns selected:</div>
              <div className="pl-modal-col-preview">
                {lovatCols.map(k => (
                  <span key={k} className="pl-modal-col-tag pl-modal-col-lovat">
                    {COL_META[k]?.label ?? k}
                    <button onClick={() => setLovatCols(p => p.filter(x=>x!==k))}>✕</button>
                  </span>
                ))}
                {pitCols.map(k => (
                  <span key={k} className="pl-modal-col-tag pl-modal-col-pit">
                    {PIT_FIELDS.find(f=>f.key===k)?.label ?? k}
                    <button onClick={() => setPitCols(p => p.filter(x=>x!==k))}>✕</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pl-modal-footer">
          <button className="pl-modal-cancel" onClick={onClose}>CANCEL</button>
          <button className="pl-modal-export" onClick={doExport} disabled={busy}>
            {busy ? "⏳ GENERATING..." : "⬇ EXPORT EXCEL"}
          </button>
        </div>
      </div>
    </div>
  );
};

const PicklistPanel = () => {
  const { tbaConfig, lovatData, pitData } = useData();
  const { call: tbaCall } = useTBA();

  const [rows, setRows] = useState(
    () => loadPicklistRows() ?? Array.from({ length: NUM_ROWS }, (_, i) => emptyRow(i))
  );
  const [teams, setTeams]             = useState([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [lastSaved, setLastSaved]     = useState(null);
  const [showExport, setShowExport]   = useState(false);
  const [draggedIdx, setDraggedIdx]   = useState(null);

  useEffect(() => {
    savePicklistRows(rows);
    setLastSaved(new Date().toLocaleTimeString());
  }, [rows]);

  useEffect(() => {
    if (!tbaConfig?.apiKey || !tbaConfig?.eventCode) return;
    tbaCall(`/event/${tbaConfig.eventCode}/teams/simple`)
      .then(data => {
        const sorted = (data ?? [])
          .map(t => ({ teamNumber: String(t.team_number), nickname: t.nickname ?? "" }))
          .sort((a, b) => Number(a.teamNumber) - Number(b.teamNumber));
        setTeams(sorted);
        setTeamsLoaded(true);
      })
      .catch(() => setTeamsLoaded(true));
  }, [tbaConfig?.apiKey, tbaConfig?.eventCode]);

  const updateRow = (idx, field, value) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const clearAll = () => {
    if (!window.confirm("Clear all picklist entries? This cannot be undone.")) return;
    const fresh = Array.from({ length: NUM_ROWS }, (_, i) => emptyRow(i));
    setRows(fresh);
    savePicklistRows(fresh);
  };

  const toggleRole = (idx, role) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      return { ...r, roles: r.roles.includes(role) ? r.roles.filter(x=>x!==role) : [...r.roles, role] };
    }));
  };

  const toggleWatch = (idx, opt) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      return { ...r, watch: r.watch.includes(opt) ? r.watch.filter(x=>x!==opt) : [...r.watch, opt] };
    }));
  };

  const toggleCrossed = (idx) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, crossed: !r.crossed } : r));
  };

  const handleTeamNumberChange = (idx, val) => {
    const match = teams.find(t => t.teamNumber === val.trim());
    updateRow(idx, "teamNumber", val);
    if (match) updateRow(idx, "teamName", match.nickname);
    else if (!val) updateRow(idx, "teamName", "");
  };

  // Drag and drop handlers
  const handleDragStart = (e, idx) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) return;

    setRows(prev => {
      const newRows = [...prev];
      const [draggedRow] = newRows.splice(draggedIdx, 1);
      newRows.splice(dropIdx, 0, draggedRow);
      return newRows;
    });
    setDraggedIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const noConfig = !tbaConfig?.apiKey || !tbaConfig?.eventCode;

  return (
    <div className="picklist-wrap">
      {noConfig && (
        <div className="pl-no-config">
          <span>⚡</span> No TBA config — team autofill unavailable.
          <Link to="/config" className="pl-config-link">Configure →</Link>
        </div>
      )}

      <div className="pl-table-scroll">
        <table className="pl-table">
          <thead>
            <tr>
              <th className="pl-th-drag" title="Drag to reorder">⋮⋮</th>
              <th className="pl-th-cross" title="Cross off picked teams">✕</th>
              <th className="pl-th-num">#</th>
              <th className="pl-th-team">TEAM # / NAME</th>
              <th className="pl-th-role">ROLE</th>
              <th className="pl-th-watch">2ND DAY SCOUTING</th>
              <th className="pl-th-notes">NOTES</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr 
                key={row.id} 
                className={`pl-row ${idx % 2 === 0 ? "pl-row-even" : ""} ${row.crossed ? "pl-row-crossed" : ""} ${draggedIdx === idx ? "pl-row-dragging" : ""}`}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
              >

                {/* Drag handle */}
                <td className="pl-td-drag" title="Drag to reorder">
                  <span className="pl-drag-handle">⋮⋮</span>
                </td>

                {/* Cross-off button */}
                <td className="pl-td-cross">
                  <button
                    className={`pl-cross-btn ${row.crossed ? "pl-cross-on" : ""}`}
                    onClick={() => toggleCrossed(idx)}
                    type="button"
                    title={row.crossed ? "Un-pick team" : "Mark as picked"}
                  >
                    {row.crossed ? "✕" : "·"}
                  </button>
                </td>

                {/* Pick number */}
                <td className="pl-td-num">{idx + 1}</td>

                {/* Team # + name */}
                <td className="pl-td-team">
                  <div className="pl-team-inputs">
                    <input
                      className="pl-input pl-team-num"
                      type="text"
                      value={row.teamNumber}
                      onChange={e => handleTeamNumberChange(idx, e.target.value)}
                      placeholder="####"
                      list={`teams-list-${idx}`}
                    />
                    <datalist id={`teams-list-${idx}`}>
                      {teams.map(t => (
                        <option key={t.teamNumber} value={t.teamNumber}>{t.nickname}</option>
                      ))}
                    </datalist>
                    <input
                      className="pl-input pl-team-name"
                      type="text"
                      value={row.teamName}
                      onChange={e => updateRow(idx, "teamName", e.target.value)}
                      placeholder="Team name"
                    />
                  </div>
                </td>

                {/* Role toggles */}
                <td className="pl-td-role">
                  <div className="pl-chips">
                    {ROLES.map(role => (
                      <button
                        key={role}
                        className={`pl-chip ${row.roles.includes(role) ? "pl-chip-on" : ""}`}
                        onClick={() => toggleRole(idx, role)}
                        type="button"
                      >{role}</button>
                    ))}
                  </div>
                </td>

                {/* Watch / Talk toggles */}
                <td className="pl-td-watch">
                  <div className="pl-chips">
                    {WATCH_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        className={`pl-chip ${row.watch.includes(opt) ? "pl-chip-watch-on" : ""}`}
                        onClick={() => toggleWatch(idx, opt)}
                        type="button"
                      >{opt}</button>
                    ))}
                  </div>
                </td>

                {/* Notes */}
                <td className="pl-td-notes">
                  <textarea
                    className="pl-textarea"
                    value={row.notes}
                    onChange={e => updateRow(idx, "notes", e.target.value)}
                    placeholder="Notes..."
                    rows={2}
                  />
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pl-footer">
        <div className="pl-footer-left">
          <span className="pl-footer-info">
            {rows.filter(r => r.teamNumber).length} / {NUM_ROWS} filled
            {rows.filter(r => r.crossed).length > 0 && (
              <span className="pl-footer-crossed"> · {rows.filter(r => r.crossed).length} picked</span>
            )}
          </span>
          {lastSaved && <span className="pl-saved-indicator">✓ Auto-saved {lastSaved}</span>}
        </div>
        <div className="pl-footer-right">
          <button className="pl-clear-btn" onClick={clearAll}>✕ CLEAR ALL</button>
          <button className="pl-download-btn" onClick={() => setShowExport(true)}>
            ⬇ EXPORT EXCEL
          </button>
        </div>
      </div>

      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          rows={rows}
          tbaConfig={tbaConfig}
          lovatData={lovatData}
          pitData={pitData}
        />
      )}
    </div>
  );
};


// ── STATISTICS PANEL ──

// Human-readable column labels
const COL_META = {
  teamNumber:              { label: "Team #",           group: "core",    numeric: false },
  mainRole:                { label: "Main Role",         group: "core",    numeric: false },
  secondaryRole:           { label: "Secondary Role",    group: "core",    numeric: false },
  fieldTraversal:          { label: "Traversal",         group: "core",    numeric: false },
  avgTotalPoints:          { label: "Avg Total Pts",     group: "scoring", numeric: true  },
  avgAutoPoints:           { label: "Avg Auto Pts",      group: "scoring", numeric: true  },
  avgTeleopPoints:         { label: "Avg Teleop Pts",    group: "scoring", numeric: true  },
  avgFuelPerSecond:        { label: "Fuel / Sec",        group: "scoring", numeric: true  },
  avgAccuracy:             { label: "Accuracy %",        group: "scoring", numeric: true  },
  avgVolleysPerMatch:      { label: "Volleys / Match",   group: "scoring", numeric: true  },
  avgL1StartTime:          { label: "L1 Start Time",     group: "climb",   numeric: true  },
  avgL2StartTime:          { label: "L2 Start Time",     group: "climb",   numeric: true  },
  avgL3StartTime:          { label: "L3 Start Time",     group: "climb",   numeric: true  },
  avgAutoClimbStartTime:   { label: "Auto Climb Start",  group: "climb",   numeric: true  },
  avgDriverAbility:        { label: "Driver Ability",    group: "driving", numeric: true  },
  avgContactDefenseTime:   { label: "Contact Defense",   group: "defense", numeric: true  },
  avgDefenseEffectiveness: { label: "Defense Effect.",   group: "defense", numeric: true  },
  avgCampingDefenseTime:   { label: "Camp Defense",      group: "defense", numeric: true  },
  avgTotalDefenseTime:     { label: "Total Defense",     group: "defense", numeric: true  },
  avgTimeFeeding:          { label: "Feeding Time",      group: "feed",    numeric: true  },
  avgFeedingRate:          { label: "Feeding Rate",      group: "feed",    numeric: true  },
  avgFeedsPerMatch:        { label: "Feeds / Match",     group: "feed",    numeric: true  },
  avgTotalFuelOutputted:   { label: "Total Fuel Out",    group: "feed",    numeric: true  },
  avgTotalBallsFed:        { label: "Balls Fed",         group: "feed",    numeric: true  },
  avgTotalBallThroughput:  { label: "Ball Throughput",   group: "feed",    numeric: true  },
  avgOutpostIntakes:       { label: "Outpost Intakes",   group: "feed",    numeric: true  },
  percDisrupts:            { label: "Disrupts %",        group: "defense", numeric: true  },
  percScoresWhileMoving:   { label: "Scores Moving %",   group: "scoring", numeric: true  },
  percClimbOne:            { label: "Climb L1 %",        group: "climb",   numeric: true  },
  percClimbTwo:            { label: "Climb L2 %",        group: "climb",   numeric: true  },
  percClimbThree:          { label: "Climb L3 %",        group: "climb",   numeric: true  },
  percNoClimb:             { label: "No Climb %",        group: "climb",   numeric: true  },
  percAutoClimb:           { label: "Auto Climb %",      group: "climb",   numeric: true  },
  matchesImmobile:         { label: "Immobile Matches",  group: "driving", numeric: true  },
  numMatches:              { label: "Matches Played",    group: "core",    numeric: true  },
  numReports:              { label: "Reports",           group: "core",    numeric: true  },
};

// Always-visible pinned columns (left side)
const PINNED_COLS   = ["teamNumber"];
// Default visible columns
const DEFAULT_VISIBLE = ["avgTotalPoints", "avgAutoPoints", "avgTeleopPoints"];
// All optional columns (everything except pinned)
const ALL_OPTIONAL = Object.keys(COL_META).filter(k => k !== "teamNumber");

const STATS_STORAGE_KEY = "sgw_stats_config";

function loadStatsConfig() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const StatisticsPanel = () => {
  const { lovatData } = useData();

  const saved = loadStatsConfig();
  const [visibleCols,  setVisibleCols]  = useState(saved?.visibleCols  ?? DEFAULT_VISIBLE);
  const [colOrder,     setColOrder]     = useState(saved?.colOrder      ?? DEFAULT_VISIBLE);
  const [sortCol,      setSortCol]      = useState(saved?.sortCol       ?? "avgTotalPoints");
  const [sortDir,      setSortDir]      = useState(saved?.sortDir       ?? "desc");
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [dragColKey,   setDragColKey]   = useState(null);
  const [dragOverKey,  setDragOverKey]  = useState(null);
  const pickerRef = useRef(null);

  // Persist config
  useEffect(() => {
    try { localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify({ visibleCols, colOrder, sortCol, sortDir })); }
    catch {}
  }, [visibleCols, colOrder, sortCol, sortDir]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  // Sync colOrder when visibleCols changes (add new cols to end, remove dropped)
  useEffect(() => {
    setColOrder(prev => {
      const kept = prev.filter(k => visibleCols.includes(k));
      const added = visibleCols.filter(k => !prev.includes(k));
      return [...kept, ...added];
    });
  }, [visibleCols]);

  const toggleCol = (key) => {
    setVisibleCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  // Parse and sort rows
  const rows = lovatData?.rows ?? [];
  const sorted = [...rows].sort((a, b) => {
    const meta = COL_META[sortCol];
    if (!meta) return 0;
    if (!meta.numeric) {
      const av = String(a[sortCol] ?? ""), bv = String(b[sortCol] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const av = parseFloat(a[sortCol]) || 0;
    const bv = parseFloat(b[sortCol]) || 0;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  // ── Column drag-to-reorder ──
  const onColDragStart = (e, key) => {
    setDragColKey(key);
    e.dataTransfer.effectAllowed = "move";
  };
  const onColDragOver = (e, key) => {
    e.preventDefault();
    if (key !== dragColKey) setDragOverKey(key);
  };
  const onColDrop = (e, targetKey) => {
    e.preventDefault();
    if (!dragColKey || dragColKey === targetKey) { setDragColKey(null); setDragOverKey(null); return; }
    setColOrder(prev => {
      const arr = [...prev];
      const from = arr.indexOf(dragColKey);
      const to   = arr.indexOf(targetKey);
      if (from === -1 || to === -1) return arr;
      arr.splice(from, 1);
      arr.splice(to, 0, dragColKey);
      return arr;
    });
    setDragColKey(null); setDragOverKey(null);
  };

  // Format cell values
  const fmt = (key, val) => {
    if (val === null || val === undefined || val === "") return "—";
    const meta = COL_META[key];
    if (!meta?.numeric) return String(val);
    const n = parseFloat(val);
    if (isNaN(n)) return "—";
    if (n === -1) return "—";           // Lovat uses -1 for N/A
    if (key.startsWith("perc")) return `${n.toFixed(1)}%`;
    return n % 1 === 0 ? String(n) : n.toFixed(2);
  };

  const orderedVisible = colOrder.filter(k => visibleCols.includes(k));
  const displayCols = [...PINNED_COLS, ...orderedVisible];

  // Group optional cols for picker
  const groups = {};
  ALL_OPTIONAL.forEach(key => {
    const g = COL_META[key]?.group ?? "other";
    if (!groups[g]) groups[g] = [];
    groups[g].push(key);
  });
  const GROUP_LABELS = {
    core: "General", scoring: "Scoring", climb: "Climb",
    driving: "Driving", defense: "Defense", feed: "Feeding",
  };

  if (!lovatData) {
    return (
      <div className="stats-no-data">
        <span className="stats-no-data-icon">📋</span>
        <p className="stats-no-data-title">No Lovat Data Loaded</p>
        <p className="stats-no-data-sub">Upload a Lovat CSV on the Config page to enable statistics.</p>
        <Link to="/config" className="no-config-link">GO TO CONFIG →</Link>
      </div>
    );
  }

  return (
    <div className="stats-wrap">
      {/* Toolbar */}
      <div className="stats-toolbar">
        <span className="stats-meta">
          {rows.length} teams · {lovatData.fileName ?? "Lovat CSV"}
        </span>
        <div className="stats-toolbar-right" ref={pickerRef}>
          <button className="stats-col-btn" onClick={() => setPickerOpen(o => !o)}>
            ⊞ COLUMNS <span className="stats-col-count">{orderedVisible.length}</span>
          </button>

          {pickerOpen && (
            <div className="stats-picker">
              <div className="stats-picker-header">Add / Remove Columns</div>
              {Object.entries(groups).map(([group, keys]) => (
                <div key={group} className="stats-picker-group">
                  <div className="stats-picker-group-label">{GROUP_LABELS[group] ?? group}</div>
                  {keys.map(key => (
                    <label key={key} className="stats-picker-row">
                      <input
                        type="checkbox"
                        checked={visibleCols.includes(key)}
                        onChange={() => toggleCol(key)}
                      />
                      <span>{COL_META[key]?.label ?? key}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="stats-table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              {displayCols.map(key => {
                const meta = COL_META[key];
                const isSort = sortCol === key;
                const isPinned = PINNED_COLS.includes(key);
                return (
                  <th
                    key={key}
                    className={`stats-th ${isSort ? "stats-th-sorted" : ""} ${isPinned ? "stats-th-pinned" : ""} ${dragOverKey === key ? "stats-th-drag-over" : ""}`}
                    onClick={() => handleSort(key)}
                    draggable={!isPinned}
                    onDragStart={e => !isPinned && onColDragStart(e, key)}
                    onDragOver={e => !isPinned && onColDragOver(e, key)}
                    onDrop={e => !isPinned && onColDrop(e, key)}
                    onDragLeave={() => setDragOverKey(null)}
                    title={`Sort by ${meta?.label ?? key}`}
                  >
                    <span className="stats-th-inner">
                      {!isPinned && <span className="col-grip">⠿</span>}
                      {meta?.label ?? key}
                      {isSort && <span className="sort-arrow">{sortDir === "asc" ? " ↑" : " ↓"}</span>}
                      {!isSort && <span className="sort-arrow-ghost"> ↕</span>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.teamNumber ?? i} className={`stats-row ${i % 2 === 0 ? "stats-row-even" : ""}`}>
                {displayCols.map(key => {
                  const isPinned = PINNED_COLS.includes(key);
                  const isSort = sortCol === key;
                  const val = row[key];
                  return (
                    <td
                      key={key}
                      className={`stats-td ${isPinned ? "stats-td-pinned" : ""} ${isSort ? "stats-td-sorted" : ""}`}
                    >
                      {fmt(key, val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── NO CONFIG STATE ──
const NoConfig = () => (
  <div className="no-config">
    <span className="no-config-icon">⚡</span>
    <p className="no-config-title">No Configuration Found</p>
    <p className="no-config-sub">Set up your TBA API key and event code to get started.</p>
    <Link to="/config" className="no-config-link">GO TO CONFIG →</Link>
  </div>
);

// ── ALL TABS DEFINITION (shared pool) ──
const ALL_TABS = [
  { key: "team-search",    label: "Team Search",       panel: "left"  },
  { key: "picklist",       label: "Picklist",           panel: "left"  },
  { key: "statistics",     label: "Statistics",         panel: "left"  },
  { key: "match-strategy", label: "Match Strategy",     panel: "left"  },
  { key: "data-viz",       label: "Data Visualization", panel: "left"  },
  { key: "rankings",       label: "Rankings",           panel: "right" },
  { key: "your-matches",   label: "Your Matches",       panel: "right" },
  { key: "all-matches",    label: "All Matches",        panel: "right" },
];

const LAYOUT_KEY = "sgw_dashboard_layout";

function loadLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// Merge saved layout with ALL_TABS — ensures newly added tabs are injected
// into the correct default panel even if the user already has a saved layout.
function mergeLayout(saved) {
  if (!saved) return null;
  const allKeys   = ALL_TABS.map(t => t.key);
  const present   = [...(saved.leftTabs ?? []), ...(saved.rightTabs ?? [])];
  const missing   = allKeys.filter(k => !present.includes(k));
  if (missing.length === 0) return saved;
  const leftAdd  = missing.filter(k => ALL_TABS.find(t => t.key === k)?.panel === "left");
  const rightAdd = missing.filter(k => ALL_TABS.find(t => t.key === k)?.panel === "right");
  return {
    ...saved,
    leftTabs:  [...(saved.leftTabs  ?? []), ...leftAdd],
    rightTabs: [...(saved.rightTabs ?? []), ...rightAdd],
  };
}

function saveLayout(layout) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); }
  catch (e) { console.warn("Layout save failed:", e); }
}

// ── TEAM SEARCH PANEL ──

// Pit scouting column display config (csv col key → display label + group)
// NOTE: keys must match TRIMMED header names as exported by Google Sheets CSV
const PIT_FIELDS = [
  { key: "Team Number",         label: "Team #",              group: null        },
  { key: "Team Name",           label: "Team Name",            group: null        },
  { key: "What is your Drive Train",        label: "Drive Train",          group: "Hardware"  },
  { key: "What is your Frame Perimeter?",   label: "Frame Size",           group: "Hardware"  },
  { key: "Drive Capability",                label: "Drive Capability",     group: "Hardware"  },
  { key: "Does the robot run an autonomous?", label: "Runs Auto?",         group: "Auto"      },
  { key: "If so what is the Auto pathing  (starts at x location then shots at y spot on the hub)- List details",
                                            label: "Auto Path",            group: "Auto"      },
  { key: "Where does it collect from in Auto?", label: "Auto Collect From",group: "Auto"      },
  { key: "Can the robot climb?(Auto)",      label: "Auto Climb",           group: "Auto",     fmt: "climb" },
  { key: "Can the robot climb? (end game)", label: "Endgame Climb",        group: "Endgame",  fmt: "climb" },
  { key: "Does your robot have any Automated Features?", label: "Automated Features", group: "Software" },
  { key: "What is your programming Language", label: "Programming Language", group: "Software" },
  { key: "What are some Robot Strengths? *Don't actually ask this one*",  label: "Strengths",           group: "Notes" },
  { key: "What are some Robot Weaknesses?  *Don't actually ask this one*", label: "Weaknesses",         group: "Notes" },
  { key: "Changes from Last Competition (if they haven't gone to another void the question)", label: "Changes from Last Event", group: "Notes" },
  { key: "Additional Notes",                label: "Additional Notes",     group: "Notes"     },
  { key: "Overall rating of team( For 2996 use only)", label: "Our Rating", group: "Notes"    },
];

// Format a climb value like "T1, Left, Right" → readable badges
function formatClimbValue(raw) {
  if (!raw || raw === "No") return raw;
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  // Separate level (T1/T2/T3) from positions (Left/Right/Center)
  const levels    = parts.filter(p => /^T[1-3]$/i.test(p));
  const positions = parts.filter(p => !/^T[1-3]$/i.test(p));
  const levelStr    = levels.length    ? `Level ${levels.map(l => l.toUpperCase()).join("/")}` : null;
  const positionStr = positions.length ? positions.join(" · ") : null;
  return [levelStr, positionStr].filter(Boolean).join("  —  ");
}

// Lovat fields shown on team report (subset of COL_META, user can toggle)
const LOVAT_REPORT_FIELDS = [
  "avgTotalPoints","avgAutoPoints","avgTeleopPoints",
  "avgAccuracy","avgVolleysPerMatch","avgDriverAbility",
  "avgFuelPerSecond","avgTotalBallThroughput",
  "percClimbOne","percClimbTwo","percClimbThree","percNoClimb","percAutoClimb",
  "avgContactDefenseTime","avgDefenseEffectiveness","avgTotalDefenseTime",
  "numMatches",
];

const TS_STORAGE_KEY     = "sgw_teamsearch_lovatcols";
const TS_PIT_STORAGE_KEY = "sgw_teamsearch_pitcols";

// Default pit fields shown (by key)
const DEFAULT_PIT_COLS = [
  "What is your Drive Train",
  "What is your Frame Perimeter?",
  "Drive Capability",
  "Does the robot run an autonomous?",
  "Can the robot climb?(Auto)",
  "Can the robot climb? (end game)",
  "What is your programming Language",
  "Overall rating of team( For 2996 use only)",
];

// Convert Google Drive share link → direct thumbnail URL
function drivePhotoUrl(rawUrl) {
  if (!rawUrl) return null;
  // formats: open?id=XXX  /file/d/XXX/view  /uc?id=XXX
  let id = null;
  const m1 = rawUrl.match(/[?&]id=([^&]+)/);
  const m2 = rawUrl.match(/\/file\/d\/([^/]+)/);
  if (m1) id = m1[1];
  else if (m2) id = m2[1];
  if (!id) return null;
  // Use thumbnail endpoint — works without auth for shared files
  return `https://drive.google.com/thumbnail?id=${id}&sz=w600`;
}

const TeamSearchPanel = ({ tbaCall, tbaConfig, noConfig }) => {
  const { lovatData, pitData } = useData();

  const [query,       setQuery]      = useState("");
  const [searched,    setSearched]   = useState("");   // committed team number
  const [loading,     setLoading]    = useState(false);
  const [tbaTeam,     setTbaTeam]    = useState(null); // TBA /team/frcXXXX
  const [tbaRank,     setTbaRank]    = useState(null); // from rankings endpoint
  const [tbaError,    setTbaError]   = useState("");
  const [imgError,    setImgError]   = useState(false);
  const [lovatCols,   setLovatCols]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(TS_STORAGE_KEY)) ?? LOVAT_REPORT_FIELDS; }
    catch { return LOVAT_REPORT_FIELDS; }
  });
  const [pitCols, setPitCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TS_PIT_STORAGE_KEY)) ?? DEFAULT_PIT_COLS; }
    catch { return DEFAULT_PIT_COLS; }
  });
  const [lovatPickerOpen, setLovatPickerOpen] = useState(false);
  const [pitPickerOpen,   setPitPickerOpen]   = useState(false);
  const lovatPickerRef = useRef(null);
  const pitPickerRef   = useRef(null);

  // Persist lovat column selection
  useEffect(() => {
    try { localStorage.setItem(TS_STORAGE_KEY, JSON.stringify(lovatCols)); } catch {}
  }, [lovatCols]);

  // Persist pit column selection
  useEffect(() => {
    try { localStorage.setItem(TS_PIT_STORAGE_KEY, JSON.stringify(pitCols)); } catch {}
  }, [pitCols]);

  // Close pickers on outside click
  useEffect(() => {
    const h = (e) => {
      if (lovatPickerRef.current && !lovatPickerRef.current.contains(e.target)) setLovatPickerOpen(false);
      if (pitPickerRef.current   && !pitPickerRef.current.contains(e.target))   setPitPickerOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const doSearch = () => {
    const num = query.trim().replace(/^frc/i, "");
    if (!num) return;
    setSearched(num);
    setTbaTeam(null); setTbaRank(null); setTbaError(""); setImgError(false);
    if (!tbaConfig?.apiKey) return;
    setLoading(true);
    Promise.all([
      tbaCall(`/team/frc${num}`),
      tbaConfig?.eventCode ? tbaCall(`/event/${tbaConfig.eventCode}/rankings`) : Promise.resolve(null),
    ])
      .then(([team, rankData]) => {
        setTbaTeam(team);
        if (rankData?.rankings) {
          const r = rankData.rankings.find(r => r.team_key === `frc${num}`);
          setTbaRank(r ?? null);
        }
        setLoading(false);
      })
      .catch(e => { setTbaError(e.message); setLoading(false); });
  };

  // Match pit and lovat rows
  const pitRow   = pitData?.rows?.find(r => String(r["Team Number"]).trim() === String(searched)) ?? null;
  const lovatRow = lovatData?.rows?.find(r => String(r.teamNumber).trim() === String(searched)) ?? null;

  const photoUrl = pitRow ? drivePhotoUrl(pitRow["Picture of robot(Ask first-kindly)"]) : null;

  const fmt = (key, val) => {
    if (val === null || val === undefined || val === "" || val === -1) return "—";
    const n = parseFloat(val);
    if (key.startsWith("perc")) return isNaN(n) ? String(val) : `${n.toFixed(1)}%`;
    if (!isNaN(n) && n !== 0) return n % 1 === 0 ? String(n) : n.toFixed(2);
    return String(val);
  };

  const ratingDots = (val) => {
    const n = Math.round(parseFloat(val));
    if (isNaN(n)) return "—";
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`rating-dot ${i < n ? "rating-dot-on" : ""}`}>◆</span>
    ));
  };

  // Lovat col groups for picker (reuse COL_META groups)
  const LOVAT_GROUPS_ORDER = ["scoring","climb","defense","feed","driving"];
  const GROUP_LABELS = { scoring:"Scoring", climb:"Climb", defense:"Defense", feed:"Feeding", driving:"Driving" };
  const lovatByGroup = {};
  Object.entries(COL_META).forEach(([k, v]) => {
    if (k === "teamNumber") return;
    if (!lovatByGroup[v.group]) lovatByGroup[v.group] = [];
    lovatByGroup[v.group].push(k);
  });

  const hasSearched = searched !== "";

  return (
    <div className="ts-wrap">
      {/* Search bar */}
      <div className="ts-search-bar">
        <input
          className="search-input ts-input"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doSearch()}
          placeholder="Enter team number…"
        />
        <button className="search-btn" onClick={doSearch}>SEARCH</button>
      </div>

      {!hasSearched && (
        <div className="ts-empty">
          <span className="ts-empty-icon">🔍</span>
          <p>Enter a team number to view their scouting report</p>
        </div>
      )}

      {hasSearched && (
        <div className="ts-report">

          {/* ── HEADER CARD ── */}
          <div className="ts-header-card">
            {/* Photo */}
            <div className="ts-photo-box">
              {photoUrl && !imgError ? (
                <img
                  src={photoUrl}
                  alt={`Team ${searched} robot`}
                  className="ts-photo"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="ts-photo-placeholder">
                  <span>📷</span>
                  <span>{imgError ? "Photo unavailable" : "No photo in pit data"}</span>
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="ts-identity">
              <div className="ts-team-num">
                {searched}
                {loading && <span className="spin ts-loading-spin">◎</span>}
              </div>
              <div className="ts-team-name">
                {tbaTeam?.nickname ?? pitRow?.["Team Name"] ?? "—"}
              </div>
              {tbaTeam?.city && (
                <div className="ts-team-location">
                  {tbaTeam.city}, {tbaTeam.state_prov}, {tbaTeam.country}
                </div>
              )}
              {tbaTeam?.rookie_year && (
                <div className="ts-team-rookie">Rookie Year: {tbaTeam.rookie_year}</div>
              )}
              {tbaError && <div className="ts-tba-error">TBA: {tbaError}</div>}
            </div>

            {/* TBA Rank card */}
            {tbaRank && (
              <div className="ts-rank-card">
                <div className="ts-rank-num">#{tbaRank.rank}</div>
                <div className="ts-rank-label">EVENT RANK</div>
                <div className="ts-rank-row">
                  <span className="ts-rank-val win-text">{tbaRank.record.wins}W</span>
                  <span className="ts-rank-sep">/</span>
                  <span className="ts-rank-val loss-text">{tbaRank.record.losses}L</span>
                  <span className="ts-rank-sep">/</span>
                  <span className="ts-rank-val">{tbaRank.record.ties}T</span>
                </div>
                <div className="ts-rank-meta">
                  <span>RP: {tbaRank.extra_stats?.[0] ?? "—"}</span>
                  <span>RS: {tbaRank.sort_orders?.[0]?.toFixed(2) ?? "—"}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── PIT SCOUTING ── */}
          <div className="ts-section">
            <div className="ts-section-header">
              <span className="ts-section-title">▸ PIT SCOUTING</span>
              <div ref={pitPickerRef} style={{ position: "relative" }}>
                <button className="stats-col-btn ts-lovat-btn" onClick={() => setPitPickerOpen(o => !o)}>
                  ⊞ <span className="stats-col-count">{pitCols.length}</span>
                </button>
                {pitPickerOpen && (
                  <div className="stats-picker ts-lovat-picker">
                    <div className="stats-picker-header">Pit Scouting Fields</div>
                    {["Hardware","Auto","Endgame","Software","Notes"].map(grp => {
                      const fields = PIT_FIELDS.filter(f => f.group === grp);
                      if (!fields.length) return null;
                      return (
                        <div key={grp} className="stats-picker-group">
                          <div className="stats-picker-group-label">{grp}</div>
                          {fields.map(f => (
                            <label key={f.key} className="stats-picker-row">
                              <input type="checkbox"
                                checked={pitCols.includes(f.key)}
                                onChange={() => setPitCols(p => p.includes(f.key) ? p.filter(k => k !== f.key) : [...p, f.key])}
                              />
                              <span>{f.label}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {pitRow ? (
              <div className="ts-pit-grid">
                {PIT_FIELDS.filter(f => pitCols.includes(f.key)).map(f => {
                  const val = pitRow[f.key];
                  if (!val && val !== 0) return null;
                  const isRating = f.key.includes("rating");
                  const display  = f.fmt === "climb" ? formatClimbValue(String(val))
                                 : isRating          ? ratingDots(val)
                                 : String(val);
                  return (
                    <div key={f.key} className={`ts-pit-field ${f.group === "Notes" ? "ts-pit-field-wide" : ""}`}>
                      <span className="ts-pit-label">{f.label}</span>
                      <span className="ts-pit-value">{display}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ts-no-data">No pit scouting data for team {searched}</div>
            )}
          </div>

          {/* ── LOVAT STATS ── */}
          <div className="ts-section">
            <div className="ts-section-header">
              <span className="ts-section-title">▸ LOVAT STATISTICS</span>
              <div ref={lovatPickerRef} style={{ position: "relative" }}>
                <button className="stats-col-btn ts-lovat-btn" onClick={() => setLovatPickerOpen(o => !o)}>
                  ⊞ <span className="stats-col-count">{lovatCols.length}</span>
                </button>
                {lovatPickerOpen && (
                  <div className="stats-picker ts-lovat-picker">
                    <div className="stats-picker-header">Lovat Fields</div>
                    {LOVAT_GROUPS_ORDER.map(g => (
                      <div key={g} className="stats-picker-group">
                        <div className="stats-picker-group-label">{GROUP_LABELS[g]}</div>
                        {(lovatByGroup[g] ?? []).map(key => (
                          <label key={key} className="stats-picker-row">
                            <input type="checkbox" checked={lovatCols.includes(key)}
                              onChange={() => setLovatCols(p => p.includes(key) ? p.filter(k=>k!==key) : [...p,key])} />
                            <span>{COL_META[key]?.label ?? key}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {lovatRow ? (
              <div className="ts-lovat-grid">
                {lovatCols.map(key => {
                  const meta = COL_META[key];
                  if (!meta) return null;
                  const val = lovatRow[key];
                  const fmtd = fmt(key, val);
                  return (
                    <div key={key} className="ts-lovat-cell">
                      <span className="ts-lovat-label">{meta.label}</span>
                      <span className={`ts-lovat-val ${fmtd === "—" ? "ts-lovat-na" : ""}`}>{fmtd}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ts-no-data">
                {lovatData ? `No Lovat data for team ${searched}` : "No Lovat CSV uploaded — go to Config"}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

// ── MATCH STRATEGY PANEL ──

const MS_STORAGE_KEY      = "sgw_matchstrat_config";
const MS_DEFAULT_LOVAT    = ["avgTotalPoints","avgAutoPoints","avgTeleopPoints","avgAccuracy","avgDriverAbility","percClimbOne","percClimbTwo","percClimbThree","avgDefenseEffectiveness"];
const MS_DEFAULT_PIT = ["What is your Drive Train","Drive Capability","Can the robot climb? (end game)","Overall rating of team( For 2996 use only)"];

function loadMsConfig() {
  try { return JSON.parse(localStorage.getItem(MS_STORAGE_KEY)) ?? null; } catch { return null; }
}

// Mini team card used inside a match strategy alliance slot
const MsTeamCard = ({ teamNum, label, alliance, lovatData, pitData, lovatCols, pitCols, tbaCall, tbaConfig }) => {
  const [tbaRank, setTbaRank] = useState(null);
  const [tbaTeam, setTbaTeam] = useState(null);

  useEffect(() => {
    if (!teamNum || !tbaConfig?.apiKey) return;
    // Fetch team nickname from TBA
    tbaCall(`/team/frc${teamNum}/simple`)
      .then(data => setTbaTeam(data ?? null))
      .catch(() => {});
    // Fetch event ranking
    if (!tbaConfig?.eventCode) return;
    tbaCall(`/event/${tbaConfig.eventCode}/rankings`)
      .then(data => {
        const r = (data?.rankings ?? []).find(r => r.team_key === `frc${teamNum}`);
        setTbaRank(r ?? null);
      })
      .catch(() => {});
  }, [teamNum, tbaConfig?.apiKey, tbaConfig?.eventCode]);

  const pitRow   = pitData?.rows?.find(r => String(r["Team Number"]).trim() === String(teamNum)) ?? null;
  const lovatRow = lovatData?.rows?.find(r => String(r.teamNumber).trim() === String(teamNum)) ?? null;

  const teamName = tbaTeam?.nickname ?? null;

  const fmtLovat = (key, val) => {
    if (val === null || val === undefined || val === "" || parseFloat(val) === -1) return "—";
    const n = parseFloat(val);
    if (key.startsWith("perc")) return isNaN(n) ? String(val) : `${n.toFixed(1)}%`;
    return isNaN(n) ? String(val) : (n % 1 === 0 ? String(n) : n.toFixed(2));
  };

  const ratingDots = (val) => {
    const n = Math.round(parseFloat(val));
    if (isNaN(n)) return "—";
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`rating-dot ${i < n ? "rating-dot-on" : ""}`}>◆</span>
    ));
  };

  if (!teamNum) {
    return (
      <div className={`ms-team-card ms-card-empty ms-card-${alliance}`}>
        <span className="ms-card-empty-label">{label}</span>
      </div>
    );
  }

  return (
    <div className={`ms-team-card ms-card-${alliance}`}>
      {/* Card header */}
      <div className="ms-card-header">
        <div className="ms-card-num">{teamNum}</div>
        <div className="ms-card-meta">
          {teamName && <span className="ms-card-name">{teamName}</span>}
          {tbaRank && (
            <span className="ms-card-rank">
              Rank #{tbaRank.rank} · {tbaRank.record.wins}W/{tbaRank.record.losses}L
            </span>
          )}
        </div>
        <div className="ms-card-role-badge">{label}</div>
      </div>

      {/* Pit stats */}
      {pitCols.length > 0 && (
        <div className="ms-card-section">
          <div className="ms-card-section-label">PIT</div>
          <div className="ms-card-pit-row">
            {PIT_FIELDS.filter(f => pitCols.includes(f.key)).map(f => {
              const val = pitRow?.[f.key];
              if (!val && val !== 0) return null;
              const isRating = f.key.includes("rating");
              const display  = f.fmt === "climb" ? formatClimbValue(String(val))
                             : isRating          ? ratingDots(val)
                             : String(val);
              return (
                <div key={f.key} className="ms-card-stat">
                  <span className="ms-card-stat-label">{f.label}</span>
                  <span className="ms-card-stat-val">{display}</span>
                </div>
              );
            })}
            {!pitRow && <span className="ms-no-data">No pit data</span>}
          </div>
        </div>
      )}

      {/* Lovat stats */}
      {lovatCols.length > 0 && (
        <div className="ms-card-section">
          <div className="ms-card-section-label">LOVAT</div>
          <div className="ms-card-lovat-row">
            {lovatCols.map(key => {
              const meta = COL_META[key];
              if (!meta) return null;
              const val  = lovatRow?.[key];
              const fmtd = fmtLovat(key, val);
              return (
                <div key={key} className="ms-card-lovat-stat">
                  <span className="ms-card-stat-label">{meta.label}</span>
                  <span className={`ms-card-lovat-val ${fmtd === "—" ? "ms-na" : ""}`}>{fmtd}</span>
                </div>
              );
            })}
            {!lovatRow && <span className="ms-no-data">No Lovat data</span>}
          </div>
        </div>
      )}
    </div>
  );
};

const MatchStrategyPanel = ({ tbaCall, tbaConfig, noConfig }) => {
  const { lovatData, pitData } = useData();

  const saved = loadMsConfig();

  // mode: "next" | "prev" | "manual"
  const [mode, setMode]           = useState(saved?.mode ?? "next");
  const [manualTeams, setManualTeams] = useState(saved?.manualTeams ?? {
    red1: "", red2: "", red3: "", blue1: "", blue2: "", blue3: "",
  });
  const [lovatCols, setLovatCols] = useState(saved?.lovatCols ?? MS_DEFAULT_LOVAT);
  const [pitCols,   setPitCols]   = useState(saved?.pitCols   ?? MS_DEFAULT_PIT);
  const [lovatPickerOpen, setLovatPickerOpen] = useState(false);
  const [pitPickerOpen,   setPitPickerOpen]   = useState(false);
  const [matches,  setMatches]    = useState(null);
  const [matchErr, setMatchErr]   = useState("");
  const lovatPickerRef = useRef(null);
  const pitPickerRef   = useRef(null);
  const [prevMatchIdx, setPrevMatchIdx] = useState(0);

  // Persist config
  useEffect(() => {
    try { localStorage.setItem(MS_STORAGE_KEY, JSON.stringify({ mode, manualTeams, lovatCols, pitCols })); } catch {}
  }, [mode, manualTeams, lovatCols, pitCols]);

  // Close pickers on outside click
  useEffect(() => {
    const h = (e) => {
      if (lovatPickerRef.current && !lovatPickerRef.current.contains(e.target)) setLovatPickerOpen(false);
      if (pitPickerRef.current   && !pitPickerRef.current.contains(e.target))   setPitPickerOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Load matches from TBA
  useEffect(() => {
    if (noConfig || !tbaConfig?.apiKey || !tbaConfig?.eventCode) return;
    tbaCall(`/event/${tbaConfig.eventCode}/matches`)
      .then(data => {
        const order = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };
        const sorted = (data ?? []).sort((a, b) =>
          (order[a.comp_level] - order[b.comp_level]) || (a.match_number - b.match_number)
        );
        setMatches(sorted);
      })
      .catch(e => setMatchErr(e.message));
  }, [tbaConfig?.apiKey, tbaConfig?.eventCode]);

  const myTeamKey = tbaConfig?.teamNumber ? `frc${tbaConfig.teamNumber}` : null;
  const myMatches = matches?.filter(m =>
    myTeamKey && [...m.alliances.red.team_keys, ...m.alliances.blue.team_keys].includes(myTeamKey)
  ) ?? [];

  // Find next unplayed / most recent played match
  const nextMatch = myMatches.find(m => m.alliances.red.score === -1) ?? null;
  const playedMatches = myMatches.filter(m => m.alliances.red.score !== -1);
  const prevMatch = playedMatches[playedMatches.length - 1 - prevMatchIdx] ?? null;

  const activeMatch = mode === "next" ? nextMatch : mode === "prev" ? prevMatch : null;

  // Extract alliance teams from a TBA match object
  const teamsFromMatch = (match) => {
    if (!match) return null;
    const reds  = match.alliances.red.team_keys.map(k => k.replace("frc",""));
    const blues = match.alliances.blue.team_keys.map(k => k.replace("frc",""));
    // determine our alliance
    const weAreRed = myTeamKey && match.alliances.red.team_keys.includes(myTeamKey);
    if (weAreRed) {
      return {
        ourAlliance: "red",
        ally1: reds[0] ?? "", ally2: reds[1] ?? "", ally3: reds[2] ?? "",
        opp1:  blues[0] ?? "", opp2: blues[1] ?? "", opp3: blues[2] ?? "",
        matchLabel: levelLabel(match),
      };
    } else {
      return {
        ourAlliance: "blue",
        ally1: blues[0] ?? "", ally2: blues[1] ?? "", ally3: blues[2] ?? "",
        opp1:  reds[0] ?? "", opp2: reds[1] ?? "", opp3: reds[2] ?? "",
        matchLabel: levelLabel(match),
      };
    }
  };

  const levelLabel = (m) => {
    const map = { qm: "Qual", ef: "EF", qf: "QF", sf: "SF", f: "Final" };
    return `${map[m.comp_level] ?? m.comp_level} ${m.match_number}`;
  };

  const updateManual = (slot, val) => setManualTeams(p => ({ ...p, [slot]: val }));

  // Determine the teams to show
  let displayTeams = null;
  let matchLabel   = null;
  if (mode === "manual") {
    displayTeams = {
      ourAlliance: "red",
      ally1: manualTeams.red1, ally2: manualTeams.red2, ally3: manualTeams.red3,
      opp1:  manualTeams.blue1, opp2: manualTeams.blue2, opp3: manualTeams.blue3,
      matchLabel: "Manual Entry",
    };
    matchLabel = "Manual Entry";
  } else if (activeMatch) {
    displayTeams = teamsFromMatch(activeMatch);
    matchLabel   = displayTeams?.matchLabel;
  }

  const LOVAT_GROUPS_ORDER = ["scoring","climb","defense","feed","driving"];
  const GL = { scoring:"Scoring", climb:"Climb", defense:"Defense", feed:"Feeding", driving:"Driving" };
  const lovatByGroup = {};
  Object.entries(COL_META).forEach(([k, v]) => {
    if (k === "teamNumber") return;
    if (!lovatByGroup[v.group]) lovatByGroup[v.group] = [];
    lovatByGroup[v.group].push(k);
  });

  const sharedProps = { lovatData, pitData, lovatCols, pitCols, tbaCall, tbaConfig };

  return (
    <div className="ms-wrap">

      {/* ── TOOLBAR ── */}
      <div className="ms-toolbar">
        {/* Mode selector */}
        <div className="ms-mode-tabs">
          {[
            { key: "next",   label: "Next Match"     },
            { key: "prev",   label: "Previous Match" },
            { key: "manual", label: "Manual"         },
          ].map(m => (
            <button
              key={m.key}
              className={`ms-mode-btn ${mode === m.key ? "ms-mode-active" : ""}`}
              onClick={() => setMode(m.key)}
            >{m.label}</button>
          ))}
        </div>

        {/* Prev match navigation */}
        {mode === "prev" && playedMatches.length > 1 && (
          <div className="ms-prev-nav">
            <button className="ms-nav-btn" onClick={() => setPrevMatchIdx(i => Math.min(i+1, playedMatches.length-1))} disabled={prevMatchIdx >= playedMatches.length-1}>◀</button>
            <span className="ms-nav-label">{prevMatch ? levelLabel(prevMatch) : "—"}</span>
            <button className="ms-nav-btn" onClick={() => setPrevMatchIdx(i => Math.max(i-1, 0))} disabled={prevMatchIdx === 0}>▶</button>
          </div>
        )}

        <div className="ms-toolbar-right">
          {/* Pit picker */}
          <div ref={pitPickerRef} style={{ position: "relative" }}>
            <button className="stats-col-btn ms-picker-btn" onClick={() => setPitPickerOpen(o => !o)}>
              PIT <span className="stats-col-count">{pitCols.length}</span>
            </button>
            {pitPickerOpen && (
              <div className="stats-picker ms-picker-drop">
                <div className="stats-picker-header">Pit Fields</div>
                {["Hardware","Auto","Endgame","Software","Notes"].map(grp => {
                  const fields = PIT_FIELDS.filter(f => f.group === grp);
                  if (!fields.length) return null;
                  return (
                    <div key={grp} className="stats-picker-group">
                      <div className="stats-picker-group-label">{grp}</div>
                      {fields.map(f => (
                        <label key={f.key} className="stats-picker-row">
                          <input type="checkbox" checked={pitCols.includes(f.key)}
                            onChange={() => setPitCols(p => p.includes(f.key) ? p.filter(k=>k!==f.key) : [...p,f.key])} />
                          <span>{f.label}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lovat picker */}
          <div ref={lovatPickerRef} style={{ position: "relative" }}>
            <button className="stats-col-btn ms-picker-btn" onClick={() => setLovatPickerOpen(o => !o)}>
              LOVAT <span className="stats-col-count">{lovatCols.length}</span>
            </button>
            {lovatPickerOpen && (
              <div className="stats-picker ms-picker-drop">
                <div className="stats-picker-header">Lovat Fields</div>
                {LOVAT_GROUPS_ORDER.map(g => (
                  <div key={g} className="stats-picker-group">
                    <div className="stats-picker-group-label">{GL[g]}</div>
                    {(lovatByGroup[g] ?? []).map(key => (
                      <label key={key} className="stats-picker-row">
                        <input type="checkbox" checked={lovatCols.includes(key)}
                          onChange={() => setLovatCols(p => p.includes(key) ? p.filter(k=>k!==key) : [...p,key])} />
                        <span>{COL_META[key]?.label ?? key}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MANUAL ENTRY INPUTS ── */}
      {mode === "manual" && (
        <div className="ms-manual-inputs">
          <div className="ms-manual-alliance ms-manual-red">
            <span className="ms-manual-label">RED ALLIANCE</span>
            {["red1","red2","red3"].map((slot, i) => (
              <input key={slot} className="ms-manual-input ms-manual-input-red"
                placeholder={`R${i+1} Team #`} value={manualTeams[slot]}
                onChange={e => updateManual(slot, e.target.value)} />
            ))}
          </div>
          <div className="ms-vs-divider">VS</div>
          <div className="ms-manual-alliance ms-manual-blue">
            <span className="ms-manual-label">BLUE ALLIANCE</span>
            {["blue1","blue2","blue3"].map((slot, i) => (
              <input key={slot} className="ms-manual-input ms-manual-input-blue"
                placeholder={`B${i+1} Team #`} value={manualTeams[slot]}
                onChange={e => updateManual(slot, e.target.value)} />
            ))}
          </div>
        </div>
      )}

      {/* ── NO MATCH STATE ── */}
      {!displayTeams && (mode === "next" || mode === "prev") && (
        <div className="ms-empty">
          <span className="ms-empty-icon">⚡</span>
          {noConfig
            ? <p>Configure TBA to enable match lookup</p>
            : matchErr
              ? <p>Error: {matchErr}</p>
              : mode === "next"
                ? <p>No upcoming matches found for team {tbaConfig?.teamNumber}</p>
                : <p>No played matches found</p>
          }
        </div>
      )}

      {/* ── MATCH BODY ── */}
      {displayTeams && (
        <div className="ms-body">
          {/* Match label bar */}
          {matchLabel && (
            <div className="ms-match-banner">
              <span className="ms-match-label">{matchLabel}</span>
              {activeMatch && (
                <span className="ms-match-time">
                  {activeMatch.alliances.red.score !== -1
                    ? `Final: ${activeMatch.alliances.red.score} – ${activeMatch.alliances.blue.score}`
                    : "Upcoming"}
                </span>
              )}
            </div>
          )}

          {/* Alliance columns */}
          <div className="ms-alliances">
            {/* Our alliance */}
            <div className={`ms-alliance-col ms-alliance-${displayTeams.ourAlliance}`}>
              <div className="ms-alliance-header">
                OUR ALLIANCE · {displayTeams.ourAlliance.toUpperCase()}
              </div>
              {[displayTeams.ally1, displayTeams.ally2, displayTeams.ally3].map((tn, i) => (
                <MsTeamCard key={i} teamNum={tn} label={`${displayTeams.ourAlliance.toUpperCase()} ${i+1}`}
                  alliance={displayTeams.ourAlliance} {...sharedProps} />
              ))}
            </div>

            <div className="ms-vs-col">VS</div>

            {/* Opponents */}
            <div className={`ms-alliance-col ms-alliance-${displayTeams.ourAlliance === "red" ? "blue" : "red"}`}>
              <div className="ms-alliance-header">
                OPPONENTS · {(displayTeams.ourAlliance === "red" ? "BLUE" : "RED")}
              </div>
              {[displayTeams.opp1, displayTeams.opp2, displayTeams.opp3].map((tn, i) => (
                <MsTeamCard key={i} teamNum={tn} label={`OPP ${i+1}`}
                  alliance={displayTeams.ourAlliance === "red" ? "blue" : "red"} {...sharedProps} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── DATA VISUALIZATION PANEL ──

const DV_STORAGE_KEY = "sgw_dataviz_config";
const DV_NUMERIC_KEYS = Object.entries(COL_META)
  .filter(([, v]) => v.numeric)
  .map(([k]) => k);

const DV_GROUPS_ORDER = ["scoring","climb","defense","feed","driving","core"];
const DV_GROUP_LABELS = { scoring:"Scoring", climb:"Climb", defense:"Defense", feed:"Feeding", driving:"Driving", core:"General" };

const CHART_TYPES = [
  { key: "bar",       label: "Bar Chart",    icon: "▦" },
  { key: "scatter",   label: "Scatter Plot", icon: "⁙" },
];

// Recharts color palette
const DV_COLORS = [
  "#ffcc00","#ff4444","#44aaff","#44ff88","#ff8844",
  "#cc44ff","#44ffee","#ffee44","#ff44aa","#aaffaa",
];

// ── Field Multi-Select Dropdown ──
const DvFieldPicker = ({ label, selected, onChange, max, groupsOrder, groupLabels }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const byGroup = {};
  DV_NUMERIC_KEYS.forEach(k => {
    const g = COL_META[k]?.group ?? "other";
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(k);
  });

  const toggle = key => {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, key]);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="dv-field-btn" onClick={() => setOpen(o => !o)}>
        {label}
        {selected.length > 0 && <span className="dv-field-count">{selected.length}</span>}
        <span className="dv-field-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="dv-field-drop">
          <div className="dv-field-drop-header">
            {label}{max ? ` (max ${max})` : ""}
            {selected.length > 0 && (
              <button className="dv-field-clear" onClick={() => onChange([])}>Clear</button>
            )}
          </div>
          {(groupsOrder ?? DV_GROUPS_ORDER).map(g => {
            const keys = byGroup[g];
            if (!keys?.length) return null;
            return (
              <div key={g} className="stats-picker-group">
                <div className="stats-picker-group-label">{(groupLabels ?? DV_GROUP_LABELS)[g]}</div>
                {keys.map(k => {
                  const isOn = selected.includes(k);
                  const blocked = max && !isOn && selected.length >= max;
                  return (
                    <label key={k} className={`stats-picker-row ${blocked ? "dv-row-blocked" : ""}`}>
                      <input type="checkbox" checked={isOn} disabled={blocked}
                        onChange={() => toggle(k)} />
                      <span>{COL_META[k]?.label ?? k}</span>
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Team Filter Picker ──
const DvTeamPicker = ({ teams, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = teams.filter(t =>
    !search || t.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTeam = t => onChange(selected.includes(t) ? selected.filter(x=>x!==t) : [...selected, t]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="dv-field-btn" onClick={() => setOpen(o => !o)}>
        Teams
        <span className="dv-field-count">{selected.length === 0 ? "All" : selected.length}</span>
        <span className="dv-field-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="dv-field-drop dv-team-drop">
          <div className="dv-field-drop-header">
            Filter Teams
            {selected.length > 0 && (
              <button className="dv-field-clear" onClick={() => onChange([])}>All</button>
            )}
          </div>
          <input
            className="dv-team-search"
            placeholder="Search team #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="dv-team-list">
            {filtered.map(t => (
              <label key={t} className="stats-picker-row">
                <input type="checkbox" checked={selected.includes(t)}
                  onChange={() => toggleTeam(t)} />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── CHART RENDERER ──
// All Recharts rendering isolated here; re-renders only when data/config changes
const DvChart = ({ chartType, xField, yFields, colorField, data, allTeams }) => {
  if (!data?.length) return <div className="dv-chart-empty">No data to display</div>;

  const fmtVal = v => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n < 0 ? 0 : parseFloat(n.toFixed(2));
  };

  const tooltipStyle = {
    background: "#0d1520", border: "1px solid rgba(255,204,0,0.25)",
    fontFamily: "'Share Tech Mono', monospace", fontSize: 14,
    color: "#e8e8e4",
  };
  const axisStyle = { fontFamily: "'Share Tech Mono', monospace", fontSize: 14, fill: "rgba(232,232,228,0.7)" };
  const legendStyle = { fontFamily: "'Share Tech Mono', monospace", fontSize: 14, color: "rgba(232,232,228,0.7)" };
  const gridStyle = { stroke: "rgba(255,204,0,0.07)" };

  // ── BAR CHART ──
  if (chartType === "bar") {
    const sorted = [...data].sort((a, b) => fmtVal(b[yFields[0]]) - fmtVal(a[yFields[0]]));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="teamNumber" tick={{ ...axisStyle, fontSize: 13 }} angle={-45} textAnchor="end" interval={0} height={80} />
          <YAxis tick={axisStyle} width={60} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,204,0,0.04)" }} />
          <Legend wrapperStyle={legendStyle} iconSize={16} />
          {yFields.map((f, i) => (
            <Bar key={f} dataKey={f} name={COL_META[f]?.label ?? f} fill={DV_COLORS[i % DV_COLORS.length]}
              radius={[4,4,0,0]} maxBarSize={50} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── SCATTER PLOT ──
  if (chartType === "scatter") {
    const xKey = xField ?? yFields[0];
    const yKey = yFields[1] ?? yFields[0];
    const scatterData = data.map(r => ({
      x: fmtVal(r[xKey]),
      y: fmtVal(r[yKey]),
      name: r.teamNumber,
    }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis type="number" dataKey="x" name={COL_META[xKey]?.label ?? xKey} tick={axisStyle} width={60}
            label={{ value: COL_META[xKey]?.label ?? xKey, position: "insideBottom", offset: -15, fill: "rgba(255,204,0,0.6)", fontSize: 14, fontFamily: "'Share Tech Mono', monospace" }} />
          <YAxis type="number" dataKey="y" name={COL_META[yKey]?.label ?? yKey} tick={axisStyle} width={60} />
          <Tooltip
            contentStyle={tooltipStyle}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload;
              return (
                <div style={{ ...tooltipStyle, padding: "10px 14px" }}>
                  <div style={{ color: "#ffcc00", marginBottom: 6, fontSize: 15, fontWeight: "bold" }}>Team {p.name}</div>
                  <div style={{ fontSize: 13 }}>{COL_META[xKey]?.label ?? xKey}: {p.x}</div>
                  <div style={{ fontSize: 13 }}>{COL_META[yKey]?.label ?? yKey}: {p.y}</div>
                </div>
              );
            }}
          />
          <Scatter data={scatterData} fill="#ffcc00" fillOpacity={0.8} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  return <div className="dv-chart-empty">Unknown chart type</div>;
};

// ── MAIN PANEL ──
const DataVizPanel = () => {
  const { lovatData } = useData();

  const saved = (() => { try { return JSON.parse(localStorage.getItem(DV_STORAGE_KEY)) ?? {}; } catch { return {}; } })();

  const [chartType,     setChartType]     = useState(saved.chartType     ?? "bar");
  const [yFields,       setYFields]       = useState(saved.yFields       ?? ["avgTotalPoints"]);
  const [xField,        setXField]        = useState(saved.xField        ?? "avgAutoPoints");
  const [teamFilter,    setTeamFilter]    = useState(saved.teamFilter    ?? []);
  const [sortBy,        setSortBy]        = useState(saved.sortBy        ?? yFields[0] ?? "avgTotalPoints");

  // Persist config
  useEffect(() => {
    try { localStorage.setItem(DV_STORAGE_KEY, JSON.stringify({ chartType, yFields, xField, teamFilter, sortBy })); } catch {}
  }, [chartType, yFields, xField, teamFilter, sortBy]);

  // Sync sortBy when yFields change
  useEffect(() => {
    if (yFields.length && !yFields.includes(sortBy)) setSortBy(yFields[0]);
  }, [yFields]);

  if (!lovatData) return (
    <div className="dv-empty">
      <span className="dv-empty-icon">📊</span>
      <p>No Lovat data uploaded.</p>
      <Link to="/config" className="no-config-link">GO TO CONFIG →</Link>
    </div>
  );

  const allTeamNums = [...new Set(lovatData.rows.map(r => String(r.teamNumber).trim()))].sort((a,b) => Number(a)-Number(b));

  // Build filtered + processed dataset
  const chartData = lovatData.rows
    .filter(r => teamFilter.length === 0 || teamFilter.includes(String(r.teamNumber).trim()))
    .map(r => {
      const entry = { teamNumber: String(r.teamNumber).trim() };
      DV_NUMERIC_KEYS.forEach(k => {
        const v = parseFloat(r[k]);
        entry[k] = isNaN(v) || v < 0 ? null : parseFloat(v.toFixed(2));
      });
      return entry;
    })
    .filter(r => r.teamNumber);

  const isScatter   = chartType === "scatter";
  const needsTwo    = isScatter;

  // For scatter: x is separate; for others y contains all fields
  const activeYFields = yFields;

  const canRender = activeYFields.length > 0 &&
    (!needsTwo || (activeYFields.length >= 1 && xField)) &&
    chartData.length > 0;

  return (
    <div className="dv-wrap">

      {/* ── TOOLBAR ── */}
      <div className="dv-toolbar">
        {/* Chart type tabs */}
        <div className="dv-type-tabs">
          {CHART_TYPES.map(ct => (
            <button
              key={ct.key}
              className={`dv-type-btn ${chartType === ct.key ? "dv-type-active" : ""}`}
              onClick={() => setChartType(ct.key)}
              title={ct.label}
            >
              <span className="dv-type-icon">{ct.icon}</span>
              <span className="dv-type-label">{ct.label}</span>
            </button>
          ))}
        </div>

        <div className="dv-toolbar-divider" />

        {/* Field selectors */}
        <div className="dv-controls">
          {isScatter ? (
            <>
              <div className="dv-control-group">
                <span className="dv-control-label">X AXIS</span>
                <DvFieldPicker
                  label={COL_META[xField]?.label ?? "Pick field"}
                  selected={[xField]}
                  onChange={arr => setXField(arr[arr.length - 1] ?? xField)}
                  max={1}
                />
              </div>
              <div className="dv-control-group">
                <span className="dv-control-label">Y AXIS</span>
                <DvFieldPicker
                  label={yFields.length ? COL_META[yFields[0]]?.label ?? "Pick field" : "Pick field"}
                  selected={yFields.slice(0,1)}
                  onChange={arr => setYFields(arr.slice(0,1))}
                  max={1}
                />
              </div>
            </>
          ) : (
            <div className="dv-control-group">
              <span className="dv-control-label">FIELDS</span>
              <DvFieldPicker
                label={yFields.length > 0
                  ? yFields.length === 1 ? (COL_META[yFields[0]]?.label ?? "1 field") : `${yFields.length} fields`
                  : "Pick fields"}
                selected={yFields}
                onChange={arr => setYFields(arr)}
              />
            </div>
          )}

          {/* Team filter */}
          <div className="dv-control-group">
            <span className="dv-control-label">TEAMS</span>
            <DvTeamPicker
              teams={allTeamNums}
              selected={teamFilter}
              onChange={setTeamFilter}
            />
          </div>

          {/* Sort (bar/line only) */}
          {(chartType === "bar" || chartType === "line") && yFields.length > 1 && (
            <div className="dv-control-group">
              <span className="dv-control-label">SORT BY</span>
              <select className="dv-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                {yFields.map(f => (
                  <option key={f} value={f}>{COL_META[f]?.label ?? f}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── ACTIVE FIELDS PREVIEW ── */}
      {(yFields.length > 0 || isScatter) && (
        <div className="dv-fields-bar">
          {isScatter && (
            <>
              <span className="dv-field-tag dv-field-x">
                X: {COL_META[xField]?.label ?? xField}
              </span>
              <span className="dv-axis-sep">↔</span>
              {yFields[0] && (
                <span className="dv-field-tag dv-field-y">
                  Y: {COL_META[yFields[0]]?.label ?? yFields[0]}
                </span>
              )}
            </>
          )}
          {!isScatter && yFields.map((f, i) => (
            <span key={f} className="dv-field-tag" style={{ borderColor: `${DV_COLORS[i % DV_COLORS.length]}55`, color: DV_COLORS[i % DV_COLORS.length] }}>
              {COL_META[f]?.label ?? f}
              <button className="dv-field-tag-remove" onClick={() => setYFields(p => p.filter(k => k !== f))}>✕</button>
            </span>
          ))}
          {teamFilter.length > 0 && (
            <span className="dv-filter-badge">{teamFilter.length} teams filtered</span>
          )}
        </div>
      )}

      {/* ── CHART AREA ── */}
      <div className="dv-chart-area">
        {!canRender && (
          <div className="dv-chart-empty">
            {activeYFields.length === 0
              ? "Select at least one field above to generate a chart"
              : isScatter && !xField
                ? "Select an X axis field"
                : chartData.length === 0
                  ? "No data matches current team filter"
                  : "Configure fields above"}
          </div>
        )}
        {canRender && (
          <DvChart
            key={`${chartType}-${yFields.join(",")}-${xField}-${teamFilter.join(",")}`}
            chartType={chartType}
            xField={xField}
            yFields={activeYFields}
            data={chartData}
            allTeams={allTeamNums}
          />
        )}
      </div>

      {/* ── STATS SUMMARY BAR ── */}
      {canRender && !isScatter && yFields[0] && (() => {
        const vals = chartData.map(r => r[yFields[0]]).filter(v => v !== null && !isNaN(v));
        if (!vals.length) return null;
        const avg = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2);
        const mx  = Math.max(...vals).toFixed(2);
        const mn  = Math.min(...vals).toFixed(2);
        const topTeam = chartData.find(r => parseFloat(r[yFields[0]]) === parseFloat(mx))?.teamNumber ?? "—";
        return (
          <div className="dv-summary-bar">
            <span className="dv-summary-label">{COL_META[yFields[0]]?.label}</span>
            <div className="dv-summary-stats">
              <span><span className="dv-s-key">AVG</span><span className="dv-s-val">{avg}</span></span>
              <span><span className="dv-s-key">MAX</span><span className="dv-s-val">{mx}</span></span>
              <span><span className="dv-s-key">MIN</span><span className="dv-s-val">{mn}</span></span>
              <span><span className="dv-s-key">TOP TEAM</span><span className="dv-s-val">{topTeam}</span></span>
              <span><span className="dv-s-key">N</span><span className="dv-s-val">{vals.length}</span></span>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

// ── PANEL CONTENT RENDERER ──
const PanelContent = ({ tabKey, tbaCall, tbaConfig, noConfig }) => {
  if (noConfig && ["rankings","your-matches","all-matches"].includes(tabKey))
    return <NoConfig />;

  switch (tabKey) {
    case "rankings":
      return <RankingsPanel eventCode={tbaConfig.eventCode} tbaCall={tbaCall} />;
    case "your-matches":
      return <MatchesPanel eventCode={tbaConfig.eventCode} tbaCall={tbaCall} filterTeam={tbaConfig.teamNumber} />;
    case "all-matches":
      return <MatchesPanel eventCode={tbaConfig.eventCode} tbaCall={tbaCall} filterTeam={null} />;
    case "picklist":
      return <PicklistPanel />;
    case "statistics":
      return <StatisticsPanel />;
    case "team-search":
      return <TeamSearchPanel tbaCall={tbaCall} tbaConfig={tbaConfig} noConfig={noConfig} />;
    case "match-strategy":
      return <MatchStrategyPanel tbaCall={tbaCall} tbaConfig={tbaConfig} noConfig={noConfig} />;
    case "data-viz":
      return <DataVizPanel />;
    default:
      return <PlaceholderPanel label={ALL_TABS.find(t => t.key === tabKey)?.label ?? tabKey} />;
  }
};

// ── SPLIT PANEL ──
const SplitPanel = ({ noConfig, tbaCall, tbaConfig }) => {

  // Load persisted layout or use defaults
  const savedLayout = mergeLayout(loadLayout());
  const [splitPct, setSplitPct]   = useState(savedLayout?.splitPct   ?? 40);
  const [leftTabs,  setLeftTabs]  = useState(savedLayout?.leftTabs   ?? ["team-search","picklist","statistics","match-strategy"]);
  const [rightTabs, setRightTabs] = useState(savedLayout?.rightTabs  ?? ["rankings","your-matches","all-matches"]);
  const [leftActive,  setLeftActive]  = useState(savedLayout?.leftActive  ?? "team-search");
  const [rightActive, setRightActive] = useState(savedLayout?.rightActive ?? "rankings");

  // Persist layout whenever it changes
  useEffect(() => {
    saveLayout({ splitPct, leftTabs, rightTabs, leftActive, rightActive });
  }, [splitPct, leftTabs, rightTabs, leftActive, rightActive]);

  // ── DRAG TO RESIZE ──
  const containerRef = useRef(null);
  const [resizing, setResizing] = useState(false);

  const onDividerMouseDown = (e) => {
    e.preventDefault();
    setResizing(true);
  };

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const rawPct = ((clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(75, Math.max(25, rawPct)));
    };
    const onUp = () => setResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend",  onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend",  onUp);
    };
  }, [resizing]);

  // ── DRAG TABS ──
  const dragTab = useRef(null); // { key, fromPanel }

  const onTabDragStart = (e, key, fromPanel) => {
    dragTab.current = { key, fromPanel };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  };

  const onTabBarDrop = (e, toPanel) => {
    e.preventDefault();
    const { key, fromPanel } = dragTab.current ?? {};
    if (!key || fromPanel === toPanel) return;

    // Move tab from one panel to the other
    if (fromPanel === "left") {
      const newLeft  = leftTabs.filter(k => k !== key);
      const newRight = [...rightTabs, key];
      setLeftTabs(newLeft);
      setRightTabs(newRight);
      // fix active tabs
      if (leftActive === key)  setLeftActive(newLeft[0]  ?? null);
      setRightActive(key);
    } else {
      const newRight = rightTabs.filter(k => k !== key);
      const newLeft  = [...leftTabs, key];
      setRightTabs(newRight);
      setLeftTabs(newLeft);
      if (rightActive === key) setRightActive(newRight[0] ?? null);
      setLeftActive(key);
    }
    dragTab.current = null;
  };

  const onTabBarDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  // Ensure active tabs are valid
  const safeLeftActive  = leftTabs.includes(leftActive)   ? leftActive  : leftTabs[0]  ?? null;
  const safeRightActive = rightTabs.includes(rightActive)  ? rightActive : rightTabs[0] ?? null;

  const renderPanel = (tabs, activeTab, setActive, panelId) => {
    const isPicklist = activeTab === "picklist";
    return (
      <div className="col">
        {/* Tab bar — drop zone */}
        <div
          className={`panel-tabs drop-zone ${dragTab.current && dragTab.current.fromPanel !== panelId ? "drop-zone-active" : ""}`}
          onDrop={e => onTabBarDrop(e, panelId)}
          onDragOver={onTabBarDragOver}
        >
          {tabs.map(key => {
            const t = ALL_TABS.find(x => x.key === key);
            if (!t) return null;
            return (
              <button
                key={key}
                className={`tab-btn ${activeTab === key ? "tab-active" : ""}`}
                onClick={() => setActive(key)}
                draggable
                onDragStart={e => onTabDragStart(e, key, panelId)}
              >
                <span className="tab-drag-grip">⠿</span>
                {t.label}
              </button>
            );
          })}
          {tabs.length === 0 && (
            <div className="drop-hint">Drop a tab here</div>
          )}
        </div>

        {/* Panel body */}
        <div className={`panel-body ${isPicklist ? "panel-body-picklist" : ""}`}>
          {activeTab ? (
            <PanelContent
              tabKey={activeTab}
              tbaCall={tbaCall}
              tbaConfig={tbaConfig}
              noConfig={noConfig}
            />
          ) : (
            <div className="drop-hint-body">← Drop tabs here</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`split-container ${resizing ? "is-resizing" : ""}`}
    >
      <div className="split-left" style={{ width: `${splitPct}%` }}>
        <div className="lovat-reminder">
          <span className="lovat-reminder-icon">⚠</span>
          Remember to upload the latest Lovat CSV before each match day — go to{" "}
          <Link to="/config" className="lovat-reminder-link">Config</Link> to update.
        </div>
        {renderPanel(leftTabs, safeLeftActive, (k) => { setLeftActive(k); }, "left")}
      </div>

      {/* Resize handle */}
      <div
        className="split-divider"
        onMouseDown={onDividerMouseDown}
        onTouchStart={onDividerMouseDown}
        title="Drag to resize"
      >
        <div className="divider-grip">
          <span /><span /><span />
        </div>
      </div>

      <div className="split-right" style={{ width: `${100 - splitPct}%` }}>
        {renderPanel(rightTabs, safeRightActive, (k) => { setRightActive(k); }, "right")}
      </div>
    </div>
  );
};

// ── MAIN DASHBOARD ──
export default function ScoutingDashboard() {
  const { tbaConfig } = useData();
  const { call: tbaCall } = useTBA();

  const [eventInfo,    setEventInfo]    = useState(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError,   setEventError]   = useState("");

  const noConfig = !tbaConfig?.apiKey || !tbaConfig?.eventCode;

  useEffect(() => {
    if (noConfig) return;
    setEventLoading(true);
    tbaCall(`/event/${tbaConfig.eventCode}`)
      .then(data => { setEventInfo(data); setEventLoading(false); })
      .catch(e  => { setEventError(e.message); setEventLoading(false); });
  }, [tbaConfig?.apiKey, tbaConfig?.eventCode]);

  return (
    <div className="db-page">
      <GridBackground />
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="scanlines" />

      {/* ── HEADER ── */}
      <header className="db-header">
        <div className="logo-zone">
          <div className="logo-box"><span className="logo-placeholder">CGW</span></div>
          <div className="logo-text-group">
            <span className="logo-team">FRC Team 2996</span>
            <span className="logo-name">Cougars Gone Wired</span>
          </div>
        </div>

        <div className="header-center">
          {noConfig ? (
            <span className="hdr-no-config">▸ NO EVENT CONFIGURED</span>
          ) : eventLoading ? (
            <span className="hdr-loading"><span className="spin">◎</span> Loading...</span>
          ) : eventError ? (
            <span className="hdr-error">✕ {eventError}</span>
          ) : eventInfo ? (
            <>
              <div className="hdr-event-name">{eventInfo.name}</div>
              <div className="hdr-event-meta">
                {eventInfo.year} · {eventInfo.city}, {eventInfo.state_prov}
                &nbsp;·&nbsp;CODE: {tbaConfig.eventCode.toUpperCase()}
                {tbaConfig.teamNumber && ` · TEAM ${tbaConfig.teamNumber}`}
              </div>
            </>
          ) : null}
        </div>

        <Link to="/" className="back-btn">← HOME</Link>
      </header>

      {/* ── BODY ── */}
      <main className="db-main">
        <SplitPanel noConfig={noConfig} tbaCall={tbaCall} tbaConfig={tbaConfig} />
      </main>

      {/* ── FOOTER ── */}
      <footer className="db-footer">
        <p className="footer-credit">CRAFTED BY <span>CLAUDE AI</span></p>
        <div className="footer-line" />
        <p className="footer-ver">www.team2996.com</p>
      </footer>
    </div>
  );
}