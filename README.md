# ☕ The Great Tea Machine

*Build it. Test it. Brew it.*

A single-file browser game where you build a tea-making machine one engineering
discipline at a time — **mechanical**, **electrical**, and **chemical** — and
finish with a steaming cup of tea and a *Certified Tea Engineer* certificate.

Made for curious kids and teens (roughly ages 8–16): every stage is a
build-and-test puzzle based on a **real engineering concept**, explained along
the way by your mentor, Professor Pekoe.

## How to play

**No install, no build, no internet needed.** The whole game is one file:

- **Play online:** the repo auto-deploys to GitHub Pages at
  `https://mrbilalshah.github.io/tea/` (see `.github/workflows/pages.yml`).
- **Double-click `index.html`** — it opens and runs in any modern browser
  (Chrome, Edge, Firefox, Safari), on desktop or tablet.
- Or serve it, e.g. `npx http-server` and open `http://localhost:8080`.

Progress (and your machine's settings) are saved automatically in the browser.
When served over the web it's also an installable PWA that works offline after
the first visit.

> If the Pages deploy workflow can't auto-enable Pages, do it once manually:
> **Settings → Pages → Source: GitHub Actions**, then re-run the workflow.

## The five stages

| # | Stage | Discipline | You build… | Real concept |
|---|-------|-----------|------------|--------------|
| 1 | Gear Grinder | Mechanical | A gear train (compound axle + chain drives) to speed a 20 RPM crank up to 60–80 RPM | **Gear ratios** — trading force for speed |
| 2 | Screw Lift | Mechanical | An Archimedes screw (tilt, thread pitch, spin speed) to lift ground tea into the pot | **The Archimedes screw** — a ramp wrapped around a pole |
| 3 | Boiler Circuit | Electrical | A battery + switch + heating-coil circuit; wire coils solo, in series, or in parallel — but don't short it or blow the 70 W fuse | **Ohm's law** (I = V÷R) and **electrical power** (P = V²÷R) |
| 4 | Brew Lab | Chemical | The perfect steep: pick a temperature and pull the leaves at the right moment for your tea order | **Diffusion** — faster when hot; oversteeping = bitterness |
| 5 | Grand Assembly | Systems | Milk & sugar to order (with a saturation gag), then THE BIG LEVER runs your whole machine end-to-end with the settings *you* chose | **Systems engineering** |

Every puzzle has multiple valid solutions, honest failure modes (jams, shorts,
blown fuses, scorched tea…), and a "Concept unlocked!" card naming the real
idea — followed by a friendly one-question concept check. Retries are
celebrated, because that's how engineering works.

## Beyond the first cup

- **Per-stage star ratings** (precision + first-try bonus) shown on the map.
- **Randomized targets** — "Brew another cup" re-rolls the RPM band, the power
  band, and the lift target, so every playthrough is a new engineering job.
- **Engineer Mode** (unlocked after your first certificate): narrower
  tolerances and no recipe hints on the order card.
- **Tinker Workshop** (also unlocked at the end): free sandbox where controls
  stay live *during* the run — no targets, just cause and effect.
- **Lab Notebook**: every unlocked concept with a diagram, the Tea-o-pedia
  reference, and a **"Show the maths"** toggle that overlays the live formulas
  on each stage (great for classrooms).
- **Certificate**: add your name and print it.
- **Accessibility**: colorblind-safe gauge markings (✓/hatching, not just
  color), `prefers-reduced-motion` support, and gentle generative music and
  sound with separate toggles.
- **Made for mobile**: on phones the game auto-rotates its render — hold the
  phone any way, turn it sideways, and it just works (even with rotation lock
  on). Touch targets grow at small sizes, and a ⛶ button enters fullscreen
  with a landscape lock where the browser supports it.

## Tech notes

- One self-contained `index.html`: vanilla JavaScript + Canvas, zero
  dependencies, zero assets, zero network requests.
- All graphics drawn in code; all sounds synthesized with WebAudio (toggle in
  the top-right corner).
- Works with mouse or touch; `Enter` runs / continues, `Esc` returns to the map.
- The circuit stage runs a genuine (tiny) nodal-analysis solver, so series /
  parallel / short circuits emerge from the wiring rather than being hard-coded.

## Development

Dev-only test scripts (require Node + Playwright; not needed to play):

```bash
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/smoke.mjs        # load + zero-error + screenshots
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/playthrough.mjs  # drives all 5 stages, win & fail paths
```

The game exposes a small debug API in the console: `TTM.goto('circuit')`,
`TTM.setParams({...})`, `TTM.pressRun()`, `TTM.state()`.
