import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useData } from "./Datacontext";

// ── TBA CONFIG PANEL ──
const TBAConfigPanel = () => {
  const { tbaConfig, saveTbaConfig, clearTbaConfig } = useData();

  const [fields, setFields] = useState({
    apiKey:      tbaConfig?.apiKey      ?? "",
    eventCode:   tbaConfig?.eventCode   ?? "",
    teamNumber:  tbaConfig?.teamNumber  ?? "",
  });
  const [status, setStatus]   = useState(tbaConfig?.apiKey ? "saved" : null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  const handleChange = (e) => {
    setFields(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setStatus(null);
    setTestMsg("");
  };

  const handleSave = () => {
    if (!fields.apiKey.trim() || !fields.eventCode.trim() || !fields.teamNumber.trim()) {
      setStatus("error");
      setTestMsg("All three fields are required.");
      return;
    }
    saveTbaConfig({ ...fields });
    setStatus("saved");
    setTestMsg("");
  };

  const handleTest = async () => {
    if (!fields.apiKey.trim() || !fields.eventCode.trim()) {
      setTestMsg("Enter an API key and event code first.");
      return;
    }
    setTesting(true);
    setTestMsg("");
    try {
      const res = await fetch(
        `https://www.thebluealliance.com/api/v3/event/${fields.eventCode.trim()}`,
        { headers: { "X-TBA-Auth-Key": fields.apiKey.trim() } }
      );
      if (res.ok) {
        const data = await res.json();
        setTestMsg(`✓ Connected — "${data.name}" (${data.year})`);
        setStatus("saved");
        saveTbaConfig({ ...fields });
      } else if (res.status === 401) {
        setTestMsg("✕ Invalid API key.");
        setStatus("error");
      } else if (res.status === 404) {
        setTestMsg("✕ Event code not found. Check your event code.");
        setStatus("error");
      } else {
        setTestMsg(`✕ Error ${res.status} — check your inputs.`);
        setStatus("error");
      }
    } catch {
      setTestMsg("✕ Network error — check your connection.");
      setStatus("error");
    }
    setTesting(false);
  };

  const handleClear = () => {
    clearTbaConfig();
    setFields({ apiKey: "", eventCode: "", teamNumber: "" });
    setStatus(null);
    setTestMsg("");
  };

  const isSaved = status === "saved";

  return (
    <div className="upload-panel">
      <div className="panel-header">
        <span className="panel-icon">⚡</span>
        <div style={{ flex: 1 }}>
          <h2 className="panel-title">The Blue Alliance Configuration</h2>
          <p className="panel-desc">API key, event code, and team number used to pull live TBA data into the scouting dashboard.</p>
        </div>
        {isSaved && (
          <button className="clear-btn" onClick={handleClear}>✕ CLEAR</button>
        )}
      </div>

      <div className="tba-fields">
        <div className="tba-field-group">
          <label className="tba-label">TBA API KEY</label>
          <input
            className={`tba-input ${status === "error" && !fields.apiKey ? "input-error" : ""}`}
            name="apiKey"
            type="password"
            value={fields.apiKey}
            onChange={handleChange}
            placeholder="Your TBA Read API Key"
            autoComplete="off"
          />
          <span className="tba-hint">Get yours at <em>thebluealliance.com/account</em></span>
        </div>

        <div className="tba-row">
          <div className="tba-field-group">
            <label className="tba-label">FRC EVENT CODE</label>
            <input
              className={`tba-input ${status === "error" && !fields.eventCode ? "input-error" : ""}`}
              name="eventCode"
              type="text"
              value={fields.eventCode}
              onChange={handleChange}
              placeholder="e.g. 2025orsal"
            />
          </div>
          <div className="tba-field-group">
            <label className="tba-label">TEAM NUMBER</label>
            <input
              className={`tba-input ${status === "error" && !fields.teamNumber ? "input-error" : ""}`}
              name="teamNumber"
              type="text"
              value={fields.teamNumber}
              onChange={handleChange}
              placeholder="e.g. 2996"
            />
          </div>
        </div>
      </div>

      <div className="tba-actions">
        <button className="tba-test-btn" onClick={handleTest} disabled={testing}>
          {testing ? "TESTING..." : "TEST CONNECTION"}
        </button>
        <button className="fetch-btn" onClick={handleSave}>
          {isSaved ? "✓ SAVED" : "SAVE"}
        </button>
      </div>

      {testMsg && (
        <div className={`sheet-status ${testMsg.startsWith("✓") ? "success" : "error"}`}>
          <span>{testMsg}</span>
        </div>
      )}

      {isSaved && !testMsg && (
        <div className="sheet-status success">
          <span>✓</span>
          <span>
            Configuration saved · Event: <strong>{tbaConfig.eventCode}</strong> · Team: <strong>{tbaConfig.teamNumber}</strong>
          </span>
        </div>
      )}
    </div>
  );
};

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

// ── LOVAT UPLOAD PANEL ──
const LovatUpload = () => {
  const { lovatData, uploadLovatCSV, clearLovat } = useData();
  const [status, setStatus] = useState(null); // null | "loading" | "success" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setStatus("loading");
    try {
      await uploadLovatCSV(file);
      setStatus("success");
    } catch (e) {
      setErrorMsg(e.message || "Failed to parse CSV");
      setStatus("error");
    }
  };

  const handleInputChange = (e) => handleFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    clearLovat();
    setStatus(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isLoaded = !!lovatData;

  return (
    <div className="upload-panel">
      <div className="panel-header">
        <span className="panel-icon">◈</span>
        <div>
          <h2 className="panel-title">Lovat Scouting Data</h2>
          <p className="panel-desc">
            Upload the latest CSV export from Lovat. Select 'Export CSV', then select 'By team' and 'Don't filter', then export your CSV.{" "}
            <a href="https://dashboard.lovat.app/#/settings" target="_blank" rel="noopener noreferrer" className="lovat-link">
              Open Lovat →
            </a>
          </p>
        </div>
        {isLoaded && (
          <button className="clear-btn" onClick={handleClear} title="Clear data">✕ CLEAR</button>
        )}
      </div>

      <div
        className={`drop-zone ${isLoaded ? "dz-success" : ""} ${status === "error" ? "dz-error" : ""}`}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current.click()}
      >
        <input ref={inputRef} type="file" accept=".csv" onChange={handleInputChange} style={{ display: "none" }} />

        {status === "loading" ? (
          <div className="dz-content">
            <span className="dz-upload-icon spin">◎</span>
            <span className="dz-prompt">Parsing CSV...</span>
          </div>
        ) : isLoaded ? (
          <div className="dz-content">
            <span className="dz-check">✓</span>
            <span className="dz-filename">{lovatData.fileName}</span>
            <span className="dz-rows">{lovatData.rows.length} rows · {lovatData.headers.length} columns</span>
            <span className="dz-rows" style={{opacity:0.5}}>Last uploaded: {lovatData.lastUpdated}</span>
            <span className="dz-reupload">Click to re-upload</span>
          </div>
        ) : status === "error" ? (
          <div className="dz-content">
            <span className="dz-err-icon">✕</span>
            <span className="dz-err-msg">{errorMsg || "Invalid file — CSV only"}</span>
            <span className="dz-reupload">Click to try again</span>
          </div>
        ) : (
          <div className="dz-content">
            <span className="dz-upload-icon">⬆</span>
            <span className="dz-prompt">Drop CSV here or click to browse</span>
            <span className="dz-hint">.csv files only</span>
          </div>
        )}
      </div>

      {isLoaded && (
        <div className="data-preview">
          <span className="preview-label">COLUMNS DETECTED</span>
          <div className="column-tags">
            {lovatData.headers.map(h => (
              <span key={h} className="col-tag">{h}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── GOOGLE SHEET PANEL ──
const SheetPanel = ({ title, icon, description, dataKey }) => {
  const { headScoutData, pitData, sheetUrls, fetchGoogleSheet, clearHeadScout, clearPit } = useData();

  const data     = dataKey === "headScout" ? headScoutData : pitData;
  const clearFn  = dataKey === "headScout" ? clearHeadScout : clearPit;
  const savedUrl = dataKey === "headScout" ? sheetUrls.headScout : sheetUrls.pit;

  const [url, setUrl]       = useState(savedUrl || "");
  const [status, setStatus] = useState(data ? "success" : null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFetch = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      await fetchGoogleSheet(url, dataKey);
      setStatus("success");
    } catch (e) {
      setErrorMsg(e.message || "Could not fetch sheet");
      setStatus("error");
    }
  };

  const handleClear = () => {
    clearFn();
    setStatus(null);
    setUrl("");
  };

  const isLoaded = !!data;

  return (
    <div className="upload-panel">
      <div className="panel-header">
        <span className="panel-icon">{icon}</span>
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="panel-desc">{description}</p>
        </div>
        {isLoaded && (
          <button className="clear-btn" onClick={handleClear} title="Clear data">✕ CLEAR</button>
        )}
      </div>

      <div className="sheet-input-row">
        <input
          className="sheet-input"
          type="text"
          value={url}
          onChange={e => { setUrl(e.target.value); if (status === "error") setStatus(null); }}
          placeholder="https://docs.google.com/spreadsheets/d/..."
        />
        <button
          className="fetch-btn"
          onClick={handleFetch}
          disabled={!url.trim() || status === "loading"}
        >
          {status === "loading" ? "..." : isLoaded ? "↻ REFRESH" : "FETCH"}
        </button>
      </div>

      {isLoaded && status !== "error" && (
        <div className="sheet-status success">
          <span>✓</span>
          <span>{data.rows.length} rows · {data.headers.length} columns · Last fetched: {data.lastUpdated}</span>
        </div>
      )}
      {status === "error" && (
        <div className="sheet-status error">
          <span>✕</span>
          <span>{errorMsg || "Could not fetch — check the link and sharing settings"}</span>
        </div>
      )}
      {!isLoaded && !status && (
        <p className="sheet-hint">Sheet must be set to <em>"Anyone with the link can view"</em></p>
      )}

      {isLoaded && (
        <div className="data-preview">
          <span className="preview-label">COLUMNS DETECTED</span>
          <div className="column-tags">
            {data.headers.map(h => (
              <span key={h} className="col-tag">{h}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── MAIN PAGE ──
export default function ConfigPage() {
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

        .grid-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }

        .blob {
          position: fixed; border-radius: 50%;
          filter: blur(130px); pointer-events: none; z-index: 0;
        }
        .blob-1 { width: 550px; height: 550px; background: #ffcc00; opacity: 0.1; top: -180px; right: -80px; }
        .blob-2 { width: 400px; height: 400px; background: #ff0000; opacity: 0.07; bottom: -80px; left: -80px; }

        .scanlines {
          position: fixed; inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
          pointer-events: none; z-index: 1;
        }

        /* HEADER */
        header {
          position: relative; z-index: 10;
          padding: 28px 48px 0;
          display: flex; align-items: center; justify-content: space-between;
          opacity: 0; transform: translateY(-20px);
          animation: fadeDown 0.6s ease forwards;
        }

        .logo-zone { display: flex; align-items: center; gap: 14px; }
        .logo-box {
          width: 54px; height: 54px;
          border: 1.5px solid rgba(255,204,0,0.45);
          background: rgba(255,204,0,0.05);
          display: flex; align-items: center; justify-content: center;
          position: relative;
          clip-path: polygon(8px 0%, 100% 0%, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%, 0% 8px);
        }
        .logo-box::before {
          content: ''; position: absolute; inset: 3px;
          border: 1px solid rgba(255,204,0,0.18);
          clip-path: polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px);
        }
        .logo-placeholder { font-family: 'Share Tech Mono', monospace; font-size: 16px; color: #ffcc00; font-weight: bold; letter-spacing: -1px; }
        .logo-text-group { display: flex; flex-direction: column; }
        .logo-team { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #ffcc00; letter-spacing: 3px; text-transform: uppercase; opacity: 0.6; }
        .logo-name { font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700; color: #e8e8e4; letter-spacing: 1px; }

        .back-btn {
          font-family: 'Share Tech Mono', monospace; font-size: 11px;
          color: rgba(255,204,0,0.5); letter-spacing: 2px;
          text-decoration: none;
          border: 1px solid rgba(255,204,0,0.2); padding: 8px 16px;
          clip-path: polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px);
          transition: all 0.2s;
        }
        .back-btn:hover { color: #ffcc00; border-color: rgba(255,204,0,0.5); background: rgba(255,204,0,0.05); }

        /* MAIN */
        main {
          flex: 1; position: relative; z-index: 10;
          padding: 48px 6vw;
          max-width: 900px; width: 100%; margin: 0 auto;
        }

        .page-title {
          font-family: 'Rajdhani', sans-serif;
          font-size: clamp(32px, 5vw, 52px); font-weight: 700;
          color: #e8e8e4; letter-spacing: -0.5px; margin-bottom: 6px;
          opacity: 0; animation: fadeUp 0.6s ease 0.2s forwards;
        }
        .page-title span { color: #ffcc00; }

        .page-subtitle {
          font-family: 'Share Tech Mono', monospace; font-size: 11px;
          color: rgba(232,232,228,0.35); letter-spacing: 3px; text-transform: uppercase;
          margin-bottom: 48px;
          opacity: 0; animation: fadeUp 0.6s ease 0.3s forwards;
        }

        .panels { display: flex; flex-direction: column; gap: 16px; }

        /* PANEL */
        .upload-panel {
          background: rgba(12, 18, 26, 0.85);
          border: 1px solid rgba(255,204,0,0.14);
          clip-path: polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px);
          padding: 28px 32px;
          backdrop-filter: blur(8px);
          opacity: 0; animation: fadeUp 0.5s ease forwards;
          transition: border-color 0.2s;
        }
        .upload-panel:hover { border-color: rgba(255,204,0,0.28); }
        .upload-panel:nth-child(1) { animation-delay: 0.35s; }
        .upload-panel:nth-child(2) { animation-delay: 0.45s; }
        .upload-panel:nth-child(3) { animation-delay: 0.55s; }

        .panel-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
        .panel-icon { font-size: 22px; color: #ffcc00; margin-top: 2px; min-width: 24px; }
        .panel-title {
          font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700;
          color: #e8e8e4; letter-spacing: 0.5px;
          display: flex; align-items: center; gap: 10px; flex: 1;
        }
        .panel-desc { font-size: 13px; color: rgba(232,232,228,0.4); margin-top: 4px; line-height: 1.5; }
        .lovat-link {
          color: rgba(255,204,0,0.7); text-decoration: none;
          font-family: 'Share Tech Mono', monospace; font-size: 11px; letter-spacing: 1px;
          border-bottom: 1px solid rgba(255,204,0,0.25); transition: color 0.15s, border-color 0.15s;
        }
        .lovat-link:hover { color: #ffcc00; border-color: rgba(255,204,0,0.6); }

        .panel-wip-wrap {
          position: relative;
          opacity: 0.35;
          pointer-events: none;
          user-select: none;
          filter: grayscale(0.5);
        }
        .panel-wip-badge {
          position: absolute; top: 12px; right: 14px; z-index: 10;
          font-family: 'Share Tech Mono', monospace; font-size: 8px; letter-spacing: 2.5px;
          color: rgba(232,232,228,0.5); border: 1px solid rgba(255,255,255,0.12);
          padding: 3px 8px; background: rgba(10,15,22,0.85);
          pointer-events: none;
        }

        .clear-btn {
          font-family: 'Share Tech Mono', monospace; font-size: 10px;
          color: rgba(255,0,0,0.5); letter-spacing: 1px;
          background: none; border: 1px solid rgba(255,0,0,0.2);
          padding: 4px 10px; cursor: pointer;
          transition: all 0.2s; white-space: nowrap; margin-top: 2px;
        }
        .clear-btn:hover { color: #ff0000; border-color: rgba(255,0,0,0.5); background: rgba(255,0,0,0.05); }

        /* DROP ZONE */
        .drop-zone {
          border: 1.5px dashed rgba(255,204,0,0.2); padding: 32px;
          text-align: center; cursor: pointer; transition: all 0.2s;
          clip-path: polygon(8px 0%, 100% 0%, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%, 0% 8px);
        }
        .drop-zone:hover { border-color: rgba(255,204,0,0.45); background: rgba(255,204,0,0.03); }
        .dz-success { border-color: rgba(34,197,94,0.4) !important; background: rgba(34,197,94,0.04) !important; }
        .dz-error   { border-color: rgba(255,0,0,0.4)  !important; background: rgba(255,0,0,0.04)  !important; }

        .dz-content { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .dz-upload-icon { font-size: 28px; color: rgba(255,204,0,0.3); }
        .dz-prompt  { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 600; color: rgba(232,232,228,0.6); }
        .dz-hint    { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: rgba(232,232,228,0.25); letter-spacing: 2px; }
        .dz-check   { font-size: 28px; color: #22c55e; }
        .dz-filename { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 600; color: #e8e8e4; }
        .dz-rows    { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: rgba(34,197,94,0.7); letter-spacing: 1px; }
        .dz-reupload { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: rgba(232,232,228,0.25); letter-spacing: 1px; margin-top: 4px; }
        .dz-err-icon { font-size: 28px; color: #ff0000; }
        .dz-err-msg  { font-family: 'Rajdhani', sans-serif; font-size: 15px; color: rgba(255,0,0,0.8); }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { display: inline-block; animation: spin 1s linear infinite; }

        /* SHEET INPUT */
        .sheet-input-row { display: flex; gap: 8px; }
        .sheet-input {
          flex: 1; background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,204,0,0.18); color: #e8e8e4;
          font-family: 'Share Tech Mono', monospace; font-size: 12px;
          padding: 12px 16px; outline: none; letter-spacing: 0.5px;
          clip-path: polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px);
          transition: border-color 0.2s;
        }
        .sheet-input::placeholder { color: rgba(232,232,228,0.2); }
        .sheet-input:focus { border-color: rgba(255,204,0,0.45); }

        .fetch-btn {
          font-family: 'Share Tech Mono', monospace; font-size: 12px; letter-spacing: 2px;
          color: #080c10; background: #ffcc00; border: none;
          padding: 12px 20px; cursor: pointer; font-weight: bold;
          clip-path: polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px);
          transition: all 0.2s;
        }
        .fetch-btn:hover { background: #ffe14d; }
        .fetch-btn:disabled { background: rgba(255,204,0,0.2); color: rgba(232,232,228,0.3); cursor: not-allowed; }

        .sheet-status {
          display: flex; align-items: center; gap: 10px; margin-top: 12px;
          font-family: 'Share Tech Mono', monospace; font-size: 11px; letter-spacing: 1px;
          padding: 10px 14px;
        }
        .sheet-status.success { color: rgba(34,197,94,0.8); background: rgba(34,197,94,0.05); border: 1px solid rgba(34,197,94,0.2); }
        .sheet-status.error   { color: rgba(255,0,0,0.8);  background: rgba(255,0,0,0.05);  border: 1px solid rgba(255,0,0,0.2); }

        .sheet-hint { margin-top: 10px; font-family: 'Share Tech Mono', monospace; font-size: 10px; color: rgba(232,232,228,0.2); letter-spacing: 1px; }
        .sheet-hint em { color: rgba(255,204,0,0.35); font-style: normal; }

        /* COLUMN PREVIEW */
        .data-preview { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,204,0,0.08); }
        .preview-label { font-family: 'Share Tech Mono', monospace; font-size: 9px; letter-spacing: 3px; color: rgba(255,204,0,0.4); display: block; margin-bottom: 10px; }
        .column-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .col-tag {
          font-family: 'Share Tech Mono', monospace; font-size: 10px;
          color: rgba(232,232,228,0.5); letter-spacing: 0.5px;
          border: 1px solid rgba(255,204,0,0.12); padding: 3px 8px;
          background: rgba(255,204,0,0.03);
        }

        /* TBA CONFIG */
        .tba-fields { display: flex; flex-direction: column; gap: 14px; margin-bottom: 14px; }
        .tba-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .tba-field-group { display: flex; flex-direction: column; gap: 6px; }
        .tba-label {
          font-family: 'Share Tech Mono', monospace; font-size: 9px;
          letter-spacing: 3px; color: rgba(255,204,0,0.45);
        }
        .tba-input {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,204,0,0.18); color: #e8e8e4;
          font-family: 'Share Tech Mono', monospace; font-size: 12px;
          padding: 11px 14px; outline: none; letter-spacing: 0.5px; width: 100%;
          clip-path: polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px);
          transition: border-color 0.2s;
        }
        .tba-input::placeholder { color: rgba(232,232,228,0.2); }
        .tba-input:focus { border-color: rgba(255,204,0,0.45); }
        .tba-input.input-error { border-color: rgba(255,0,0,0.5) !important; }
        .tba-hint { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: rgba(232,232,228,0.2); letter-spacing: 1px; }
        .tba-hint em { color: rgba(255,204,0,0.35); font-style: normal; }
        .tba-actions { display: flex; gap: 8px; margin-bottom: 4px; }
        .tba-test-btn {
          font-family: 'Share Tech Mono', monospace; font-size: 12px; letter-spacing: 2px;
          color: rgba(255,204,0,0.7); background: transparent;
          border: 1px solid rgba(255,204,0,0.25); padding: 12px 20px; cursor: pointer;
          clip-path: polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px);
          transition: all 0.2s;
        }
        .tba-test-btn:hover { border-color: rgba(255,204,0,0.6); color: #ffcc00; background: rgba(255,204,0,0.05); }
        .tba-test-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* FOOTER */
        footer {
          position: relative; z-index: 10; padding: 20px 48px;
          display: flex; align-items: center; justify-content: space-between;
          border-top: 1px solid rgba(255,204,0,0.08);
          opacity: 0; animation: fadeUp 0.6s ease 0.8s forwards;
        }
        .footer-credit { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: rgba(232,232,228,0.28); letter-spacing: 1.5px; }
        .footer-credit span { color: rgba(255,204,0,0.55); }
        .footer-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,0,0,0.15), rgba(255,204,0,0.15), transparent); margin: 0 24px; }
        .footer-ver { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: rgba(232,232,228,0.18); }

        @keyframes fadeUp   { from { opacity: 0; transform: translateY(18px);  } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-18px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 640px) {
          header { padding: 18px 5vw 0; }
          main { padding: 32px 5vw; }
          .sheet-input-row { flex-direction: column; }
          .tba-row { grid-template-columns: 1fr; }
          .tba-actions { flex-direction: column; }
          footer { flex-direction: column; gap: 8px; text-align: center; padding: 16px 5vw; }
          .footer-line { display: none; }
          .panel-header { flex-wrap: wrap; }
        }
      `}</style>

      <div className="page">
        <GridBackground />
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="scanlines" />

        <header>
          <div className="logo-zone">
            <div className="logo-box"><span className="logo-placeholder">CGW</span></div>
            <div className="logo-text-group">
              <span className="logo-team">FRC Team 2996</span>
              <span className="logo-name">Cougars Gone Wired</span>
            </div>
          </div>
          <Link to="/" className="back-btn">← BACK</Link>
        </header>

        <main>
          <h1 className="page-title">Configuration &amp; <span>Data Upload</span></h1>
          <p className="page-subtitle">▸ Manage data sources</p>

          <div className="panels">
            <LovatUpload />

            <div className="panel-wip-wrap" title="Head Scout data collection is still being configured">
              <div className="panel-wip-badge">IN PROGRESS</div>
              <SheetPanel
                title="Head Scout Data Collection"
                icon="⬡"
                description="Paste your Google Sheet link. Data is fetched and stored automatically."
                dataKey="headScout"
              />
            </div>

            <SheetPanel
              title="Pit Scouting Data"
              icon="◎"
              description="Paste your Google Sheet link. Sheet must be publicly viewable to fetch automatically."
              dataKey="pit"
            />

            <TBAConfigPanel />
          </div>
        </main>

        <footer>
          <p className="footer-credit">CRAFTED BY <span>CLAUDE AI</span></p>
          <div className="footer-line" />
          <p className="footer-ver">www.team2996.com</p>
        </footer>
      </div>
    </>
  );
}