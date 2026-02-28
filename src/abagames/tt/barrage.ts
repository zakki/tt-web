/*
 * Ported from tt/src/abagames/tt/barrage.d
 */

import { Rand } from "../util/rand";
import { Logger } from "../util/logger";
import type { BulletTarget } from "./bullettarget";
import { ParserParam, type BulletMLParser } from "./bulletimpl";
import type { Drawable } from "./shape";
import type { BulletActorLike, BulletActorPoolLike } from "./enemy";

/**
 * Barrage pattern.
 */
export class Barrage {
  private static readonly rand = new Rand();
  private parserParam: ParserParam[] = [];
  private shape: Drawable | null = null;
  private disapShape: Drawable | null = null;
  private longRange = false;
  private prevWait = 0;
  private postWait = 0;
  private noXReverse = false;

  public static setRandSeed(seed: number): void {
    Barrage.rand.setSeed(seed);
  }

  public setShape(shape: Drawable, disapShape: Drawable): void {
    this.shape = shape;
    this.disapShape = disapShape;
  }

  public setWait(prevWait: number, postWait: number): void {
    this.prevWait = prevWait;
    this.postWait = postWait;
  }

  public setLongRange(longRange: boolean): void {
    this.longRange = longRange;
  }

  public setNoXReverse(): void {
    this.noXReverse = true;
  }

  public addBml(p: BulletMLParser, r: number, re: boolean, s: number): void;
  public addBml(path: string, r: number, re: boolean, s: number): void;
  public addBml(p: BulletMLParser | string, r: number, re: boolean, s: number): void {
    if (typeof p === "string") {
      const slash = p.indexOf("/");
      if (slash <= 0 || slash >= p.length - 1) {
        throw new Error(`File not found: ${p}`);
      }
      const dirName = p.slice(0, slash);
      const fileName = p.slice(slash + 1);
      const parser = BarrageManager.getInstance(dirName, fileName);
      if (!parser) throw new Error(`File not found: ${p}`);
      this.parserParam.push(new ParserParam(parser, r, re ? 1 : 0, s));
      return;
    }
    this.parserParam.push(new ParserParam(p, r, re ? 1 : 0, s));
  }

  public addTopBullet(pool: BulletActorPoolLike, target: BulletTarget): BulletActorLike | null {
    const xReverse = this.noXReverse ? 1 : Barrage.rand.nextInt(2) * 2 - 1;
    return pool.addTopBullet(
      this.parserParam,
      0,
      0,
      Math.PI,
      0,
      this.shape,
      this.disapShape,
      xReverse,
      1,
      this.longRange,
      target,
      this.prevWait,
      this.postWait,
    );
  }
}

/**
 * Barrage manager (BulletML loader).
 */
export class BarrageManager {
  private static readonly parser = new Map<string, Map<string, BulletMLParser>>();
  private static readonly BARRAGE_DIR_NAME = "barrage";
  private static loaded = false;

  public static load(): void {
    /*
     * D source (filesystem enumeration + TinyXML parser load):
     *
     *   char[][] dirs = listdir(BARRAGE_DIR_NAME);
     *   foreach (char[] dirName; dirs) {
     *     char[][] files = listdir(BARRAGE_DIR_NAME ~ "/" ~ dirName);
     *     foreach (char[] fileName; files) {
     *       if (getExt(fileName) != "xml")
     *         continue;
     *       parser[dirName][fileName] = getInstance(dirName, fileName);
     *     }
     *   }
     *
     * Browser TS version cannot enumerate bundled assets by filesystem path at runtime.
     * Call `register()` from build/bootstrap code after preparing parser objects.
     */
    const manifest = readBarrageManifest();
    if (manifest) {
      for (const [dirName, files] of Object.entries(manifest)) {
        for (const [fileName, parser] of Object.entries(files)) {
          this.register(dirName, fileName, parser);
        }
      }
    }
    this.loaded = true;
  }

  public static register(dirName: string, fileName: string, parser: BulletMLParser): void {
    let byDir = this.parser.get(dirName);
    if (!byDir) {
      byDir = new Map<string, BulletMLParser>();
      this.parser.set(dirName, byDir);
    }
    byDir.set(fileName, parser);
  }

  public static getInstance(dirName: string, fileName: string): BulletMLParser | null {
    const byDir = this.parser.get(dirName);
    if (!byDir) return null;
    const p = byDir.get(fileName) ?? null;
    if (!p) return null;
    Logger.info(`Load BulletML: ${dirName}/${fileName}`);
    return p;
  }

  public static getInstanceList(dirName: string): BulletMLParser[] {
    const byDir = this.parser.get(dirName);
    if (!byDir) return [];
    return Array.from(byDir.values());
  }

  public static unload(): void {
    this.parser.clear();
    this.loaded = false;
  }

  public static dirName(): string {
    return this.BARRAGE_DIR_NAME;
  }

  public static isLoaded(): boolean {
    return this.loaded;
  }
}

function readBarrageManifest(): Record<string, Record<string, BulletMLParser>> | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as unknown as {
    __ttBarrageParsers?: Record<string, Record<string, BulletMLParser>>;
  };
  return g.__ttBarrageParsers ?? null;
}
