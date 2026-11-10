# FretFlow

A phone-first companion for hearing and seeing harmony: how chords are built, how they
move, and ear / pitch training with a synesthesia colour layer (every note has a colour).

Plain HTML + JS modules, no build step, no dependencies. Installs to a phone home screen
as a web app (PWA).

## Run it

```bash
python3 -m http.server 5181
```
then open http://localhost:5181 (modules don't load from `file://`).

## Views (interface experiments)

| Tab | Idea |
| --- | --- |
| **Clock** | 12 notes on a clock face. A chord is a shape: every major chord is the same triangle, minor is its mirror, transposing = rotating. Side numbers = half-steps. |
| **Wheel** | Circle of fifths. Majors / relative minors / diminished rings; the key lights up as a wedge of 7 chords and the wheel turns to put the key on top. `7ths` turns every chord into its 7th. |
| **Grid** | Tonnetz. → 5th, ↗ major 3rd, ↖ minor 3rd. Triangles are triads (▲ major, ▼ minor); edge-sharing triangles share 2 notes. P/R/L tag the one-note moves. Progressions draw a path. |
| **Neck** | Chord tones across 15 frets, scale dots for the rest of the key. Vertical chord-chart layout on phones. |
| **Ear** | Quiz (mystery note → name it; per-note accuracy kept) and Imagine (hear it in your head, tap to check). Notes on a ring so pitch, position and colour line up. |

Shared across views: the chord panel (tones, degrees, quality chips to rebuild the chord),
the progression tray (+ Add, play/loop with voice-led voicings), and the settings sheet
(key, labels note/degree, colour flash/hold/off, colour map chromatic/by-fifths).

## Code map

- `js/theory.js` notes, chord types, keys, roman numerals, PLR neighbours, voice leading
- `js/color.js` pitch → colour maps and the background wash
- `js/audio.js` Web Audio pluck synth + reverb
- `js/store.js` state (saved to localStorage) + event bus
- `js/actions.js` select/play chord, progression playback
- `js/views/*.js` one file per tab, each `{ id, mount(el), render() }`
- `legacy/` the original Antigravity single-file version (reference only)
