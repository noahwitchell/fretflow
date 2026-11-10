# FretFlow

**Open on your phone: https://noahwitchell.github.io/fretflow/**
iPhone: Safari → Share → *Add to Home Screen*. Android: Chrome → ⋮ → *Install app*.

A companion for hearing and seeing harmony: how chords are built, how they move, and
ear / pitch training with a synesthesia colour layer (every note has a colour).
Plain HTML + JS modules, no build step, no dependencies, works offline once installed.

## Chord views

Every tab has a **?** guide (shown automatically the first time).

| Tab | Idea |
| --- | --- |
| **Clock** | Chord builder on the colour wheel: tap notes one at a time (each plays alone), the shape grows and the chord is named, plus its colour-theory name (triad, complementary, analogous…). Tap the middle to hear them together. |
| **Wheel** | Circle of fifths. Drag to turn it: the lit wedge at the top is the key's chord family. A strip below shows the key's 7 notes and its 7 chords (with roles: home, away, tension…); a banner names the one note that changes when you turn to the next key. |
| **Moves** | Your chord on the 12-note ring above a fixed palette (the key's 7 chords + 6 common borrowed ones). Each button shows ● per note shared with where you are and which notes would move; tapping slides those notes on the ring and in sound. Your path becomes a progression. |
| **Grid** | Every note across 4 octaves (rows = octaves). Tap exact pitches to build chords anywhere; it names the inversion (C/E = 1st inversion) and shows the interval between each stacked note. Invert ↑/↓ moves the bottom/top note an octave. On phones it stands upright (one column per octave, B on top) for big buttons; ⇆ switches layouts. |

Tapping a chord plays its notes one by one, then together (Settings → *Tapping a chord plays*).
Settings (tap the key): key, note names vs degrees, colour flash/hold/off, and the colour
map. **Chromatic** (C red → B rose) or **By fifths**, where colour harmony lines up with musical
harmony: neighbouring colours are a 5th apart, a key is one unbroken sweep, opposite = tritone.

## Ear training (Ear tab)

- **Notes**: name the note. Answer buttons are plain grey (no colour-matching shortcut); the right one lights up after you answer. *Grow* starts with 3 far-apart notes and unlocks the next at 90% over 20 answers.
  Options: octave range, timbre (guitar / piano / pure / mix), noise between notes (stops you
  working it out from the last note). Everything stays dark until you find the right note: the colour is the reward. A miss lets you retry (only the first guess is scored); Show answer gives up. Answer time is shown; real pitch memory is instant.
- **Degrees**: a I–IV–V–I sets the key, a note plays, name its degree (1–7 or all 12, with solfège), then it resolves home.
- **Sing**: one continuous session: a note appears, you sing from memory and slide until you hold it within tolerance (±15/30/50¢) for ~0.5 s; the colour reward and the real note follow, then the next note. Your first steady pitch is logged as the memory score. Hear it / Skip when stuck. Also a live tuner with colour. (iOS: the audio session switches to play-and-record while listening; 'playback' blocks the mic.)
- **Imagine**: hear a note in your head, then tap to check. Includes your anchor library (a known sound per note).
- **Progress**: day streak, minutes, 14-day chart, mix-ups grid, per-note accuracy/speed.

Background research: adults *can* sometimes learn absolute pitch (Wong et al. 2020: 6 of 43 reached
90%+ after 12–40 h; Van Hedger et al. 2019), most people have latent pitch memory (Levitin 1994),
and relative pitch is best trained in key context.

## Develop

```bash
python3 -m http.server 5181   # then http://localhost:5181
```
Pushing `main` deploys (GitHub Pages). Bump `CACHE` in `sw.js` when shipping.

- `js/theory.js` notes, chords, keys, roman numerals, PLR, voice leading
- `js/color.js` pitch → colour, colour-scheme names, washes
- `js/audio.js` synth (guitar / piano / sine) + noise scramble
- `js/views/*` chord views and the Ear shell; `js/ear/*` the five ear modes, pitch detector, practice log
- `tools/make_icon.py`, `tools/render_icons.sh` app icon
- `legacy/` the original Antigravity single-file version
