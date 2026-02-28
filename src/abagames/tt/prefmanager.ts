/*
 * Ported from tt/src/abagames/tt/prefmanager.d
 */

import type { PrefManager as PrefManagerBase } from "../util/prefmanager";
import { Ship } from "./ship";

/**
 * Save/Load the high score.
 */
export class PrefManager implements PrefManagerBase {
  private static readonly VERSION_NUM = 10;
  private static readonly PREF_FILE = "tt.prf";
  private readonly _prefData: PrefData;

  public constructor() {
    this._prefData = new PrefData();
  }

  public load(): void {
    /*
     * D source uses filesystem stream:
     *   fd.open(PREF_FILE); fd.read(ver); ...
     *
     * Browser TS version stores serialized numeric stream in localStorage.
     */
    try {
      const raw = storageGet(PrefManager.PREF_FILE);
      if (!raw) throw new Error("No pref data");
      const stream = NumberArrayStream.deserialize(raw);
      const ver = stream.read();
      if (ver !== PrefManager.VERSION_NUM) throw new Error("Wrong version num");
      this._prefData.load(stream);
    } catch {
      this._prefData.init();
    }
  }

  public save(): void {
    const stream = new NumberArrayStream();
    stream.write(PrefManager.VERSION_NUM);
    this._prefData.save(stream);
    storageSet(PrefManager.PREF_FILE, stream.serialize());
  }

  // Compatibility accessor for existing TS ports that use `prefManager.prefData`.
  public get prefData(): PrefData {
    return this._prefData;
  }
}

export class PrefData {
  private readonly gradeData: GradeData[];
  private _selectedGrade = 0;
  private _selectedLevel = 1;

  public constructor() {
    this.gradeData = Array.from({ length: Ship.GRADE_NUM }, () => new GradeData());
  }

  public init(): void {
    for (const gd of this.gradeData) gd.init();
    this._selectedGrade = 0;
    this._selectedLevel = 1;
  }

  public load(fd: NumberArrayStream): void {
    for (const gd of this.gradeData) gd.load(fd);
    this._selectedGrade = fd.read();
    this._selectedLevel = fd.read();
  }

  public save(fd: NumberArrayStream): void {
    for (const gd of this.gradeData) gd.save(fd);
    fd.write(this._selectedGrade);
    fd.write(this._selectedLevel);
  }

  public recordStartGame(gd: number, lv: number): void {
    this._selectedGrade = gd;
    this._selectedLevel = lv;
  }

  public recordResult(lv: number, sc: number): void {
    const gd = this.gradeData[this._selectedGrade];
    if (sc > gd.hiScore) {
      gd.hiScore = sc;
      gd.startLevel = this._selectedLevel;
      gd.endLevel = lv;
    }
    if (lv > gd.reachedLevel) gd.reachedLevel = lv;
    this._selectedLevel = lv;
  }

  public getMaxLevel(gd: number): number {
    return this.gradeData[gd].reachedLevel;
  }

  public getGradeData(gd: number): GradeData {
    return this.gradeData[gd];
  }

  public get selectedGrade(): number {
    return this._selectedGrade;
  }

  public get selectedLevel(): number {
    return this._selectedLevel;
  }
}

export class GradeData {
  public reachedLevel = 1;
  public hiScore = 0;
  public startLevel = 1;
  public endLevel = 1;

  public init(): void {
    this.reachedLevel = 1;
    this.startLevel = 1;
    this.endLevel = 1;
    this.hiScore = 0;
  }

  public load(fd: NumberArrayStream): void {
    this.reachedLevel = fd.read();
    this.hiScore = fd.read();
    this.startLevel = fd.read();
    this.endLevel = fd.read();
  }

  public save(fd: NumberArrayStream): void {
    fd.write(this.reachedLevel);
    fd.write(this.hiScore);
    fd.write(this.startLevel);
    fd.write(this.endLevel);
  }
}

class NumberArrayStream {
  private readonly data: number[] = [];
  private idx = 0;

  public write(value: number): void {
    this.data.push(value);
  }

  public read(): number {
    if (this.idx >= this.data.length) throw new Error("Read overflow");
    const v = this.data[this.idx];
    this.idx++;
    return v;
  }

  public serialize(): string {
    return JSON.stringify(this.data);
  }

  public static deserialize(raw: string): NumberArrayStream {
    const s = new NumberArrayStream();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) throw new Error("Invalid pref stream");
    for (const v of arr) s.data.push(Number(v));
    return s;
  }
}

function storageGet(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(key);
}

function storageSet(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, value);
}
