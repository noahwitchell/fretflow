# FretFlow — notes for Claude

- Owner: Noah. Goal: a true companion app for ear training / perfect pitch and for seeing
  how chords fit together to write music. Phone first (installed PWA), also works on desktop.
- No build step, no frameworks, no npm deps. ES modules served statically.
- Dev server: `.claude/launch.json` in ~/Claude has `fretflow` (python http.server 5181).
- Keep the chromatic colour map (C red … B rose) as the default: Noah trains associations on it.
- Each tab is an interface experiment; Noah is still choosing which ideas to keep.
- Verify in the browser preview at phone size (375×812) and desktop before handing back.
- Commit after each meaningful change; repo is private (github.com/noahwitchell/fretflow).
