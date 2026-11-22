// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// The game is Sunset City: an original top-down open-world crime caper in the spirit of the
// genre - a procedural coastal city with a road grid, pavements, buildings, parks, street
// props, a beach and an ocean edge; on foot and behind the wheel; NPC traffic, pedestrians,
// a wanted level and police chases; a horn that scatters the street; a job system run from a
// phone on the boardwalk, including a two-part heist and a taxi run; gulls over the bay; and
// a pause that holds the world where it stands. Every pixel is drawn with canvas primitives,
// so there is no asset to ship and nothing to download.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
// The old copy is cleared first, so a file that has been renamed or removed from
// game/ does not survive in the output and inflate the entry.
rmSync(join(out, 'game'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// The build's own receipt: read back what was written and say so, so a run either
// prints its numbers or fails - silent builds are the ones nobody checks.
const dossier = JSON.parse(readFileSync(dossierPath, 'utf8')) as {
  text: string;
  images: { name: string; media_type: string }[];
};
const sourceCount = (dossier.text.match(/^### game\//gm) ?? []).length;
console.log(`handed in: ${sourceCount} game sources, ${dossier.images.length} screenshots, dossier.json ${statSync(dossierPath).size} bytes`);
