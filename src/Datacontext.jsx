import { createContext, useContext, useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// ── CSV PARSER ──
export function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);

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

// ── FIRESTORE HELPERS ──
// Firestore documents have a 1MB limit. Large CSVs are chunked across multiple docs.
const CHUNK_SIZE = 400; // rows per chunk

async function saveDataset(docId, dataset) {
  if (!dataset) return;
  const { rows, ...meta } = dataset;

  // Write metadata doc
  await setDoc(doc(db, "scouting", docId), {
    ...meta,
    rowCount: rows.length,
    chunkCount: Math.ceil(rows.length / CHUNK_SIZE),
  });

  // Write row chunks
  const chunkCount = Math.ceil(rows.length / CHUNK_SIZE);
  for (let i = 0; i < chunkCount; i++) {
    const chunk = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await setDoc(doc(db, "scouting", `${docId}_chunk${i}`), { rows: chunk });
  }
}

async function loadDataset(docId) {
  const metaSnap = await getDoc(doc(db, "scouting", docId));
  if (!metaSnap.exists()) return null;

  const meta = metaSnap.data();
  const { chunkCount, ...rest } = meta;

  let rows = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunkSnap = await getDoc(doc(db, "scouting", `${docId}_chunk${i}`));
    if (chunkSnap.exists()) rows = rows.concat(chunkSnap.data().rows);
  }

  return { ...rest, rows };
}

async function deleteDataset(docId, chunkCount) {
  await deleteDoc(doc(db, "scouting", docId));
  for (let i = 0; i < (chunkCount ?? 10); i++) {
    try { await deleteDoc(doc(db, "scouting", `${docId}_chunk${i}`)); } catch { /* ignore */ }
  }
}

// ── CONTEXT ──
const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [lovatData,     setLovatData]     = useState(null);
  const [headScoutData, setHeadScoutData] = useState(null);
  const [pitData,       setPitData]       = useState(null);
  const [sheetUrls,     setSheetUrls]     = useState({ headScout: "", pit: "" });
  const [tbaConfig,     setTbaConfig]     = useState({ apiKey: "", eventCode: "", teamNumber: "" });

  const [user,       setUser]       = useState(null);   // firebase auth user
  const [authReady,  setAuthReady]  = useState(false);  // true once auth state resolved
  const [dataReady,  setDataReady]  = useState(false);  // true once initial Firestore load done
  const [syncStatus, setSyncStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"

  // ── Auth listener ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // ── Load all shared data from Firestore on mount ──
  useEffect(() => {
    async function load() {
      try {
        const [lovat, headScout, pit, urlsSnap, tbaSnap] = await Promise.all([
          loadDataset("lovat"),
          loadDataset("headScout"),
          loadDataset("pit"),
          getDoc(doc(db, "scouting", "sheetUrls")),
          getDoc(doc(db, "scouting", "tbaConfig")),
        ]);
        if (lovat)     setLovatData(lovat);
        if (headScout) setHeadScoutData(headScout);
        if (pit)       setPitData(pit);
        if (urlsSnap.exists()) setSheetUrls(urlsSnap.data());
        if (tbaSnap.exists())  setTbaConfig(tbaSnap.data());
      } catch (e) {
        console.warn("Firestore load failed:", e);
      } finally {
        setDataReady(true);
      }
    }
    load();
  }, []);

  // ── Auto-poll pit scouting sheet every 30s ──
  useEffect(() => {
    const url = sheetUrls.pit;
    if (!url) return;

    const poll = async () => {
      try {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) return;
        const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        const res = await fetch(csvUrl);
        if (!res.ok) return;
        const text = await res.text();
        const rows = parseCSV(text);
        if (rows.length === 0) return;

        // Only write to Firestore if row count changed
        setPitData(prev => {
          if (prev && prev.rows.length === rows.length) return prev;
          const dataset = {
            rows,
            headers: Object.keys(rows[0]),
            sheetUrl: url,
            lastUpdated: new Date().toLocaleString(),
            source: "sheet",
          };
          saveDataset("pit", dataset);
          return dataset;
        });
      } catch {
        // Silently ignore poll failures
      }
    };

    const interval = setInterval(poll, 5_000);
    return () => clearInterval(interval);
  }, [sheetUrls.pit]);

  // ── Real-time listener on metadata docs so other visitors see updates live ──
  useEffect(() => {
    const unsubs = ["lovat", "headScout", "pit"].map((id) =>
      onSnapshot(doc(db, "scouting", id), async (snap) => {
        if (!snap.exists()) {
          if (id === "lovat")     setLovatData(null);
          if (id === "headScout") setHeadScoutData(null);
          if (id === "pit")       setPitData(null);
          return;
        }
        // Reload full dataset (chunks) when metadata changes
        const dataset = await loadDataset(id);
        if (id === "lovat")     setLovatData(dataset);
        if (id === "headScout") setHeadScoutData(dataset);
        if (id === "pit")       setPitData(dataset);
      })
    );

    const tbaUnsub = onSnapshot(doc(db, "scouting", "tbaConfig"), (snap) => {
      if (snap.exists()) setTbaConfig(snap.data());
    });

    const urlsUnsub = onSnapshot(doc(db, "scouting", "sheetUrls"), (snap) => {
      if (snap.exists()) setSheetUrls(snap.data());
    });

    return () => { unsubs.forEach(u => u()); tbaUnsub(); urlsUnsub(); };
  }, []);

  // ── Auth actions ──
  const login = async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  // ── LOVAT: parse uploaded CSV and push to Firestore ──
  const uploadLovatCSV = (file) => {
    return new Promise((resolve, reject) => {
      if (!file || !file.name.endsWith(".csv")) {
        reject(new Error("Invalid file type"));
        return;
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
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
          setSyncStatus("saving");
          await saveDataset("lovat", dataset);
          setLovatData(dataset);
          setSyncStatus("saved");
          resolve(dataset);
        } catch (e) {
          setSyncStatus("error");
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsText(file);
    });
  };

  // ── SHEETS: fetch Google Sheet CSV and push to Firestore ──
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

    const newUrls = { ...sheetUrls };
    setSyncStatus("saving");

    if (dataKey === "headScout") {
      await saveDataset("headScout", dataset);
      newUrls.headScout = url;
      setHeadScoutData(dataset);
    } else if (dataKey === "pit") {
      await saveDataset("pit", dataset);
      newUrls.pit = url;
      setPitData(dataset);
    }

    await setDoc(doc(db, "scouting", "sheetUrls"), newUrls);
    setSheetUrls(newUrls);
    setSyncStatus("saved");

    return dataset;
  };

  // ── TBA config ──
  const saveTbaConfig = async (config) => {
    setSyncStatus("saving");
    await setDoc(doc(db, "scouting", "tbaConfig"), config);
    setTbaConfig(config);
    setSyncStatus("saved");
  };

  const clearTbaConfig = async () => {
    await deleteDoc(doc(db, "scouting", "tbaConfig"));
    setTbaConfig({ apiKey: "", eventCode: "", teamNumber: "" });
  };

  // ── CLEAR helpers ──
  const clearLovat = async () => {
    const snap = await getDoc(doc(db, "scouting", "lovat"));
    const chunkCount = snap.exists() ? snap.data().chunkCount : 0;
    await deleteDataset("lovat", chunkCount);
    setLovatData(null);
  };

  const clearHeadScout = async () => {
    const snap = await getDoc(doc(db, "scouting", "headScout"));
    const chunkCount = snap.exists() ? snap.data().chunkCount : 0;
    await deleteDataset("headScout", chunkCount);
    const newUrls = { ...sheetUrls, headScout: "" };
    await setDoc(doc(db, "scouting", "sheetUrls"), newUrls);
    setHeadScoutData(null);
    setSheetUrls(newUrls);
  };

  const clearPit = async () => {
    const snap = await getDoc(doc(db, "scouting", "pit"));
    const chunkCount = snap.exists() ? snap.data().chunkCount : 0;
    await deleteDataset("pit", chunkCount);
    const newUrls = { ...sheetUrls, pit: "" };
    await setDoc(doc(db, "scouting", "sheetUrls"), newUrls);
    setPitData(null);
    setSheetUrls(newUrls);
  };

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
      user,
      authReady,
      dataReady,
      syncStatus,
      login,
      logout,
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
