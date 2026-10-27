# Transfer

Daily NYC subway guessing game **presented by [Schneps Media](https://www.schnepsmedia.com/)**.  
Original implementation — not affiliated with the MTA or other subway games.

Classic structure: guess **3 trains / 2 transfers**, Wordle-style feedback (green / blue shared routing / yellow / gray), Google sign-in + daily leaderboard when Firebase is configured.

## Play locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # production build to dist/
npm run preview  # serve the production build
```

## How to play

1. Each UTC day has one puzzle: an origin and destination station.
2. Guess the ordered sequence of subway lines for a minimum-transfer route.
3. Feedback per slot (Wordle-style):
   - **Green** — correct line in the correct position
   - **Yellow** — line is in the solution, wrong position
   - **Gray** — line is not in the solution
4. Six guesses. Share your grid when finished.

### How the answer is chosen

The app does **not** store a fixed answer key. For the UTC date it:

1. Seeds a PRNG with `transfer-nyc:YYYY-MM-DD`
2. Samples station pairs on the MTA GTFS graph
3. Runs a minimum-transfer pathfinder and takes that line sequence as today’s solution

For QA, open the app with `?debug` in the URL to reveal today’s lines.

## Data

Station adjacency and line colors are derived from the public [MTA subway GTFS](https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip) static feed (`src/data/graph.json`). Routes are computed client-side for a date-seeded daily puzzle.

## Schneps Media / Auth / Leaderboard

The game is presented by [Schneps Media](https://www.schnepsmedia.com/).

- **Google Sign-In** uses Firebase Auth when `VITE_FIREBASE_*` env vars are set (see `.env.example`).
- Enable **Google** as a sign-in provider in the Firebase console, and add your deploy domain to Authorized domains.
- Create a Firestore collection `leaderboard` (documents auto-written as `{dateKey}_{uid}`) with rules that allow authenticated read/write of own scores and public read of the daily board.
- Without Firebase keys, players can still **Continue as guest**; scores stay on-device until Google is configured.

## Stack

Vite + React + TypeScript + Firebase (optional)
