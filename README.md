# JiiM Workout Lab

Mobile-first workout logging web app built with Next.js App Router, Tailwind CSS v4, MongoDB, and Drizzle installed in the stack.

## Features

- Create your own workout programs with custom exercises, set count, rep ranges, and notes.
- Start or resume an active workout from a selected program.
- Log reps, weight, and RPE per set in any exercise order (non-sequential flow).
- Tick-style completion feedback per exercise.
- Finish workout workflow.
- Exercise history and analysis:
  - Avg weight, avg RPE, and estimated 1RM graph.
  - Progressive overload score and status.
  - Estimated muscle-building efficiency score.
- Smart recommendations for each set based on your last 3 finished workouts for that exercise and set number.

## Tech

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- MongoDB Node driver
- Drizzle ORM package included in project dependencies
- Recharts for analytics graphs

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env.local
```

3. Set `MONGODB_URI` and optional `MONGODB_DB_NAME` in `.env.local`.

4. Run dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Scripts

- `npm run dev` - start local dev server
- `npm run lint` - run ESLint
- `npm run build` - create production build

## API Routes

- `GET /api/programs` - list programs
- `POST /api/programs` - create program
- `GET /api/programs/:id` - fetch single program
- `POST /api/workouts/start` - start/resume workout
- `GET /api/workouts/active?programId=...` - active workout
- `POST /api/workouts/:id/finish` - finish workout and submit final local draft sets
- `GET /api/history/exercise?name=...&sets=...` - history, analytics, recommendations
