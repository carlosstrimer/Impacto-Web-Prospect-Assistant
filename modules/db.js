// FILE: modules/db.js
const DB_NAME = 'impacto_web_prospect';
const DB_VERSION = 1;
const STORE_LEADS = 'leads';
const STORE_SETTINGS = 'settings';
const STORE_TEMPLATES = 'templates';

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_LEADS)) {
        const store = db.createObjectStore(STORE_LEADS, { keyPath: 'id' });
        store.createIndex('nome', 'nome', { unique: false });
        store.createIndex('messageStatus', 'messageStatus', { unique: false });
        store.createIndex('salesStatus', 'salesStatus', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function getAllLeads() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEADS, 'readonly');
    const req = tx.objectStore(STORE_LEADS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getLead(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEADS, 'readonly');
    const req = tx.objectStore(STORE_LEADS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function putLead(lead) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEADS, 'readwrite');
    tx.objectStore(STORE_LEADS).put(lead);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function putLeadsBatch(leads) {
  if (!leads || !leads.length) return true;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEADS, 'readwrite');
    const store = tx.objectStore(STORE_LEADS);
    for (const lead of leads) store.put(lead);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteLead(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEADS, 'readwrite');
    tx.objectStore(STORE_LEADS).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteLeads(ids) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEADS, 'readwrite');
    const store = tx.objectStore(STORE_LEADS);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearLeads() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEADS, 'readwrite');
    tx.objectStore(STORE_LEADS).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_LEADS, STORE_SETTINGS, STORE_TEMPLATES], 'readwrite');
    tx.objectStore(STORE_LEADS).clear();
    tx.objectStore(STORE_SETTINGS).clear();
    tx.objectStore(STORE_TEMPLATES).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSetting(key, def = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const req = tx.objectStore(STORE_SETTINGS).get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : def);
    req.onerror = () => reject(req.error);
  });
}

export async function setSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put({ key, value });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllSettings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const req = tx.objectStore(STORE_SETTINGS).getAll();
    req.onsuccess = () => {
      const out = {};
      for (const item of req.result || []) out[item.key] = item.value;
      resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}