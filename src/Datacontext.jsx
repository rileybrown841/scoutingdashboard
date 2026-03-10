import { createContext, useContext, useState, useEffect } from "react";

// ── CSV PARSER ──
// Handles quoted fields, commas inside quotes, and newlines
export function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  
  // Parse a single CSV line respecting quoted fields
  const parseLine = (line) => {
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  const headers = parseLine(nonEmpty[0]);
  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseLine(nonEmpty[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// ── CONTEXT DEFINITION ──
const DataContext = createContext(null);

const STORAGE_KEYS = {
  lovat:     "sgw_lovat_data",
  headScout: "sgw_headscout_data",
  pit:       "sgw_pit_data",
  sheetUrls: "sgw_sheet_urls",
  tbaConfig: "sgw_tba_config",
};

// Load a value from localStorage safely
function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Save a value to localStorage safely
function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("localStorage write failed:", e);
  }
}

// ── PROVIDER ──
export function DataProvider({ children }) {
  // Each dataset: { rows: [], headers: [], fileName: "", lastUpdated: "" }
  const [lovatData,     setLovatData]     = useState(() => loadFromStorage(STORAGE_KEYS.lovat)     ?? null);
  const [headScoutData, setHeadScoutData] = useState(() => loadFromStorage(STORAGE_KEYS.headScout) ?? null);
  const [pitData,       setPitData]       = useState(() => loadFromStorage(STORAGE_KEYS.pit)       ?? null);

  // Persist saved sheet URLs so users don't have to re-enter them
  const [sheetUrls, setSheetUrls] = useState(() => loadFromStorage(STORAGE_KEYS.sheetUrls) ?? { headScout: "", pit: "" });

  // TBA config: API key, event code, team number
  const [tbaConfig, setTbaConfig] = useState(() => loadFromStorage(STORAGE_KEYS.tbaConfig) ?? { apiKey: "", eventCode: "", teamNumber: "" });

  // Sync to localStorage whenever data changes
  useEffect(() => { if (lovatData)     saveToStorage(STORAGE_KEYS.lovat,     lovatData);     }, [lovatData]);
  useEffect(() => { if (headScoutData) saveToStorage(STORAGE_KEYS.headScout, headScoutData); }, [headScoutData]);
  useEffect(() => { if (pitData)       saveToStorage(STORAGE_KEYS.pit,       pitData);       }, [pitData]);
  useEffect(() => {                    saveToStorage(STORAGE_KEYS.sheetUrls, sheetUrls);     }, [sheetUrls]);
  useEffect(() => {                    saveToStorage(STORAGE_KEYS.tbaConfig, tbaConfig);     }, [tbaConfig]);

  const saveTbaConfig = (config) => setTbaConfig(config);
  const clearTbaConfig = () => { setTbaConfig({ apiKey: "", eventCode: "", teamNumber: "" }); localStorage.removeItem(STORAGE_KEYS.tbaConfig); };

  // ── LOVAT: parse uploaded CSV file ──
  const uploadLovatCSV = (file) => {
    return new Promise((resolve, reject) => {
      if (!file || !file.name.endsWith(".csv")) {
        reject(new Error("Invalid file type"));
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const rows = parseCSV(ev.target.result);
          if (rows.length === 0) { reject(new Error("Empty file")); return; }
          const dataset = {
            rows,
            headers: Object.keys(rows[0]),
            fileName: file.name,
            lastUpdated: new Date().toLocaleString(),
            source: "csv",
          };
          setLovatData(dataset);
          resolve(dataset);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsText(file);
    });
  };

  // ── SHEETS: fetch and parse a Google Sheet as CSV ──
  const fetchGoogleSheet = async (url, dataKey) => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) throw new Error("Invalid Google Sheets URL");
    const id = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;

    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error("Fetch failed — check sharing settings");
    const text = await res.text();

    const rows = parseCSV(text);
    if (rows.length === 0) throw new Error("Sheet appears empty");

    const dataset = {
      rows,
      headers: Object.keys(rows[0]),
      sheetUrl: url,
      lastUpdated: new Date().toLocaleString(),
      source: "sheet",
    };

    if (dataKey === "headScout") {
      setHeadScoutData(dataset);
      setSheetUrls(prev => ({ ...prev, headScout: url }));
    } else if (dataKey === "pit") {
      setPitData(dataset);
      setSheetUrls(prev => ({ ...prev, pit: url }));
    }

    return dataset;
  };

  // ── CLEAR helpers ──
  const clearLovat     = () => { setLovatData(null);     localStorage.removeItem(STORAGE_KEYS.lovat);     };
  const clearHeadScout = () => { setHeadScoutData(null); localStorage.removeItem(STORAGE_KEYS.headScout); };
  const clearPit       = () => { setPitData(null);       localStorage.removeItem(STORAGE_KEYS.pit);       };

  return (
    <DataContext.Provider value={{
      lovatData,
      headScoutData,
      pitData,
      sheetUrls,
      tbaConfig,
      uploadLovatCSV,
      fetchGoogleSheet,
      saveTbaConfig,
      clearLovat,
      clearHeadScout,
      clearPit,
      clearTbaConfig,
    }}>
      {children}
    </DataContext.Provider>
  );
}

// ── HOOK ──
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}