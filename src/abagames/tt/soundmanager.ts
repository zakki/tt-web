/*
 * Ported from tt/src/abagames/tt/soundmanager.d
 */

import { Rand } from "../util/rand";
import { Logger } from "../util/logger";
import { Chunk, Music, SoundManager as SDLSoundManager } from "../util/sdl/sound";

/**
 * Manage BGMs and SEs.
 */
export class SoundManager extends SDLSoundManager {
  private static readonly seFileName = [
    "shot.wav",
    "charge.wav",
    "charge_shot.wav",
    "hit.wav",
    "small_dest.wav",
    "middle_dest.wav",
    "boss_dest.wav",
    "myship_dest.wav",
    "extend.wav",
    "timeup_beep.wav",
  ];
  private static readonly seChannel = [0, 1, 1, 2, 3, 4, 4, 5, 6, 7];
  private static rand = new Rand();
  private static bgm: Music[] = [];
  private static se = new Map<string, Chunk>();
  private static prevBgmIdx = -1;
  private static nextIdxMv = 1;
  private static seDisabled = false;

  public static loadSounds(): void {
    this.bgm = this.loadMusics();
    this.se = this.loadChunks();
    this.prevBgmIdx = -1;
    this.rand = new Rand();
  }

  public static setRandSeed(seed: number): void {
    this.rand.setSeed(seed);
  }

  private static loadMusics(): Music[] {
    // Keep already-registered musics (e.g. asset bootstrap path) intact.
    if (this.bgm.length > 0) return this.bgm;

    /*
     * D source:
     *   char[][] files = listdir(Music.dir);
     *   foreach (char[] fileName; files) { ... music.load(fileName); ... }
     *
     * Browser TS version cannot list runtime assets from filesystem.
     * Use `registerMusicFiles()` to provide concrete file names.
     */
    const files = readMusicManifest();
    if (files) {
      this.registerMusicFiles(files);
      return this.bgm;
    }
    return [];
  }

  public static registerMusicFiles(files: string[]): void {
    this.bgm = [];
    for (const fileName of files) {
      const lower = fileName.toLowerCase();
      if (!lower.endsWith(".ogg") && !lower.endsWith(".wav")) continue;
      const music = new Music();
      music.load(fileName);
      this.bgm.push(music);
      Logger.info(`Load bgm: ${fileName}`);
    }
  }

  private static loadChunks(): Map<string, Chunk> {
    const chunks = new Map<string, Chunk>();
    for (let i = 0; i < this.seFileName.length; i++) {
      const fileName = this.seFileName[i];
      const chunk = new Chunk();
      chunk.load(fileName, this.seChannel[i]);
      chunks.set(fileName, chunk);
      Logger.info(`Load SE: ${fileName}`);
    }
    return chunks;
  }

  public static playBgm(): void {
    if (this.bgm.length <= 0) return;
    let bgmIdx = this.rand.nextInt(this.bgm.length);
    this.nextIdxMv = this.rand.nextInt(2) * 2 - 1;
    if (bgmIdx === this.prevBgmIdx) {
      bgmIdx++;
      if (bgmIdx >= this.bgm.length) bgmIdx = 0;
    }
    this.prevBgmIdx = bgmIdx;
    this.bgm[bgmIdx].play();
  }

  public static nextBgm(): void {
    if (this.bgm.length <= 0) return;
    let bgmIdx = this.prevBgmIdx + this.nextIdxMv;
    if (bgmIdx < 0) bgmIdx = this.bgm.length - 1;
    else if (bgmIdx >= this.bgm.length) bgmIdx = 0;
    this.prevBgmIdx = bgmIdx;
    this.bgm[bgmIdx].play();
  }

  public static fadeBgm(): void {
    Music.fadeMusic();
  }

  public static haltBgm(): void {
    Music.haltMusic();
  }

  public static playSe(name: string): void {
    if (this.seDisabled) return;
    this.se.get(name)?.play();
  }

  public static disableSe(): void {
    this.seDisabled = true;
  }

  public static enableSe(): void {
    this.seDisabled = false;
  }
}

function readMusicManifest(): string[] | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as unknown as { __ttMusicFiles?: string[] };
  if (!Array.isArray(g.__ttMusicFiles)) return null;
  return g.__ttMusicFiles.filter((v) => typeof v === "string");
}
