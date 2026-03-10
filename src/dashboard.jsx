import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useData } from "./Datacontext";
import "./dashboard.css";

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
            <tr key={r.team_key} className={r.team_key === `frc${tbaConfig?.teamNumber}` ? "my-team-row" : ""}>
              <td className="td-rank">{r.rank}</td>
              <td className="td-team">{r.team_key.replace("frc", "")}</td>
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

function emptyRow(i) {
  return {
    id: i,
    teamNumber: "",
    teamName: "",
    roles: [],
    watch: [],
    notes: "",
  };
}

function loadPicklistRows() {
  try {
    const raw = localStorage.getItem(PICKLIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Ensure we always have exactly NUM_ROWS rows
    if (Array.isArray(parsed) && parsed.length === NUM_ROWS) return parsed;
    return null;
  } catch { return null; }
}

function savePicklistRows(rows) {
  try { localStorage.setItem(PICKLIST_STORAGE_KEY, JSON.stringify(rows)); }
  catch (e) { console.warn("Picklist save failed:", e); }
}

const PicklistPanel = () => {
  const { tbaConfig } = useData();
  const { call: tbaCall } = useTBA();

  const [rows, setRows] = useState(
    () => loadPicklistRows() ?? Array.from({ length: NUM_ROWS }, (_, i) => emptyRow(i))
  );
  const [teams, setTeams]             = useState([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [lastSaved, setLastSaved]     = useState(null);

  // Auto-save to localStorage whenever rows change
  useEffect(() => {
    savePicklistRows(rows);
    setLastSaved(new Date().toLocaleTimeString());
  }, [rows]);

  // Load teams from TBA for autofill
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

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const clearAll = () => {
    if (!window.confirm("Clear all picklist entries? This cannot be undone.")) return;
    const fresh = Array.from({ length: NUM_ROWS }, (_, i) => emptyRow(i));
    setRows(fresh);
    savePicklistRows(fresh);
  };

  const toggleRole = (idx, role) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const has = r.roles.includes(role);
      return { ...r, roles: has ? r.roles.filter(x => x !== role) : [...r.roles, role] };
    }));
  };

  const toggleWatch = (idx, opt) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const has = r.watch.includes(opt);
      return { ...r, watch: has ? r.watch.filter(x => x !== opt) : [...r.watch, opt] };
    }));
  };

  const handleTeamNumberChange = (idx, val) => {
    const match = teams.find(t => t.teamNumber === val.trim());
    updateRow(idx, "teamNumber", val);
    if (match) updateRow(idx, "teamName", match.nickname);
    else if (!val) updateRow(idx, "teamName", "");
  };

  // ── DOWNLOAD AS XLSX via SheetJS ──
  const downloadXLSX = async () => {
    setDownloading(true);
    try {
      // Dynamically load SheetJS from CDN
      if (!window.XLSX) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const XLSX = window.XLSX;

      const eventLabel = tbaConfig?.eventCode?.toUpperCase() ?? "EVENT";

      // Build worksheet data
      const headers = [
        "Pick #", "Team #", "Team Name", "Role(s)",
        "2nd Day: Watch / Talk",
        "Notes",
      ];

      const wsData = [headers];
      rows.forEach((r, i) => {
        wsData.push([
          i + 1,
          r.teamNumber,
          r.teamName,
          r.roles.join(", "),
          r.watch.join(", "),
          r.notes,
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      ws["!cols"] = [
        { wch: 7 },   // Pick #
        { wch: 9 },   // Team #
        { wch: 22 },  // Team Name
        { wch: 24 },  // Role(s)
        { wch: 22 },  // Watch/Talk
        { wch: 50 },  // Notes
      ];

      // Style header row (basic bold via cell format)
      headers.forEach((_, ci) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: ci });
        if (!ws[cellRef]) return;
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "1A2535" } },
          alignment: { horizontal: "center" },
        };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Picklist");

      XLSX.writeFile(wb, `picklist_${eventLabel}.xlsx`);
    } catch (e) {
      console.error("XLSX download failed", e);
      alert("Download failed — check console for details.");
    }
    setDownloading(false);
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
              <th className="pl-th-num">#</th>
              <th className="pl-th-team">TEAM # / NAME</th>
              <th className="pl-th-role">ROLE</th>
              <th className="pl-th-watch">2ND DAY SCOUTING</th>
              <th className="pl-th-notes">NOTES</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className={`pl-row ${idx % 2 === 0 ? "pl-row-even" : ""}`}>

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
                      >
                        {role}
                      </button>
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
                      >
                        {opt}
                      </button>
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

      {/* Download button */}
      <div className="pl-footer">
        <div className="pl-footer-left">
          <span className="pl-footer-info">
            {rows.filter(r => r.teamNumber).length} / {NUM_ROWS} teams filled
          </span>
          {lastSaved && (
            <span className="pl-saved-indicator">✓ Auto-saved {lastSaved}</span>
          )}
        </div>
        <div className="pl-footer-right">
          <button className="pl-clear-btn" onClick={clearAll}>
            ✕ CLEAR ALL
          </button>
          <button
            className="pl-download-btn"
            onClick={downloadXLSX}
            disabled={downloading}
          >
            {downloading ? "⏳ Generating..." : "⬇ DOWNLOAD AS EXCEL"}
          </button>
        </div>
      </div>
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
  { key: "team-search",    label: "Team Search",    panel: "left"  },
  { key: "picklist",       label: "Picklist",        panel: "left"  },
  { key: "statistics",     label: "Statistics",      panel: "left"  },
  { key: "match-strategy", label: "Match Strategy",  panel: "left"  },
  { key: "rankings",       label: "Rankings",        panel: "right" },
  { key: "your-matches",   label: "Your Matches",    panel: "right" },
  { key: "all-matches",    label: "All Matches",     panel: "right" },
];

const LAYOUT_KEY = "sgw_dashboard_layout";

function loadLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
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
    default:
      return <PlaceholderPanel label={ALL_TABS.find(t => t.key === tabKey)?.label ?? tabKey} />;
  }
};

// ── SPLIT PANEL ──
const SplitPanel = ({ noConfig, tbaCall, tbaConfig }) => {

  // Load persisted layout or use defaults
  const savedLayout = loadLayout();
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
          Remember to upload the latest Lovat CSV — go to{" "}
          <a href="/config" className="lovat-reminder-link">Config</a> to update.
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