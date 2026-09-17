const sharp = require("sharp");

sharp("assets/images/gold_edge.png")
    .modulate({ hue: 200 }) // Farbton-Drehung in Grad - siehe unten
    .toFile("assets/images/diamond_edge.png")
    .then(() => console.log("diamond_edge.png erstellt"))
    .catch(console.error);