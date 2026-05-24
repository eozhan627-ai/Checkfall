const fs = require("fs");
const readline = require("readline");

const fileStream = fs.createReadStream(
"C:\\Users\\eozha\\Desktop\\lichess_db_puzzle.csv"
);

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity,
});

const puzzles = [];
const MAX = 50000;

let isFirstLine = true;

rl.on("line", (line) => {
  if (isFirstLine) {
    isFirstLine = false;
    return;
  }

  if (puzzles.length >= MAX) return;

  const parts = line.split(",");

  const id = parts[0];
  const fen = parts[1];
  const moves = parts[2];
  const rating = Number(parts[3]);

  if (!id || !fen || !moves) return;

  puzzles.push({
    id,
    fen,
    moves: moves.split(" "),
    rating,
  });
});

rl.on("close", () => {
  fs.writeFileSync(
    "puzzles.json",
    JSON.stringify(puzzles)
  );

  console.log("Fertig:", puzzles.length);
});