import * as path from "path";
import fs from "fs/promises";
import dotenv from "dotenv";
import axios from "axios";
import type { PipedrivePerson } from "./types/pipedrive";
import inputData from "./mappings/inputData.json";
import mappings from "./mappings/mappings.json";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

type Mapping = { pipedriveKey: string; inputKey: string };

const API_KEY = process.env.PIPEDRIVE_API_KEY;
const DOMAIN  = process.env.PIPEDRIVE_COMPANY_DOMAIN; 
if (!API_KEY || !DOMAIN) {
  throw new Error("Missing env vars: PIPEDRIVE_API_KEY or PIPEDRIVE_COMPANY_DOMAIN");
}
const BASE = `https://${DOMAIN}.pipedrive.com/api/v2`;


const get = (obj: any, pathStr: string) =>
  pathStr.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);

const clean = (obj: Record<string, any>) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));

function validateMappings(): string[] {
  const missing: string[] = [];
  for (const { inputKey } of mappings as { inputKey: string }[]) {
    if (get(inputData, inputKey) === undefined) missing.push(inputKey);
  }
  return missing;
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3, delayMs = 500): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const code = e?.response?.status;
    if (tries > 1 && (code === 429 || (code >= 500 && code < 600))) {
      await new Promise(r => setTimeout(r, delayMs));
      return withRetry(fn, tries - 1, delayMs * 2);
    }
    throw e;
  }
}

async function logPerson(person: any) {
  const dir = path.join(__dirname, "..", "logs");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `person_${person?.id ?? "new"}.json`);
  await fs.writeFile(file, JSON.stringify(person, null, 2));
  console.log("Logged to:", file);
}

async function searchPersonByName(name: string) {
  const res = await withRetry(() =>
    axios.get(`${BASE}/persons/search`, {
      params: { api_token: API_KEY, term: name, fields: "name", exact_match: true },
    })
  );
  const items = res.data?.data?.items ?? [];
  return items.length ? items[0].item : null; // { id, name, ... } or null
}

export const syncPdPerson = async (): Promise<PipedrivePerson> => {
  const missing = validateMappings();
  if (missing.length) console.warn("⚠ Missing input paths:", missing.join(", "));

  const payload: Record<string, any> = clean(
    (mappings as Mapping[]).reduce<Record<string, any>>((acc, { pipedriveKey, inputKey }) => {
      acc[pipedriveKey] = get(inputData, inputKey);
      return acc;
    }, {})
  );

  if (payload.email && !Array.isArray(payload.email)) {
  payload.emails = [{ value: payload.email, primary: true }];
  delete payload.email;
}
  if (payload.phone && !Array.isArray(payload.phone)) {
  payload.phones = [{ value: payload.phone, primary: true }];
  delete payload.phone;
}

  const nameKey = (mappings as Mapping[]).find(m => m.pipedriveKey === "name")?.inputKey;
  const nameVal = nameKey ? get(inputData, nameKey) : undefined;
  if (!nameVal || typeof nameVal !== "string" || !nameVal.trim()) {
    throw new Error("Missing person's name from input (as defined in mappings.json).");
  }

  try {
    const existing = await searchPersonByName(nameVal);

    let person: PipedrivePerson;
    if (existing?.id) {
      const upd = await withRetry(() =>
        axios.patch(
  `${BASE}/persons/${existing.id}`, payload, { params: { api_token: API_KEY } })
      );
      person = upd.data.data as PipedrivePerson;
      console.log(`Updated person id=${existing.id} (${nameVal})`);
    } else {
      const crt = await withRetry(() =>
        axios.post(`${BASE}/persons`, payload, { params: { api_token: API_KEY } })
      );
      person = crt.data.data as PipedrivePerson;
      console.log(`Created person id=${(person as any)?.id} (${nameVal})`);
    }

    await logPerson(person);
    return person;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const code = err.response?.status;
      if (code === 401) throw new Error("Unauthorized: check API key and company domain.");
      if (code === 429) throw new Error("Rate limited by Pipedrive (429). Try again shortly.");
      const details = JSON.stringify(err.response?.data ?? {}, null, 2);
      throw new Error(`Pipedrive API error (${code}): ${details}`);
    }
    throw err;
  }
};


if (require.main === module) {
  syncPdPerson()
    .then(p => console.log("Synced:", { id: (p as any)?.id, name: (p as any)?.name }))
    .catch(e => { console.error(e.message); process.exit(1); });
}
