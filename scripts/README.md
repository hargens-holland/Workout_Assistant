# Exercise Import Scripts

## Import Exercises from JSON

### Quick Start

1. **Prepare your exercises file** (see `data/exercises.json` for format)

2. **Validate the file**:
   ```bash
   npx tsx scripts/import-exercises.ts data/exercises.json
   ```

3. **Import via Convex Dashboard**:
   - Go to your Convex dashboard
   - Navigate to Functions > plans > importExercises
   - Paste the exercises array as the `exercises` argument

4. **Or import via CLI**:
   ```bash
   npx convex run plans:importExercises --exercises '[...]'
   ```

### JSON Format

Each exercise must have:
- `name` (string): Exercise name
- `bodyPart` (string): Body part (chest, back, legs, shoulders, arms, core)
- `isCompound` (boolean): Whether it's a compound movement
- `equipment` (optional string): Equipment needed

Example:
```json
[
  {
    "name": "Bench Press",
    "bodyPart": "chest",
    "isCompound": true,
    "equipment": "barbell"
  }
]
```

### Body Parts

Supported body parts (case-insensitive):
- `chest`
- `back`
- `legs`
- `shoulders`
- `arms`
- `core`

### Checking Import Status

Query exercise stats:
```bash
npx convex run plans:getExerciseStats
```

Get all exercises:
```bash
npx convex run plans:getAllExercises
```
