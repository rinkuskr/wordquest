# Game lifecycle and offline behavior

- Category data, grid generation, scoring, hints, bonus-word checks, and saves
  run locally. A network connection is not required to play.
- The timer runs only while the game screen is foregrounded and the app is
  active. It pauses on navigation away or app backgrounding, then resumes from
  its accumulated timestamp when the game screen returns.
- Local progress is versioned and normalized on load. Invalid JSON returns the
  initial 300-coin save; unknown category IDs and malformed fields are ignored.
- Audio assets are original, synthesized WAV tones bundled with the app. The
  eight assets total less than 500 KB.
- All 15 category word lists are bundled locally. They are reconstructed from
  the supplied category topics because the attached specification contains no
  per-category arrays.
