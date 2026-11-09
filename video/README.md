# Basket film

A 120-second product film built on one 96 BPM clock: `plan.py` places every element and sound on
the grid and writes `timeline.json`; `film.js` draws any frame as a pure function of time;
`score.py` synthesizes the soundtrack from the same timeline, so every hit in the picture is a hit
in the sound. Every number on screen and in the narration comes from the demo household
(`numbers.ts`, Basket's own domain code) and the screens are captured from production.

```bash
pnpm dlx tsx --tsconfig tsconfig.json video/numbers.ts <ledger.json> video/numbers.json  # from repo root
cd video
node capture.mjs                                  # real screens at 2x from the production demo
node --env-file=../.env.local voice.mjs           # narration (OpenAI speech), cached per line
python3 plan.py                                   # timeline.json
python3 score.py                                  # out/score.wav
node render.mjs --stills 12.5,45                  # review frames
node render.mjs --check                           # revisit frames out of order and compare
node render.mjs                                   # out/picture.mp4
node mix.mjs                                      # out/basket-film.mp4 at -14 LUFS
```
