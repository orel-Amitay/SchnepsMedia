# Subwaydle NYC

A daily NYC subway guessing game inspired by [Subwaydle](https://www.subwaydle.com/).  
Guess the sequence of subway lines for a minimum-transfer trip between two stations. Original implementation — not affiliated with subwaydle.com or the MTA.

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

## Data

Station adjacency and line colors are derived from the public [MTA subway GTFS](https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip) static feed (`src/data/graph.json`). Routes are computed client-side for a date-seeded daily puzzle.

## Stack

Vite + React + TypeScript
