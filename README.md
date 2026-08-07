# Pipedrive Data Sync

## Setup
1. `npm i`
2. Copy `.env.example` → `.env` and fill values
3. `npm run build && npm start`

## What it does
- Builds a Pipedrive person payload from `src/mappings/inputData.json` using `src/mappings/mappings.json`
- Searches Pipedrive by the field mapped to `name`
- **Updates** an existing person if found, otherwise **creates** a new one
- Logs the final person to `./logs/person_<id>.json`

## Edge cases handled
- Missing `name` in input/mapping → throws with a clear error
- Missing mapping paths → warns (doesn’t crash)
- 429/5xx API errors → retried with exponential backoff
- `email` / `phone` normalized to Pipedrive’s array format

## Scripts
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run compiled app
- `npm run dev` — run with `ts-node` + reload (if you added it)
