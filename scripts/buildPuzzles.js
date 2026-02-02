const fs = require("fs");
const csv = require("csv-parser");

const results = [];
const MAX = 500;

fs.createReadStream("assets/lichess_db_puzzle.csv")
    .pipe(csv())
    .on("data", (row) => {
        if (
            row.FEN &&
            row.Moves &&
            row.Rating &&
            results.length < MAX &&
            Number(row.Rating) >= 800 &&
            Number(row.Rating) <= 2200
        ) {
            results.push({
                id: row.PuzzleId,
                fen: row.FEN,
                moves: row.Moves.split(" "),
                rating: Number(row.Rating),
            });
        }
    })
    .on("end", () => {
        fs.writeFileSync(
            "assets/puzzles_500.json",
            JSON.stringify(results, null, 2)
        );
        console.log("✅ Fertig:", results.length, "Puzzles");
    });