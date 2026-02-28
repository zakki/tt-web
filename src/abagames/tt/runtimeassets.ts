/*
 * Runtime asset registration helpers for Web port.
 */

import { BarrageManager } from "./barrage";
import { setBulletMLRunnerFactory } from "./bulletmlbridge";
import { SoundManager } from "./soundmanager";
import type { BulletMLRunner, BulletMLState } from "../util/bulletml/bullet";

export function registerBarrageParser(dirName: string, fileName: string, parser: unknown): void {
  BarrageManager.register(dirName, fileName, parser);
}

export function registerBarrageManifest(
  manifest: Record<string, Record<string, unknown>>,
): void {
  for (const [dirName, files] of Object.entries(manifest)) {
    for (const [fileName, parser] of Object.entries(files)) {
      registerBarrageParser(dirName, fileName, parser);
    }
  }
}

export function registerMusicFiles(files: string[]): void {
  SoundManager.registerMusicFiles(files);
}

export function registerBulletMLRunnerFactory(factory: {
  createRunnerFromParser?: (parser: unknown) => BulletMLRunner;
  createRunnerFromState?: (state: BulletMLState) => BulletMLRunner;
}): void {
  setBulletMLRunnerFactory(factory);
}

/**
 * Registers runtime assets from globals, if provided by host app.
 */
export function initializeRuntimeAssetsFromGlobals(): void {
  if (typeof globalThis === "undefined") return;
  const g = globalThis as unknown as {
    __ttBarrageParsers?: Record<string, Record<string, unknown>>;
    __ttMusicFiles?: string[];
    __ttBulletMLRunnerFactory?: {
      createRunnerFromParser?: (parser: unknown) => BulletMLRunner;
      createRunnerFromState?: (state: BulletMLState) => BulletMLRunner;
    };
  };
  if (g.__ttBarrageParsers) registerBarrageManifest(g.__ttBarrageParsers);
  if (Array.isArray(g.__ttMusicFiles)) registerMusicFiles(g.__ttMusicFiles);
  if (g.__ttBulletMLRunnerFactory) {
    registerBulletMLRunnerFactory(g.__ttBulletMLRunnerFactory);
  }
}
