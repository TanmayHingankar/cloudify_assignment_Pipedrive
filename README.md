# Pipedrive Data Sync

A TypeScript-based utility that synchronizes person data from a local JSON input file to Pipedrive using the Pipedrive API v2.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and add your Pipedrive credentials:

```env
PIPEDRIVE_API_KEY=your_api_key
PIPEDRIVE_COMPANY_DOMAIN=your_company_domain
```

> Keep `.env` private and do not commit it to the repository.

### 3. Build and run

```bash
npm run build
npm start
```

Or:

```bash
npm run build && npm start
```

## Project Structure

```text
.
├── src/
│   ├── mappings/
│   │   ├── inputData.json
│   │   └── mappings.json
│   ├── types/
│   │   └── pipedrive.ts
│   └── index.ts
├── logs/
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

The application follows a mapping-driven synchronization flow:

1. Reads person data from `src/mappings/inputData.json`.
2. Reads field mappings from `src/mappings/mappings.json`.
3. Dynamically builds the Pipedrive person payload using the configured mappings.
4. Finds the input field mapped to the Pipedrive `name` field.
5. Searches Pipedrive for an exact name match.
6. Updates the existing person if a match is found.
7. Creates a new person if no matching person exists.
8. Normalizes email and phone values to Pipedrive's expected array format.
9. Logs the final Pipedrive person response to `logs/person_<id>.json`.

## Mapping Example

The synchronization supports both direct and nested input paths.

```json
[
  {
    "pipedriveKey": "name",
    "inputKey": "fullName"
  },
  {
    "pipedriveKey": "email",
    "inputKey": "emailAdress"
  },
  {
    "pipedriveKey": "phone",
    "inputKey": "phoneNumber.home"
  }
]
```


## Edge Cases & Error Handling

The implementation handles the following cases:

- **Missing mapping paths:** Detects missing input fields and reports them clearly.
- **Missing person name:** Stops synchronization with a clear error because the mapped name is required for the lookup.
- **Rate limiting (HTTP 429):** Retries the request with exponential backoff.
- **Temporary server errors (HTTP 5xx):** Retries the request with exponential backoff.
- **Unauthorized requests (HTTP 401):** Returns a clear authentication error.
- **Email and phone normalization:** Converts single email/phone values into the array format expected by Pipedrive.

## Pipedrive API

The implementation uses Pipedrive API v2 Person endpoints for:

- Searching persons by name
- Creating persons
- Updating persons

The API token is passed securely through environment variables.

## Testing

The implementation was tested against both primary synchronization scenarios.

### Existing Person — Update

An existing person was found by exact name and successfully updated:

```text
Updated person id=3 (Jason)
Synced: { id: 3, name: 'Jason' }
```

### New Person — Create

A person with a new name was not found and was successfully created:

```text
Created person id=5 (Jason Test)
Synced: { id: 5, name: 'Jason Test' }
```

### Build Verification

The TypeScript project builds successfully using:

```bash
npm run build
```

## Output Logging

After a successful synchronization, the final Pipedrive person object is stored under:

```text
logs/person_<id>.json
```

## Project Scripts

| Command | Description |
|---|---|
| `npm install` | Install project dependencies |
| `npm run build` | Compile TypeScript source into `dist/` |
| `npm start` | Run the compiled application |




