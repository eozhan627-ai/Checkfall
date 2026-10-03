# POVCheck

POVCheck is a chess app built with React Native and Expo.

## Features
- Local chess games
- Online multiplayer matches with server-side Elo ratings
- Bot matches with adjustable difficulty
- Daily tactical puzzles and a puzzle trainer
- Interactive lessons and a personal coach
- Friends and clans
- Game history, saved games and game analysis (VIP)

## Project layout
- `app/` – screens only (every file here is a route of expo-router)
- `components/` – shared UI (`components/game/` holds the chess board)
- `lib/` – data access, socket connection, storage helpers
- `tests/` – unit tests for pure logic
- `scripts/` – one-off tooling (puzzle import, image generation)

## Development
```
npm install
npm start          # Expo dev server
npm run typecheck  # TypeScript
npm test           # unit tests (Node 22+)
npm run lint
```

The game server lives in a separate repository. Its address is set in
`lib/config.ts`. Ratings, statistics, VIP tier and avatars are owned by the
server; the app only reads them.

## Tech stack
React Native, Expo, expo-router, chess.js, socket.io, Supabase.
