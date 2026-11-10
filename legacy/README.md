# FretFlow — Chord Anatomy & Synesthesia Ear Studio (Handoff Guide)

## 1. Project Overview
**FretFlow** is a zero-dependency, offline-ready Progressive Web App (PWA) designed for auditory chord exploration, interval dissection, and multi-octave pitch + chromesthesia (pitch-to-color) ear training across **Octaves 1 through 6**.

### Key Architectural Highlights
- **100% Self-Contained Single-Page App:** All HTML, CSS, Web Audio API synthesis, and application logic live in [`index.html`](./index.html) with zero external libraries or CDN dependencies.
- **Offline Mobile PWA:** Includes [`manifest.json`](./manifest.json) and Service Worker [`sw.js`](./sw.js) (`CACHE_NAME = 'fretflow-v12'`) for full-screen standalone installation on iOS (Safari) and Android (Chrome).
- **Web Audio API Polyphonic Synthesizer:** Uses dual-oscillator (`triangle` + octave `sine`) synthesis with dynamic low-pass filtering (`playNoteFreqOnly` / `playMidiNote`) and a continuous Root + 5th ambient drone (`toggleDrone`).

---

## 2. File Inventory

| File | Path | Purpose |
| :--- | :--- | :--- |
| **`index.html`** | `/Users/noahwitchell/.gemini/antigravity/scratch/guitar-companion/index.html` | Complete application UI, styles, Web Audio synth, Chord Explorer, Ear Trainer, and Synesthesia Color Engine |
| **`manifest.json`** | `/Users/noahwitchell/.gemini/antigravity/scratch/guitar-companion/manifest.json` | PWA metadata, app icons, theme colors, and standalone display settings |
| **`sw.js`** | `/Users/noahwitchell/.gemini/antigravity/scratch/guitar-companion/sw.js` | Offline cache-first Service Worker (`fretflow-v12`) |
| **`README.md`** | `/Users/noahwitchell/.gemini/antigravity/scratch/guitar-companion/README.md` | Handoff documentation, architecture reference, and deployment instructions |
| **`guitar-companion.zip`** | `/Users/noahwitchell/.gemini/antigravity/scratch/guitar-companion/guitar-companion.zip` | Ready-to-upload zip bundle for Netlify Deploys |

---

## 3. Core Features & Modules

### A. Chromesthesia (Pitch ↔ Color Wheel) Engine
Located at the top of [`index.html`](./index.html) (`NOTE_COLOR_WHEEL`, `OCTAVE_SHADE_INFO`, `getSynesthesiaColors`, `triggerSynesthesiaFlash`):
- **12-Note Hue Wheel (`C = 0°` Red → `360°`):**
  - `C` (0° Crimson Red), `C#` (28° Sunset Orange), `D` (54° Golden Yellow), `D#` (88° Chartreuse Lime), `E` (134° Emerald Green), `F` (168° Spring Mint), `F#` (192° Cyan Aqua), `G` (218° Ocean Blue), `G#` (248° Royal Indigo), `A` (276° Amethyst Violet), `A#` (304° Electric Magenta), `B` (334° Rose Pink).
- **Octaves 1–6 Lightness Scaling (`OCTAVE_SHADE_INFO`):**
  - Keeps each note's Hue identical across all octaves while scaling HSL Lightness from deep sub-bass shades (`Oct 1`) to bright luminous shades (`Oct 6`).
- **4 Training Modes (`#synesthesiaModeSelect`):**
  1. `all` — **Flash on All Notes (Train Association):** Pulses the full-screen background wash on every note played (including the Ear Trainer mystery note).
  2. `reveal` — **Blind Mystery Note (Flash on Guess & Free-Play):** Hides the color flash when the Ear Trainer mystery note plays so the color does not give away the answer; flashes upon guessing or using Free-Play.
  3. `hold` — **Hold Last Note Color on Screen:** Sustains the background color wash of each note until the next note is played.
  4. `off` — **Color Flash Off:** Disables full-screen background transitions.

### B. Tab 1: `🎹 Chord Explorer` (`#viewChords`)
- **Chord Anatomy Card (Top):**
  - Displays the active chord name, octave, interval formula badge, and a plain-English explanation of how the chord modifies a baseline Major or Minor triad.
  - Renders individual clickable chord-tone pills (`1`, `3/b3/2/4`, `5/b5/#5`, `6/b7/7/bb7`, `9/#9`) tinted with each note's exact synesthesia color. Tapping any pill isolates and plays that single chord tone.
- **Single Chord Builder (All-Button Interface):**
  - **Play Controls:** `▶ Play Arpeggio` (steps through each chord tone and its synesthesia color sequentially), `🎹 Play Block` (plays all chord tones simultaneously), and `Auto-Play on Button Tap` checkbox.
  - **Root Key Grid:** 12 buttons (`C` through `B`) with synesthesia hue underlines.
  - **Chord Octave Switcher:** Direct `Oct 1`–`Oct 6` buttons + `◀ Down` / `Up ▶` step buttons.
  - **Chord Type Grid (23 Varieties in `CHORD_TYPES`):** `Major`, `Minor`, `Power 5`, `Sus 2`, `Sus 4`, `Dim Triad`, `Augmented`, `Major 6`, `Minor 6`, `Maj add9`, `Min add9`, `Dom 7`, `Major 7`, `Minor 7`, `Min-Maj 7`, `7sus4`, `Half-Dim (m7b5)`, `Dim 7`, `Aug 7 (7#5)`, `Dom 9`, `Minor 9`, `Major 9`, and `7#9 Hendrix`.

### C. Tab 2: `🌈 Ear & Note Explorer` (`#viewEar`)
- **Panel 1 — Multi-Octave Ear Trainer (`Listen → Identify`):**
  - Generates a mystery note within the selected octave range (Single Octave `Oct 1`–`Oct 6`, 2-Octave pairs, 3/4-Octave spans, or All 6 Octaves `C1–B6`) and note pool (C Major Diatonic, C Major Pentatonic, or All 12 Chromatic Notes).
  - Left button group: `🎵 C4 Anchor (Red)` + `▶ Play`. Right button group: `🔄 New Note` + `🎯 Fold to C4`.
  - Independent `Oct 1`–`Oct 6` selector bar and color-coded answer buttons. Tracks score and streak in `localStorage` (`fretflow_ear_stats`).
- **Panel 2 — Free-Play Note & Color Explorer (`Imagine → Verify Pitch`):**
  - Score-free sandbox designed for reverse ear training: imagine a note's pitch and color first, then tap its button (`C`–`B` across `Oct 1`–`Oct 6`) to hear and see if your internal pitch matches reality without affecting your Ear Trainer score or active mystery note.

---

## 4. How to Run, Deploy, and Update

### Local Browser Testing
Open the file directly in any desktop browser:
```text
file:///Users/noahwitchell/.gemini/antigravity/scratch/guitar-companion/index.html
```

### Updating Your Existing Netlify Site
1. Whenever changes are made to `index.html`, bump `CACHE_NAME` in `sw.js` (e.g., `fretflow-v13`) and re-zip:
   ```bash
   cd /Users/noahwitchell/.gemini/antigravity/scratch/guitar-companion
   zip -r guitar-companion.zip index.html manifest.json sw.js README.md
   ```
2. Log into [app.netlify.com](https://app.netlify.com), click your **existing project**, click **Deploys** in the left sidebar, and drag `guitar-companion.zip` into the deploy upload box.

### Installing on Mobile (iOS & Android)
- **iPhone (Safari):** Open your `.netlify.app` URL in Safari → Tap **Share (`⬆️`)** → **Add to Home Screen**.
- **Android (Chrome):** Open your `.netlify.app` URL in Chrome → Tap **`⋮`** → **Add to Home screen / Install app**.
