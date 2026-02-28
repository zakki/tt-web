/*
 * Runtime asset bootstrap for Web port.
 *
 * Note:
 * - This file intentionally avoids `import.meta.glob` because current TS config
 *   is `module: NodeNext` and typecheck is executed in CJS-compatible mode.
 */

import { registerBarrageManifest, registerMusicFiles } from "./runtimeassets";
import { BulletMLParserAsset } from "../util/bulletml/runtime";

const MUSIC_FILES = ["tt1.ogg", "tt2.ogg", "tt3.ogg", "tt4.ogg"];

const BARRAGE_FILES: Record<string, string[]> = {
  basic: ["straight.xml"],
  middle: [
    "35way.xml",
    "alt_nway.xml",
    "alt_sideshot.xml",
    "backword_spread.xml",
    "clow_rocket.xml",
    "diamondnway.xml",
    "fast_aim.xml",
    "forward_1way.xml",
    "grow.xml",
    "grow3way.xml",
    "nway.xml",
    "random_fire.xml",
    "spread2blt.xml",
    "squirt.xml",
  ],
  morph: [
    "0to1.xml",
    "accel.xml",
    "accelshot.xml",
    "bar.xml",
    "divide.xml",
    "fast.xml",
    "fire_slowshot.xml",
    "slide.xml",
    "slowdown.xml",
    "speed_rnd.xml",
    "twin.xml",
    "wedge_half.xml",
    "wide.xml",
  ],
};

export async function setupRuntimeAssets(): Promise<void> {
  registerMusicFiles(MUSIC_FILES);
  const manifest = createBarrageManifest();
  registerBarrageManifest(manifest);
  await preloadBarrageManifest(manifest);
}

function createBarrageManifest(): Record<string, Record<string, BulletMLParserAsset>> {
  const manifest: Record<string, Record<string, BulletMLParserAsset>> = {};
  for (const [dirName, files] of Object.entries(BARRAGE_FILES)) {
    manifest[dirName] = {};
    for (const fileName of files) {
      manifest[dirName][fileName] = new BulletMLParserAsset(
        `${dirName}/${fileName}`,
        `barrage/${dirName}/${fileName}`,
      );
    }
  }
  return manifest;
}

async function preloadBarrageManifest(manifest: Record<string, Record<string, BulletMLParserAsset>>): Promise<void> {
  if (typeof fetch !== "function" || typeof DOMParser === "undefined") return;
  const tasks: Promise<void>[] = [];
  for (const files of Object.values(manifest)) {
    for (const parser of Object.values(files)) {
      tasks.push(parser.preload());
    }
  }
  await Promise.all(tasks);
}
