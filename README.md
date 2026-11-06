# Suwen Shi — The Ion Garden 3D

An academic website and a playable 3D research adventure, sharing the same original content.

- `index.html` opens the academic website. **Explore in 3D** enters the game.
- `game.html` opens the 3D adventure. The **Academic** switch always provides direct access to every original section.

## Explore and play

Choose a **boy explorer** or **girl explorer**, then a sage, rose, or blue field jacket. Both characters have identical abilities. Change the character or jacket anytime using the explorer button; completed missions stay unlocked.

The island has nine research and portfolio landmarks. Each has a short, forgiving mission:

1. Walk into three floating golden memory cores.
2. Shoot two or three noise drones with the ion bow.
3. Defeat the landmark's mini guardian.
4. Open the newly unlocked website section or continue exploring.

The guardians use slow pulse fans, jumpable shockwaves, or short charges. Move the crosshair to aim the ion bow. Keyboard aim assist favors nearby targets when the pointer is outside the arena. If energy runs out, the explorer recharges nearby while retaining the current mission's progress. Completed missions and the character choice are saved in the browser. Partial missions are retained while the page stays open; refreshing restarts unfinished missions.

## Controls

| Action | Controls |
| --- | --- |
| Move in any direction | WASD or arrow keys; relative to the camera |
| Jump | Space |
| Dash | Shift; brief invulnerability and a short cooldown |
| Aim and fire the bow | Move the mouse to aim. Hold F or the left mouse button for unlimited arrows. |
| Start mission / explore a completed landmark | E or Enter |
| Orbit camera | Right-drag, or Q / C |
| Zoom | Mouse wheel |
| Reset camera | R or the camera reset button |
| Mission map / quick travel | M or World map |
| Pause / close dialog | Esc |

Touchscreens have a movement pad, jump, fire, and dash buttons. Tap the arena to aim or drag to orbit the camera. Tap the interaction prompt to start a mission or open an unlocked page. Sound is optional and off initially. The fullscreen button expands the game.

The world map allows travel to every landmark, but reading its content in Adventure mode requires completing its mission. Original academic mode is always directly accessible. The three research environments unlock their respective proposal field notes and the shared Research section.

## Research and original content

The geometry, circuits, and polymer environments summarize the specific aims in the October 5, 2026 revised proposal. Proposed work, preliminary findings, and unconfirmed autonomous polymer oscillations remain clearly distinguished. Scenery, cores, drones, and guardians are artistic metaphors, not scientific simulations.

The original seven website sections, publication JSON, research figures, downloadable files, and all three browser tools are retained. Adventure mode reads those same sections in an embedded viewer, with no duplicated publication or teaching records. The Maker's Lab unlocks the Gamry converter, equation visualizer, and time-series plotter. Each tool has a 30-second video tutorial with three captioned steps and sample data.

## Run or publish

The folder is ready for static hosting, including GitHub Pages. Copy its contents into the existing website repository and publish with the usual workflow. The supplied `CNAME` retains `swshi.org`; change it only if changing the domain.

For local use, serve this directory over HTTP:

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000/game.html`. Opening the HTML directly as a `file:` URL will not load ES modules correctly.

The game has no build step or external asset requests. Three.js 0.170.0 is vendored in `assets/vendor/` with its MIT license. WebGL-capable browsers use hardware rendering with lighting and shadows. A perspective triangle renderer draws the same 3D models when WebGL is unavailable; visual effects and performance vary by device. The original plotting tools retain their original CDN dependencies.

## Source organization

- `assets/js/game.js`: input, interface, character selection, page gates, and saved progress.
- `assets/js/garden-core.js`: mission rules, movement, projectiles, collision, guardians, and retries.
- `assets/js/garden-world.js`: procedural 3D island, models, lights, camera, and effects.
- `assets/js/garden-software.js`: software 3D fallback for browsers without WebGL.
- `assets/js/garden-content.js`: research field notes and landmark settings.
- `assets/js/experience.js`: embedded academic navigation shared with the original website.

Original tool scripts, data, downloads, and images remain unchanged. All persistent gameplay state stays in this browser; the game adds no account, backend, analytics, or uploaded player data.
