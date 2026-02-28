/*
 * Ported from tt/src/abagames/tt/replay.d
 */

import { PadRecord } from "../util/sdl/recordablepad";

/**
 * Manage replay data.
 */
export class ReplayData {
  public static readonly dir = "replay";
  public static readonly VERSION_NUM = 20;
  public padRecord: PadRecord = new PadRecord();
  public level = 1;
  public grade = 0;
  public seed = 0;

  public save(fileName: string): void {
    /*
     * D source writes binary file:
     *   fd.create(dir ~ "/" ~ fileName);
     *   fd.write(VERSION_NUM); fd.write(level); ...
     *
     * Browser TS version stores numeric stream in localStorage.
     */
    const stream = new NumberArrayStream();
    stream.write(ReplayData.VERSION_NUM);
    stream.write(this.level);
    stream.write(this.grade);
    stream.write(this.seed);
    this.padRecord.save(stream);
    storageSet(this.key(fileName), stream.serialize());
  }

  public load(fileName: string): void {
    const raw = storageGet(this.key(fileName));
    if (!raw) throw new Error("Replay file not found");
    const stream = NumberArrayStream.deserialize(raw);
    const ver = stream.read();
    if (ver !== ReplayData.VERSION_NUM) throw new Error("Wrong version num");
    this.level = stream.read();
    this.grade = stream.read() | 0;
    this.seed = stream.read() | 0;
    this.padRecord = new PadRecord();
    this.padRecord.load(stream);
  }

  private key(fileName: string): string {
    return `${ReplayData.dir}/${fileName}`;
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
    if (!Array.isArray(arr)) throw new Error("Invalid replay stream");
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
