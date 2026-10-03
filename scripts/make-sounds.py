#!/usr/bin/env python3
"""Creates the game sounds in assets/sounds from scratch (no recordings).

Run from the project folder:   python scripts/make-sounds.py            (set "felt")
                               python scripts/make-sounds.py crisp
                               python scripts/make-sounds.py heavy
Needs:                         pip install numpy

How the sounds are made
-----------------------
Nothing here is a melody or a pure tone. Every sound is a chess piece (or the
chess clock) touching something, built the way the real thing works:

  1. The contact: a very short push (harder material = shorter push) with a
     little noise in it.
  2. The wood answers: that push rings a few dozen quickly fading vibrations
     of the board and of the piece. Their pitches are irregular, so the ear
     hears "thock", not a note.
  3. A piece rarely lands flat: one or two tiny after-bounces follow.
  4. The room: a few faint reflections, so it does not sound like a speaker.

Each move sound exists in several slightly different versions; the app picks
one at random, so two moves never sound exactly alike.
"""

import os
import sys
import wave

import numpy as np

RATE = 44100
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

# Three characters. "felt" is what the app ships with.
SETS = {
    # push_ms      how long the contact lasts (soft material = longer = duller)
    # board        range of the board's vibrations in Hz, board_ring how long the lowest one lasts
    # piece        range of the piece's own vibrations
    # body / knock / click   how loud the three parts of a contact are:
    #              the board ringing, the piece ringing, the contact noise
    # top          highest frequency of the contact noise
    #
    # Tournament pieces with felt under them on a wooden board: warm and soft.
    "felt": dict(push_ms=0.40, board=(300, 1900), board_ring=0.048, piece=(1700, 4800), piece_ring=0.026,
                 body=1.0, knock=0.55, click=0.40, top=7000, room=0.8),
    # Bare hardwood on hardwood: bright and crisp.
    "crisp": dict(push_ms=0.16, board=(430, 2700), board_ring=0.038, piece=(2200, 6500), piece_ring=0.017,
                  body=0.85, knock=0.80, click=0.80, top=11000, room=1.0),
    # Big weighted pieces on a thick board: deep and calm.
    "heavy": dict(push_ms=0.60, board=(270, 1500), board_ring=0.050, piece=(1300, 3800), piece_ring=0.028,
                  body=1.0, knock=0.40, click=0.28, top=6000, room=1.0),
}


class Maker:
    def __init__(self, name, seed=11):
        self.cfg = SETS[name]
        self.rng = np.random.default_rng(seed)
        self.room_ir = self._room()

    # ---------- building blocks ----------

    def _modes(self, low, high, count, ring):
        """Irregularly spaced vibrations between low and high (Hz)."""
        freqs = np.exp(self.rng.uniform(np.log(low), np.log(high), count))
        freqs.sort()
        modes = []
        for freq in freqs:
            level = (low / freq) ** 0.25 * self.rng.uniform(0.5, 1.0)
            # Higher vibrations die faster - that is what makes wood sound like wood.
            # All of them die quickly: wood that rings long sounds like a xylophone.
            t60 = ring * (low / freq) ** 0.55 * self.rng.uniform(0.75, 1.1)
            modes.append((freq, level, max(0.004, t60)))
        return modes

    def _ring(self, push, modes, seconds, pitch=1.0):
        """What the vibrations do when they are pushed. Loudest point = 1."""
        count = int(RATE * seconds)
        t = np.arange(count) / RATE
        answer = np.zeros(count)
        for freq, level, t60 in modes:
            # Every vibration starts at its own point of the swing; started
            # together they would add up to one hard electronic click.
            answer += level * np.exp(-6.91 * t / t60) * np.sin(2 * np.pi * freq * pitch * t + self.rng.uniform(0, 2 * np.pi))
        out = np.convolve(push, answer)[:count]
        return out / (np.max(np.abs(out)) + 1e-9)

    def _push(self, hardness=1.0):
        """The contact itself: a very short push."""
        count = max(4, int(RATE * self.cfg["push_ms"] / hardness / 1000))
        return np.hanning(count + 2)[1:-1]

    def _noise(self, seconds, low, high):
        count = int(RATE * seconds)
        spectrum = np.fft.rfft(self.rng.standard_normal(count))
        freqs = np.fft.rfftfreq(count, 1 / RATE)
        # Soft band edges - hard edges would ring.
        shape = 1 / (1 + (low / np.maximum(freqs, 1)) ** 4) / (1 + (freqs / high) ** 4)
        noise = np.fft.irfft(spectrum * shape, count)
        return noise / (np.max(np.abs(noise)) + 1e-9)

    def _room(self):
        """A small room: a handful of faint reflections and a short tail."""
        count = int(RATE * 0.16)
        ir = np.zeros(count)
        ir[0] = 1.0
        amount = self.cfg["room"]
        for _ in range(12):
            delay = self.rng.uniform(0.006, 0.036)
            ir[int(delay * RATE)] += amount * 0.075 * np.exp(-delay / 0.018) * self.rng.choice([-1, 1])
        t = np.arange(count) / RATE
        tail = self.rng.standard_normal(count) * np.exp(-t / 0.030) * (t > 0.012)
        tail = np.convolve(tail, np.ones(10) / 10, mode="same")  # reflections are duller than the sound
        ir += amount * 0.014 * tail / (np.max(np.abs(tail)) + 1e-9)
        return ir

    # ---------- things that happen on a board ----------

    def place(self, strength=1.0, pitch=1.0, hardness=1.0, bounces=None, seconds=0.20):
        """A piece is set down."""
        cfg = self.cfg
        pitch *= self.rng.uniform(0.95, 1.05)
        board = self._modes(*cfg["board"], count=30, ring=cfg["board_ring"])
        piece = self._modes(*cfg["piece"], count=16, ring=cfg["piece_ring"])
        t = np.arange(int(RATE * seconds)) / RATE

        def one(level, hard):
            push = self._push(hardness * hard)
            # Three parts: the board rings, the piece rings, the contact itself.
            out = cfg["body"] * self._ring(push, board, seconds, pitch)
            out += cfg["knock"] * hard * self._ring(push, piece, seconds, pitch)
            out += cfg["click"] * hard * self._noise(seconds, 1200, cfg["top"]) * np.exp(-t / 0.0028)
            return level * out

        out = one(strength, 1.0)

        # A piece rocks once or twice before it stands still.
        if bounces is None:
            bounces = self.rng.choice([1, 1, 2])
        at = 0.0
        level = strength
        for _ in range(bounces):
            at += self.rng.uniform(0.010, 0.024)
            level *= self.rng.uniform(0.14, 0.26)
            out = lay((0, out), (at, one(level, 0.8)))

        return out

    def clack(self, strength=1.0, pitch=1.0):
        """Piece against piece."""
        cfg = self.cfg
        seconds = 0.10
        piece = self._modes(cfg["piece"][0] * 0.75, cfg["piece"][1] * 1.1, count=20, ring=cfg["piece_ring"] * 1.3)
        t = np.arange(int(RATE * seconds)) / RATE
        out = self._ring(self._push(2.0), piece, seconds, pitch * self.rng.uniform(0.94, 1.06))
        out += 0.5 * self._noise(seconds, 1800, cfg["top"] * 1.2) * np.exp(-t / 0.0022)
        return strength * out

    def slide(self, seconds=0.09, level=0.10):
        """A piece pushed across the board."""
        noise = self._noise(seconds, 500, 3500)
        count = len(noise)
        rough = 0.6 + 0.4 * np.abs(np.convolve(self.rng.standard_normal(count), np.ones(180) / 180, mode="same")) * 12
        return level * noise * np.hanning(count) * np.minimum(rough, 1.6)

    def clock(self, strength=1.0, pitch=1.0):
        """The button of a chess clock: press and latch."""
        metal = [(f * pitch, g, r) for f, g, r in [(2150, 1.0, 0.030), (3320, 0.8, 0.026), (4710, 0.6, 0.020), (6100, 0.4, 0.015)]]
        body = self._modes(450, 1600, count=12, ring=0.050)
        seconds = 0.12
        t = np.arange(int(RATE * seconds)) / RATE
        out = np.zeros(int(RATE * 0.16))
        for at, level in ((0.0, 0.5), (0.031, 1.0)):
            push = self._push(3.0)
            hit = 0.7 * self._ring(push, metal, seconds) + self._ring(push, body, seconds, pitch)
            hit += 0.5 * self._noise(seconds, 2000, 9000) * np.exp(-t / 0.002)
            out = lay((0, out), (at, level * strength * hit))
        return out

    def topple(self):
        """The king falls over and comes to rest."""
        parts = []
        at = 0.0
        gap = 0.17
        level = 0.85
        while gap > 0.018 and level > 0.03:
            pitch = self.rng.uniform(0.9, 1.25)
            hit = 0.6 * self.clack(level, pitch) if len(parts) % 2 else self.place(level, pitch, hardness=1.5, bounces=0, seconds=0.16)
            parts.append((at, hit))
            at += gap
            gap *= self.rng.uniform(0.66, 0.76)
            level *= self.rng.uniform(0.62, 0.74)
        return lay(*parts)

    # ---------- finishing ----------

    def finish(self, samples, loudness):
        """Adds the room and sets the loudness.

        loudness is measured over the loudest 30 ms, not at the single highest
        point - so all versions of a sound are equally loud to the ear.
        """
        out = np.convolve(samples, self.room_ir)
        out -= np.mean(out)

        # Trim the silent end.
        loud = np.nonzero(np.abs(out) > np.max(np.abs(out)) * 0.004)[0]
        out = out[: min(len(out), loud[-1] + int(RATE * 0.015))]

        window = int(RATE * 0.030)
        power = np.convolve(out ** 2, np.ones(window) / window)
        out *= loudness / np.sqrt(np.max(power))

        out = np.tanh(out * 1.15) / 1.15  # soft limit: peaks stay below full scale
        fade = int(RATE * 0.012)
        out[-fade:] *= np.linspace(1, 0, fade) ** 2
        return out


def lay(*parts):
    """parts: (start seconds, samples). Returns them laid over each other."""
    length = max(int(start * RATE) + len(samples) for start, samples in parts)
    out = np.zeros(length)
    for start, samples in parts:
        begin = int(start * RATE)
        out[begin:begin + len(samples)] += samples
    return out


def build(name):
    """All sounds of one set: {file name: samples}."""
    m = Maker(name)
    sounds = {}

    # A move: a piece is set down. Four versions.
    for i, (strength, pitch) in enumerate([(0.80, 1.00), (0.72, 1.06), (0.88, 0.95), (0.76, 1.02)], 1):
        sounds[f"move-{i}"] = m.finish(m.place(strength, pitch), 0.150)

    # A capture: piece knocks against piece, then lands - louder than a move.
    for i, (gap, pitch) in enumerate([(0.050, 1.00), (0.042, 0.95), (0.058, 1.05)], 1):
        sounds[f"capture-{i}"] = m.finish(lay(
            (0.000, 0.75 * m.clack(1.0, pitch)),
            (gap, m.place(1.15, pitch * 0.96, hardness=1.25)),
        ), 0.200)

    # Castling: king, then rook.
    for i, gap in enumerate([0.115, 0.135], 1):
        sounds[f"castle-{i}"] = m.finish(lay(
            (0.000, m.place(0.80, 1.03)),
            (gap, m.place(0.86, 0.94)),
        ), 0.150)

    # Check: the piece is put down hard - sharper and louder, with a clear after-bounce.
    sounds["check"] = m.finish(lay(
        (0.000, m.place(1.5, 1.04, hardness=1.9, bounces=0)),
        (0.000, 0.30 * m.clack(1.0, 1.1)),
        (0.034, m.place(0.42, 1.10, hardness=1.5, bounces=1)),
    ), 0.240)

    # Checkmate: the last move lands, then the king falls over.
    sounds["checkmate"] = m.finish(lay(
        (0.000, m.place(1.6, 0.95, hardness=1.7, bounces=1)),
        (0.230, 1.25 * m.topple()),
    ), 0.240)

    # Promotion: the pawn slides to the last rank, the new piece lands with weight.
    sounds["promotion"] = m.finish(lay(
        (0.000, m.slide(0.10, 0.24)),
        (0.085, 0.45 * m.clack(0.8, 1.15)),
        (0.190, m.place(1.25, 0.90, hardness=1.2, bounces=2)),
    ), 0.190)

    # Premove: a finger taps the piece - quiet and dull.
    sounds["premove"] = m.finish(m.place(0.35, 1.25, hardness=0.55, bounces=0, seconds=0.10), 0.055)

    # The chess clock starts ... and is stopped.
    sounds["game-start"] = m.finish(m.clock(1.0, 1.0), 0.120)
    sounds["game-end"] = m.finish(lay((0.000, m.clock(1.0, 0.86)), (0.200, 0.9 * m.clock(0.9, 0.80))), 0.120)

    return sounds


def save(path, samples):
    data = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(data.tobytes())


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else "felt"
    if name not in SETS:
        sys.exit(f"Unknown set '{name}'. Choose one of: {', '.join(SETS)}")

    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "assets", "sounds")
    os.makedirs(out, exist_ok=True)

    for file, samples in build(name).items():
        save(os.path.join(out, file + ".wav"), samples)
        print(f"{file + '.wav':16} {len(samples) / RATE * 1000:5.0f} ms")

    print(f"Set '{name}' written to {os.path.normpath(out)}")


if __name__ == "__main__":
    main()
