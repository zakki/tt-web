/*
 * Ported from tt/src/abagames/tt/bulletimpl.d
 */

import { Bullet } from "../util/bulletml/bullet";
import type { Drawable } from "./shape";
import type { BulletTarget } from "./bullettarget";

export type BulletMLParser = unknown;

/**
 * Bullet params of parsers, shape, reverse moving flags, target and root bullet.
 */
export class BulletImpl extends Bullet {
  public parserParam: ParserParam[] | null = null;
  public parserIdx = 0;
  public shape: Drawable | null = null;
  public disapShape: Drawable | null = null;
  public xReverse = 1;
  public yReverse = 1;
  public longRange = false;
  public target: BulletTarget | null = null;
  public rootBullet: { rootRank: number } | null = null;

  public setParamFirst(
    parserParam: ParserParam[] | null,
    shape: Drawable | null,
    disapShape: Drawable | null,
    xReverse: number,
    yReverse: number,
    longRange: boolean,
    target: BulletTarget | null,
    rootBullet: { rootRank: number } | null,
  ): void {
    this.parserParam = parserParam;
    this.shape = shape;
    this.disapShape = disapShape;
    this.xReverse = xReverse;
    this.yReverse = yReverse;
    this.longRange = longRange;
    this.target = target;
    this.rootBullet = rootBullet;
    this.parserIdx = 0;
  }

  public setParam(bi: BulletImpl): void {
    this.parserParam = bi.parserParam;
    this.shape = bi.shape;
    this.disapShape = bi.disapShape;
    this.xReverse = bi.xReverse;
    this.yReverse = bi.yReverse;
    this.target = bi.target;
    this.rootBullet = null;
    this.parserIdx = bi.parserIdx;
    this.longRange = bi.longRange;
  }

  public addParser(p: BulletMLParser, r: number, re: number, s: number): void {
    if (!this.parserParam) this.parserParam = [];
    this.parserParam.push(new ParserParam(p, r, re, s));
  }

  public gotoNextParser(): boolean {
    if (!this.parserParam || this.parserParam.length <= 0) return false;
    this.parserIdx++;
    if (this.parserIdx >= this.parserParam.length) {
      this.parserIdx--;
      return false;
    }
    return true;
  }

  public getParser(): BulletMLParser | null {
    if (!this.parserParam || this.parserParam.length <= 0) return null;
    return this.parserParam[this.parserIdx].parser;
  }

  public resetParser(): void {
    this.parserIdx = 0;
  }

  public override get rank(): number {
    if (!this.parserParam || this.parserParam.length <= 0) return super.rank;
    const pp = this.parserParam[this.parserIdx];
    let r = pp.rank;
    if (r > 1) r = 1;
    return r;
  }

  public override set rank(value: number) {
    super.rank = value;
  }

  public getSpeedRank(): number {
    if (!this.parserParam || this.parserParam.length <= 0) return 1;
    return this.parserParam[this.parserIdx].speed;
  }
}

export class ParserParam {
  public readonly parser: BulletMLParser;
  public readonly rank: number;
  public readonly rootRankEffect: number;
  public readonly speed: number;

  public constructor(p: BulletMLParser, r: number, re: number, s: number) {
    this.parser = p;
    this.rank = r;
    this.rootRankEffect = re;
    this.speed = s;
  }
}
