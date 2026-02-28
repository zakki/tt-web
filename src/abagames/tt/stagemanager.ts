/*
 * Ported from tt/src/abagames/tt/stagemanager.d
 */

import { Rand } from "../util/rand";
import { Vector } from "../util/vector";
import { BitShape, BulletShape, ResizableDrawable, ShipShape } from "./shape";
import { Enemy, EnemyPool } from "./enemy";
import { Barrage, BarrageManager } from "./barrage";
import { Ship } from "./ship";
import { Slice, SliceState, Torus, Tunnel } from "./tunnel";

/**
 * Manage enemies' appearance and a torus.
 */
export class StageManager {
  private static readonly BOSS_APP_RANK = [100, 160, 250];
  private static readonly LEVEL_UP_RATIO = 0.5;
  private static readonly TUNNEL_COLOR_PATTERN_POLY = [
    [0.7, 0.9, 1],
    [0.6, 1, 0.8],
    [0.9, 0.7, 0.6],
    [0.8, 0.8, 0.8],
    [0.5, 0.9, 0.9],
    [0.7, 0.9, 0.6],
    [0.8, 0.5, 0.9],
  ];
  private static readonly TUNNEL_COLOR_PATTERN_LINE = [
    [0.6, 0.7, 1],
    [0.4, 0.8, 0.6],
    [0.7, 0.5, 0.6],
    [0.6, 0.6, 0.6],
    [0.4, 0.7, 0.7],
    [0.6, 0.7, 0.5],
    [0.6, 0.4, 1],
  ];
  private readonly tunnel: Tunnel;
  private readonly torus: Torus;
  private readonly enemies: EnemyPool;
  private readonly ship: Ship;
  private smallShipSpec: ShipSpec[] = [];
  private middleShipSpec: ShipSpec[] = [];
  private bossShipSpec: ShipSpec[] = [];
  private readonly rand: Rand;
  private nextSmallAppDist = 0;
  private nextMiddleAppDist = 0;
  private nextBossAppDist = 0;
  private bossNum = 0;
  private bossAppRank = 0;
  private zoneEndRank = 0;
  private bossSpecIdx = 0;
  private _level = 0;
  private grade = 0;
  private bossModeEndCnt = -1;
  private _middleBossZone = false;
  private tunnelColorPolyIdx = 0;
  private tunnelColorLineIdx = 0;
  private static readonly TUNNEL_COLOR_CHANGE_INTERVAL = 60;
  private tunnelColorChangeCnt = 0;

  public constructor(tunnel: Tunnel, enemies: EnemyPool, ship: Ship) {
    this.tunnel = tunnel;
    this.enemies = enemies;
    this.ship = ship;
    this.rand = new Rand();
    this.torus = new Torus();
    ShipSpec.createBulletShape();
  }

  public start(level: number, grade: number, seed: number): void {
    this.rand.setSeed(seed);
    this.torus.create(seed);
    this.tunnel.start(this.torus);
    this._level = level - StageManager.LEVEL_UP_RATIO;
    this.grade = grade;
    this.zoneEndRank = 0;
    this._middleBossZone = false;
    Slice.darkLine = true;
    Slice.darkLineRatio = 1;
    this.tunnelColorPolyIdx = StageManager.TUNNEL_COLOR_PATTERN_POLY.length + (level | 0) - 2;
    this.tunnelColorLineIdx = StageManager.TUNNEL_COLOR_PATTERN_LINE.length + (level | 0) - 2;
    this.createNextZone();
  }

  private createNextZone(): void {
    this._level += StageManager.LEVEL_UP_RATIO;
    this._middleBossZone = !this._middleBossZone;
    if (Slice.darkLine) {
      this.tunnelColorPolyIdx++;
      this.tunnelColorLineIdx++;
    }
    Slice.darkLine = !Slice.darkLine;
    this.tunnelColorChangeCnt = StageManager.TUNNEL_COLOR_CHANGE_INTERVAL;
    this.enemies.clear();
    this.closeShipSpec();
    this.smallShipSpec = [];
    for (let i = 0; i < 2 + this.rand.nextInt(2); i++) {
      const ss = new ShipSpec();
      ss.createSmall(this.rand, this._level * 1.8, this.grade);
      this.smallShipSpec.push(ss);
    }
    this.middleShipSpec = [];
    for (let i = 0; i < 2 + this.rand.nextInt(2); i++) {
      const ss = new ShipSpec();
      ss.createMiddle(this.rand, this._level * 1.9);
      this.middleShipSpec.push(ss);
    }
    this.nextSmallAppDist = 0;
    this.nextMiddleAppDist = 0;
    this.setNextSmallAppDist();
    this.setNextMiddleAppDist();
    this.bossShipSpec = [];
    if (this._middleBossZone && this._level > 5 && this.rand.nextInt(3) !== 0) {
      this.bossNum = 1 + this.rand.nextInt(((Math.sqrt(this._level / 5) | 0) + 1) | 0);
      if (this.bossNum > 4) this.bossNum = 4;
    } else {
      this.bossNum = 1;
    }
    for (let i = 0; i < this.bossNum; i++) {
      const ss = new ShipSpec();
      let lv = (this._level * 2.0) / this.bossNum;
      if (this._middleBossZone) lv *= 1.33;
      ss.createBoss(this.rand, lv, 0.8 + this.grade * 0.04 + this.rand.nextFloat(0.03), this._middleBossZone);
      this.bossShipSpec.push(ss);
    }
    this.bossAppRank = StageManager.BOSS_APP_RANK[this.grade] - this.bossNum + this.zoneEndRank;
    this.zoneEndRank += StageManager.BOSS_APP_RANK[this.grade];
    this.ship.setBossApp(this.bossAppRank, this.bossNum, this.zoneEndRank);
    this.bossSpecIdx = 0;
    this.nextBossAppDist = 9999999;
    this.bossModeEndCnt = -1;
  }

  public move(): void {
    if (this.ship.inBossMode) {
      if (this.nextBossAppDist > 99999) {
        this.nextBossAppDist = this.rand.nextInt(50) + 100;
        this.nextSmallAppDist = 9999999;
        this.nextMiddleAppDist = 9999999;
      }
      this.nextBossAppDist -= this.ship.speed;
      if (this.bossNum > 0 && this.nextBossAppDist <= 0) {
        this.addEnemy(this.bossShipSpec[this.bossSpecIdx], Ship.IN_SIGHT_DEPTH_DEFAULT * 4, this.rand);
        this.bossNum--;
        this.nextBossAppDist = this.rand.nextInt(30) + 60;
        this.bossSpecIdx++;
      }
      if (this.bossNum <= 0 && this.enemies.getNum() <= 0) this.ship.gotoNextZoneForced();
      return;
    } else {
      if (this.nextBossAppDist < 99999) {
        this.bossModeEndCnt = 60;
        this.nextSmallAppDist = 9999999;
        this.nextMiddleAppDist = 9999999;
        this.nextBossAppDist = 9999999;
      }
      if (this.bossModeEndCnt >= 0) {
        this.bossModeEndCnt--;
        this.ship.clearVisibleBullets();
        if (this.bossModeEndCnt < 0) {
          this.createNextZone();
          this.ship.startNextZone();
        }
      }
    }

    this.nextSmallAppDist -= this.ship.speed;
    if (this.nextSmallAppDist <= 0) {
      this.addEnemy(this.smallShipSpec[this.rand.nextInt(this.smallShipSpec.length)], Ship.IN_SIGHT_DEPTH_DEFAULT * (4 + this.rand.nextFloat(0.5)), this.rand);
      this.setNextSmallAppDist();
    }
    this.nextMiddleAppDist -= this.ship.speed;
    if (this.nextMiddleAppDist <= 0) {
      this.addEnemy(this.middleShipSpec[this.rand.nextInt(this.middleShipSpec.length)], Ship.IN_SIGHT_DEPTH_DEFAULT * (4 + this.rand.nextFloat(0.5)), this.rand);
      this.setNextMiddleAppDist();
    }

    if (this.tunnelColorChangeCnt > 0) {
      this.tunnelColorChangeCnt--;
      if (Slice.darkLine) {
        Slice.darkLineRatio += 1.0 / StageManager.TUNNEL_COLOR_CHANGE_INTERVAL;
      } else {
        Slice.darkLineRatio -= 1.0 / StageManager.TUNNEL_COLOR_CHANGE_INTERVAL;
        const cRatio = this.tunnelColorChangeCnt / StageManager.TUNNEL_COLOR_CHANGE_INTERVAL;
        const cpIdxPrev = (this.tunnelColorPolyIdx - 1) % StageManager.TUNNEL_COLOR_PATTERN_POLY.length;
        const cpIdxNow = this.tunnelColorPolyIdx % StageManager.TUNNEL_COLOR_PATTERN_POLY.length;
        Slice.polyR = StageManager.TUNNEL_COLOR_PATTERN_POLY[cpIdxPrev][0] * cRatio + StageManager.TUNNEL_COLOR_PATTERN_POLY[cpIdxNow][0] * (1 - cRatio);
        Slice.polyG = StageManager.TUNNEL_COLOR_PATTERN_POLY[cpIdxPrev][1] * cRatio + StageManager.TUNNEL_COLOR_PATTERN_POLY[cpIdxNow][1] * (1 - cRatio);
        Slice.polyB = StageManager.TUNNEL_COLOR_PATTERN_POLY[cpIdxPrev][2] * cRatio + StageManager.TUNNEL_COLOR_PATTERN_POLY[cpIdxNow][2] * (1 - cRatio);
        const clIdxPrev = (this.tunnelColorLineIdx - 1) % StageManager.TUNNEL_COLOR_PATTERN_LINE.length;
        const clIdxNow = this.tunnelColorLineIdx % StageManager.TUNNEL_COLOR_PATTERN_LINE.length;
        Slice.lineR = StageManager.TUNNEL_COLOR_PATTERN_LINE[clIdxPrev][0] * cRatio + StageManager.TUNNEL_COLOR_PATTERN_LINE[clIdxNow][0] * (1 - cRatio);
        Slice.lineG = StageManager.TUNNEL_COLOR_PATTERN_LINE[clIdxPrev][1] * cRatio + StageManager.TUNNEL_COLOR_PATTERN_LINE[clIdxNow][1] * (1 - cRatio);
        Slice.lineB = StageManager.TUNNEL_COLOR_PATTERN_LINE[clIdxPrev][2] * cRatio + StageManager.TUNNEL_COLOR_PATTERN_LINE[clIdxNow][2] * (1 - cRatio);
      }
    }
  }

  private setNextSmallAppDist(): void {
    this.nextSmallAppDist += this.rand.nextInt(16) + 6;
  }

  private setNextMiddleAppDist(): void {
    this.nextMiddleAppDist += this.rand.nextInt(200) + 33;
  }

  private addEnemy(spec: ShipSpec, y: number, rand: Rand): void {
    const en = this.enemies.getInstance();
    if (!en) return;
    const sl = this.tunnel.getSlice(y);
    let x: number;
    if (sl.isNearlyRound()) {
      x = rand.nextFloat(Math.PI);
    } else {
      const ld = sl.getLeftEdgeDeg();
      const rd = sl.getRightEdgeDeg();
      let wd = rd - ld;
      if (wd < 0) wd += Math.PI * 2;
      x = ld + rand.nextFloat(wd);
    }
    if (x < 0) x += Math.PI * 2;
    else if (x >= Math.PI * 2) x -= Math.PI * 2;
    en.set(spec, x, y, rand);
  }

  public closeStage(): void {
    this.closeShipSpec();
    this.torus.close();
  }

  public close(): void {
    this.closeStage();
    ShipSpec.closeBulletShape();
  }

  private closeShipSpec(): void {
    for (const ss of this.smallShipSpec) ss.close();
    for (const ss of this.middleShipSpec) ss.close();
    for (const ss of this.bossShipSpec) ss.close();
  }

  public level(): number {
    return this._level;
  }

  public middleBossZone(): boolean {
    return this._middleBossZone;
  }
}

/**
 * Enemy ship specifications.
 */
export class ShipSpec {
  private static readonly SPEED_CHANGE_RATIO = 0.2;
  private static bulletShape: BulletShape[] = [];
  private static _bitShape: BitShape;
  private _shape!: ShipShape;
  private _damagedShape!: ShipShape;
  private _barrage!: Barrage;
  private _shield = 0;
  private baseSpeed = 0;
  private shipSpeedRatio = 0;
  private visualRange = 0;
  private baseBank = 0;
  private bankMax = 0;
  private _score = 0;
  private _bitNum = 0;
  private static readonly BitType = { ROUND: 0, LINE: 1 } as const;
  private bitType = 0;
  private bitDistance = 0;
  private bitMd = 0;
  private _bitBarrage!: Barrage;
  private _aimShip = false;
  private _hasLimitY = false;
  private _noFireDepthLimit = false;
  private _isBoss = false;

  public static createBulletShape(): void {
    ShipSpec.bulletShape = [];
    for (let i = 0; i < BulletShape.NUM; i++) {
      const bs = new BulletShape();
      bs.create(i);
      ShipSpec.bulletShape.push(bs);
    }
    ShipSpec._bitShape = new BitShape();
    ShipSpec._bitShape.create();
  }

  public static closeBulletShape(): void {
    for (const bs of ShipSpec.bulletShape) bs.close();
  }

  public createSmall(rand: Rand, level: number, grade: number): void {
    this._shield = 1;
    this.baseSpeed = 0.05 + rand.nextFloat(0.1);
    this.shipSpeedRatio = 0.25 + rand.nextFloat(0.25);
    this.visualRange = 10 + rand.nextFloat(32);
    this.bankMax = 0.3 + rand.nextFloat(0.7);
    if (rand.nextInt(3) === 0) this.baseBank = 0.1 + rand.nextFloat(0.2);
    else this.baseBank = 0;
    const rs = rand.nextInt(99999);
    this._shape = new ShipShape(rs);
    this._shape.create(ShipShape.Type.SMALL);
    this._damagedShape = new ShipShape(rs);
    this._damagedShape.create(ShipShape.Type.SMALL, true);
    let biMin = (160.0 / level) | 0;
    if (biMin > 80) biMin = 80;
    else if (biMin < 40) biMin = 40;
    biMin += (Ship.GRADE_NUM - 1 - grade) * 8;
    const brgInterval = biMin + rand.nextInt(80 + (Ship.GRADE_NUM - 1 - grade) * 8 - biMin);
    let brgRank = level;
    brgRank /= 150.0 / brgInterval;
    this._barrage = this.createBarrage(rand, brgRank, 0, brgInterval);
    this._score = 100;
    this._bitNum = 0;
    this._aimShip = false;
    this._hasLimitY = false;
    this._noFireDepthLimit = false;
    this._isBoss = false;
  }

  public createMiddle(rand: Rand, level: number): void {
    this._shield = 10;
    this.baseSpeed = 0.1 + rand.nextFloat(0.1);
    this.shipSpeedRatio = 0.4 + rand.nextFloat(0.4);
    this.visualRange = 10 + rand.nextFloat(32);
    this.bankMax = 0.2 + rand.nextFloat(0.5);
    if (rand.nextInt(4) === 0) this.baseBank = 0.05 + rand.nextFloat(0.1);
    else this.baseBank = 0;
    const rs = rand.nextInt(99999);
    this._shape = new ShipShape(rs);
    this._shape.create(ShipShape.Type.MIDDLE);
    this._damagedShape = new ShipShape(rs);
    this._damagedShape.create(ShipShape.Type.MIDDLE, true);
    this._barrage = this.createBarrage(rand, level, 0, 0, 1, "middle", BulletShape.BSType.SQUARE);
    this._score = 500;
    this._bitNum = 0;
    this._aimShip = false;
    this._hasLimitY = false;
    this._noFireDepthLimit = false;
    this._isBoss = false;
  }

  public createBoss(rand: Rand, level: number, speed: number, middleBoss: boolean): void {
    this._shield = 30;
    this.baseSpeed = 0.1 + rand.nextFloat(0.1);
    this.shipSpeedRatio = speed;
    this.visualRange = 16 + rand.nextFloat(24);
    this.bankMax = 0.8 + rand.nextFloat(0.4);
    this.baseBank = 0;
    const rs = rand.nextInt(99999);
    this._shape = new ShipShape(rs);
    this._shape.create(ShipShape.Type.LARGE);
    this._damagedShape = new ShipShape(rs);
    this._damagedShape.create(ShipShape.Type.LARGE, true);
    this._barrage = this.createBarrage(rand, level, 0, 0, 1.2, "middle", BulletShape.BSType.SQUARE, true);
    this._score = 2000;
    this._aimShip = true;
    this._hasLimitY = true;
    this._noFireDepthLimit = true;
    this._isBoss = true;
    if (middleBoss) {
      this._bitNum = 0;
      return;
    }
    this._bitNum = 2 + rand.nextInt(3) * 2;
    this.bitType = rand.nextInt(2);
    this.bitDistance = 0.33 + rand.nextFloat(0.3);
    this.bitMd = 0.02 + rand.nextFloat(0.02);
    let bitBrgRank = level;
    bitBrgRank /= this._bitNum / 2;
    let biMin = (120.0 / bitBrgRank) | 0;
    if (biMin > 60) biMin = 60;
    else if (biMin < 20) biMin = 20;
    const brgInterval = biMin + rand.nextInt(60 - biMin);
    bitBrgRank /= 60.0 / brgInterval;
    this._bitBarrage = this.createBarrage(rand, bitBrgRank, 0, brgInterval, 1, undefined, BulletShape.BSType.BAR, true);
    this._bitBarrage.setNoXReverse();
  }

  public close(): void {
    this._shape.close();
  }

  private createBarrage(
    rand: Rand,
    level: number,
    preWait: number,
    postWait: number,
    size = 1,
    baseDir?: string,
    shapeIdx = 0,
    longRange = false,
  ): Barrage {
    if (level < 0) return new Barrage();
    let rank = Math.sqrt(level) / (8 - rand.nextInt(3));
    if (rank > 0.8) rank = rand.nextFloat(0.2) + 0.8;
    level /= rank + 2;
    let speedRank = Math.sqrt(rank) * (rand.nextFloat(0.2) + 0.8);
    if (speedRank < 1) speedRank = 1;
    if (speedRank > 2) speedRank = Math.sqrt(speedRank * 2);
    let morphRank = level / speedRank;
    let morphCnt = 0;
    while (morphRank > 1) {
      morphCnt++;
      morphRank /= 3;
    }
    const br = new Barrage();
    const bsr = new ResizableDrawable();
    bsr.shape(ShipSpec.bulletShape[shapeIdx]);
    bsr.size(size * 1.25);
    const dbsr = new ResizableDrawable();
    dbsr.shape(ShipSpec.bulletShape[shapeIdx + 1] ?? ShipSpec.bulletShape[shapeIdx]);
    dbsr.size(size * 1.25);
    br.setShape(bsr, dbsr);
    br.setWait(preWait, postWait);
    br.setLongRange(longRange);
    if (baseDir) {
      const ps = BarrageManager.getInstanceList(baseDir);
      if (ps.length > 0) {
        const pi = rand.nextInt(ps.length);
        br.addBml(ps[pi], rank, true, speedRank);
      }
    } else {
      br.addBml("basic/straight.xml", rank, true, speedRank);
    }
    const ps = BarrageManager.getInstanceList("morph");
    for (let i = 0; i < morphCnt && ps.length > 0; i++) {
      const pi = rand.nextInt(ps.length);
      br.addBml(ps[pi], morphRank, true, speedRank);
      ps.splice(pi, 1);
    }
    return br;
  }

  public setSpeed(sp: number, shipSp?: number): number {
    let aim = this.baseSpeed;
    if (typeof shipSp === "number") {
      const as = shipSp * this.shipSpeedRatio;
      if (as > this.baseSpeed) aim = as;
    }
    return this.changeSpeed(sp, aim);
  }

  private changeSpeed(sp: number, aim: number): number {
    return sp + (aim - sp) * ShipSpec.SPEED_CHANGE_RATIO;
  }

  public getRangeOfMovement(ldOut: (v: number) => void, rdOut: (v: number) => void, p: Vector, tunnel: Tunnel): boolean {
    let py = p.y;
    const cs = tunnel.getSlice(py);
    py += this.visualRange;
    const vs = tunnel.getSlice(py);
    if (!cs.isNearlyRound()) {
      let from = cs.getLeftEdgeDeg();
      let to = cs.getRightEdgeDeg();
      if (!vs.isNearlyRound()) {
        const vld = vs.getLeftEdgeDeg();
        const vrd = vs.getRightEdgeDeg();
        if (Tunnel.checkDegInside(from, vld, vrd) === -1) from = vld;
        if (Tunnel.checkDegInside(to, vld, vrd) === 1) to = vrd;
      }
      ldOut(from);
      rdOut(to);
      return true;
    } else if (!vs.isNearlyRound()) {
      ldOut(vs.getLeftEdgeDeg());
      rdOut(vs.getRightEdgeDeg());
      return true;
    }
    return false;
  }

  public tryToMove(bankRef: number, deg: number, aimDeg: number): number {
    let bk = aimDeg - deg;
    if (bk > Math.PI) bk -= Math.PI * 2;
    else if (bk < -Math.PI) bk += Math.PI * 2;
    if (bk > this.bankMax) bk = this.bankMax;
    else if (bk < -this.bankMax) bk = -this.bankMax;
    bankRef += (bk - bankRef) * 0.1;
    return bankRef;
  }

  public handleLimitY(posY: number, limitY: number): { posY: number; limitY: number } {
    if (posY > limitY) posY += (limitY - posY) * 0.05;
    else limitY += (posY - limitY) * 0.05;
    limitY -= 0.01;
    return { posY, limitY };
  }

  public createBaseBank(rand: Rand): number {
    return rand.nextSignedFloat(this.baseBank);
  }

  public getBitOffset(ofs: Vector, dOut: (v: number) => void, idx: number, cnt: number): void {
    switch (this.bitType) {
      case ShipSpec.BitType.ROUND: {
        const od = (Math.PI * 2) / this._bitNum;
        const d = od * idx + cnt * this.bitMd;
        ofs.x = this.bitDistance * 2 * Math.sin(d);
        ofs.y = this.bitDistance * 2 * Math.cos(d) * 5;
        dOut(Math.PI - Math.sin(d) * 0.05);
        break;
      }
      case ShipSpec.BitType.LINE: {
        const of = (idx % 2) * 2 - 1;
        const oi = (idx / 2) | 0 + 1;
        ofs.x = this.bitDistance * 1.5 * oi * of;
        ofs.y = 0;
        dOut(Math.PI);
        break;
      }
    }
  }

  public static bitShape(): BitShape {
    return ShipSpec._bitShape;
  }

  public get shape(): ShipShape {
    return this._shape;
  }
  public get damagedShape(): ShipShape {
    return this._damagedShape;
  }
  public get shield(): number {
    return this._shield;
  }
  public get barrage(): Barrage {
    return this._barrage;
  }
  public get score(): number {
    return this._score;
  }
  public get aimShip(): boolean {
    return this._aimShip;
  }
  public get hasLimitY(): boolean {
    return this._hasLimitY;
  }
  public get noFireDepthLimit(): boolean {
    return this._noFireDepthLimit;
  }
  public get bitBarrage(): Barrage {
    return this._bitBarrage;
  }
  public get bitNum(): number {
    return this._bitNum;
  }
  public get isBoss(): boolean {
    return this._isBoss;
  }
}
