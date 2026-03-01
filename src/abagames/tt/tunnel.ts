/*
 * Ported from tt/src/abagames/tt/tunnel.d
 */

import { Rand } from "../util/rand";
import { Screen3D } from "../util/sdl/screen3d";
import { Vector, Vector3 } from "../util/vector";

interface ShipLike {
  eyePos: Vector;
}

/**
 * Tunnel course manager.
 */
export class Tunnel {
  public static readonly DEPTH_NUM = 72;
  public static readonly SHIP_IDX_OFS = 5;
  public static readonly RAD_RATIO = 1.05;
  private static readonly DEPTH_CHANGE_RATIO = 1.15;
  private static readonly DEPTH_RATIO_MAX = 80;
  private slice: Slice[];
  private shipDeg = 0;
  private shipOfs = 0;
  private shipY = 0;
  private shipIdx = 0;
  private readonly shipPos: Vector3;
  private readonly tpos: Vector3;
  private torus: Torus | null = null;
  private torusIdx = 0;
  private pointFrom = 0;
  private sightDepth = 0;
  private sliceBackward: Slice[];

  public constructor() {
    this.slice = Array.from({ length: Tunnel.DEPTH_NUM }, () => new Slice());
    this.sliceBackward = Array.from({ length: Tunnel.DEPTH_NUM }, () => new Slice());
    this.shipPos = new Vector3();
    this.tpos = new Vector3();
  }

  public start(torus: Torus): void {
    this.torus = torus;
    this.torusIdx = 0;
    this.pointFrom = 0;
    this.sightDepth = 0;
  }

  public setSlices(): void {
    if (!this.torus) return;
    let ti = this.torusIdx;
    this.sightDepth = 0;
    let dr = 1;
    let ps = this.slice[0];
    ps.setFirst(this.pointFrom, this.torus.getSliceState(this.torusIdx), -this.shipIdx - this.shipOfs);
    for (let i = 1; i < this.slice.length; i++) {
      const pti = ti | 0;
      ti += dr;
      this.sightDepth += dr;
      if (ti >= this.torus.sliceNum()) ti -= this.torus.sliceNum();
      this.slice[i].set(ps, this.torus.getSliceStateWithRing(ti | 0, pti), dr, this.sightDepth - this.shipIdx - this.shipOfs);
      if (i >= this.slice.length / 2 && dr < Tunnel.DEPTH_RATIO_MAX) dr *= Tunnel.DEPTH_CHANGE_RATIO;
      ps = this.slice[i];
    }
  }

  public setSlicesBackward(): void {
    if (!this.torus) return;
    let ti = this.torusIdx;
    let sd = 0;
    let dr = -1;
    let ps = this.sliceBackward[0];
    ps.setFirst(this.pointFrom, this.torus.getSliceState(this.torusIdx), -this.shipIdx - this.shipOfs);
    for (let i = 1; i < this.sliceBackward.length; i++) {
      const pti = ti | 0;
      ti += dr;
      sd += dr;
      if (ti < 0) ti += this.torus.sliceNum();
      this.sliceBackward[i].set(ps, this.torus.getSliceStateWithRing(pti, ti | 0), dr, sd - this.shipIdx - this.shipOfs);
      if (i >= this.sliceBackward.length / 2 && dr > -Tunnel.DEPTH_RATIO_MAX) dr *= Tunnel.DEPTH_CHANGE_RATIO;
      ps = this.sliceBackward[i];
    }
  }

  public goToNextSlice(n: number): void {
    if (!this.torus || n <= 0) return;
    this.torusIdx += n;
    for (let i = 0; i < n; i++) {
      this.pointFrom += this.slice[i].state.mp;
      this.pointFrom %= this.slice[i].state.pointNum;
      if (this.pointFrom < 0) this.pointFrom += this.slice[i].state.pointNum;
    }
    if (this.torusIdx >= this.torus.sliceNum()) {
      this.torusIdx -= this.torus.sliceNum();
      this.pointFrom = 0;
    }
  }

  public setShipPos(d: number, o: number, y: number): void {
    this.shipDeg = d;
    this.shipOfs = o;
    this.shipY = y;
    this.shipIdx = Tunnel.SHIP_IDX_OFS;
    void this.shipDeg;
    void this.shipPos;
  }

  public getPos(d: number, o: number, si: number, rr?: number): Vector3;
  public getPos(p: Vector): Vector3;
  public getPos(p: Vector3): Vector3;
  public getPos(a: number | Vector | Vector3, b?: number, c?: number, d?: number): Vector3 {
    if (typeof a === "number") {
      const rr = d ?? 1.0;
      return this.getPosByParams(a, b ?? 0, c ?? 0, rr);
    }
    if (a instanceof Vector3) {
      let si = 0;
      let o = 0;
      this.calcIndex(a.y, (v) => (si = v), (v) => (o = v));
      return this.getPosByParams(a.x, o, si, Tunnel.RAD_RATIO - a.z / this.slice[si].state.rad);
    }
    let si = 0;
    let o = 0;
    if (a.y >= -this.shipIdx - this.shipOfs) {
      this.calcIndex(a.y, (v) => (si = v), (v) => (o = v));
      return this.getPosByParams(a.x, o, si, 1.0);
    }
    this.calcIndexBackward(a.y, (v) => (si = v), (v) => (o = v));
    return this.getPosBackward(a.x, o, si, 1.0);
  }

  private getPosByParams(deg: number, ofs: number, si: number, rr: number): Vector3 {
    const nsi = si + 1;
    const r = this.slice[si].state.rad * (1 - ofs) + this.slice[nsi].state.rad * ofs;
    const d1 = this.slice[si].d1 * (1 - ofs) + this.slice[nsi].d1 * ofs;
    const d2 = this.slice[si].d2 * (1 - ofs) + this.slice[nsi].d2 * ofs;
    this.tpos.x = 0;
    this.tpos.y = r * rr;
    this.tpos.z = 0;
    this.tpos.rollZ(deg);
    this.tpos.rollY(d1);
    this.tpos.rollX(d2);
    this.tpos.x += this.slice[si].centerPos.x * (1 - ofs) + this.slice[nsi].centerPos.x * ofs;
    this.tpos.y += this.slice[si].centerPos.y * (1 - ofs) + this.slice[nsi].centerPos.y * ofs;
    this.tpos.z += this.slice[si].centerPos.z * (1 - ofs) + this.slice[nsi].centerPos.z * ofs;
    return this.tpos;
  }

  public getPosBackward(d: number, o: number, si: number, rr: number): Vector3 {
    const nsi = si + 1;
    const r = this.sliceBackward[si].state.rad * (1 - o) + this.sliceBackward[nsi].state.rad * o;
    const d1 = this.sliceBackward[si].d1 * (1 - o) + this.sliceBackward[nsi].d1 * o;
    const d2 = this.sliceBackward[si].d2 * (1 - o) + this.sliceBackward[nsi].d2 * o;
    this.tpos.x = 0;
    this.tpos.y = r * rr;
    this.tpos.z = 0;
    this.tpos.rollZ(d);
    this.tpos.rollY(d1);
    this.tpos.rollX(d2);
    this.tpos.x += this.sliceBackward[si].centerPos.x * (1 - o) + this.sliceBackward[nsi].centerPos.x * o;
    this.tpos.y += this.sliceBackward[si].centerPos.y * (1 - o) + this.sliceBackward[nsi].centerPos.y * o;
    this.tpos.z += this.sliceBackward[si].centerPos.z * (1 - o) + this.sliceBackward[nsi].centerPos.z * o;
    return this.tpos;
  }

  public getCenterPos(y: number): { pos: Vector3; d1: number; d2: number } {
    let si = 0;
    let o = 0;
    y -= this.shipY;
    if (y < -this.getTorusLength() / 2) y += this.getTorusLength();
    let d1 = 0;
    let d2 = 0;
    if (y >= -this.shipIdx - this.shipOfs) {
      this.calcIndex(y, (v) => (si = v), (v) => (o = v));
      const nsi = si + 1;
      d1 = this.slice[si].d1 * (1 - o) + this.slice[nsi].d1 * o;
      d2 = this.slice[si].d2 * (1 - o) + this.slice[nsi].d2 * o;
      this.tpos.x = this.slice[si].centerPos.x * (1 - o) + this.slice[nsi].centerPos.x * o;
      this.tpos.y = this.slice[si].centerPos.y * (1 - o) + this.slice[nsi].centerPos.y * o;
      this.tpos.z = this.slice[si].centerPos.z * (1 - o) + this.slice[nsi].centerPos.z * o;
    } else {
      this.calcIndexBackward(y, (v) => (si = v), (v) => (o = v));
      const nsi = si + 1;
      d1 = this.sliceBackward[si].d1 * (1 - o) + this.sliceBackward[nsi].d1 * o;
      d2 = this.sliceBackward[si].d2 * (1 - o) + this.sliceBackward[nsi].d2 * o;
      this.tpos.x = this.sliceBackward[si].centerPos.x * (1 - o) + this.sliceBackward[nsi].centerPos.x * o;
      this.tpos.y = this.sliceBackward[si].centerPos.y * (1 - o) + this.sliceBackward[nsi].centerPos.y * o;
      this.tpos.z = this.sliceBackward[si].centerPos.z * (1 - o) + this.sliceBackward[nsi].centerPos.z * o;
    }
    return { pos: this.tpos, d1, d2 };
  }

  public getSlice(y: number): Slice {
    let si = 0;
    let o = 0;
    if (y >= -this.shipIdx - this.shipOfs) {
      this.calcIndex(y, (v) => (si = v), (v) => (o = v));
      void o;
      return this.slice[si];
    }
    this.calcIndexBackward(y, (v) => (si = v), (v) => (o = v));
    void o;
    return this.sliceBackward[si];
  }

  public checkInCourse(p: Vector): number {
    const sl = this.getSlice(p.y);
    if (sl.isNearlyRound()) return 0;
    const ld = sl.getLeftEdgeDeg();
    const rd = sl.getRightEdgeDeg();
    const rsl = Tunnel.checkDegInside(p.x, ld, rd);
    if (rsl === 0) return 0;
    const rad = sl.state.rad;
    let ofs = rsl === 1 ? p.x - rd : ld - p.x;
    if (ofs >= Math.PI * 2) ofs -= Math.PI * 2;
    else if (ofs < 0) ofs += Math.PI * 2;
    return ofs * rad * rsl;
  }

  public static checkDegInside(d: number, ld: number, rd: number): number {
    let rsl = 0;
    if (rd <= ld) {
      if (d > rd && d < ld) rsl = d < (rd + ld) / 2 ? 1 : -1;
    } else {
      if (d < ld || d > rd) {
        let cd = (ld + rd) / 2 + Math.PI;
        if (cd >= Math.PI * 2) cd -= Math.PI * 2;
        if (cd >= Math.PI) {
          if (d < cd && d > rd) rsl = 1;
          else rsl = -1;
        } else {
          if (d > cd && d < ld) rsl = -1;
          else rsl = 1;
        }
      }
    }
    return rsl;
  }

  public getRadius(z: number): number {
    let si = 0;
    let o = 0;
    this.calcIndex(z, (v) => (si = v), (v) => (o = v));
    const nsi = si + 1;
    return this.slice[si].state.rad * (1.0 - o) + this.slice[nsi].state.rad * o;
  }

  private calcIndex(z: number, idxOut: (v: number) => void, ofsOut: (v: number) => void): void {
    let idx = this.slice.length + 99999;
    let ofs = 0;
    for (let i = 1; i < this.slice.length; i++) {
      if (z < this.slice[i].depth) {
        idx = i - 1;
        ofs = (z - this.slice[idx].depth) / (this.slice[idx + 1].depth - this.slice[idx].depth);
        break;
      }
    }
    if (idx < 0) {
      idx = 0;
      ofs = 0;
    } else if (idx >= this.slice.length - 1) {
      idx = this.slice.length - 2;
      ofs = 0.99;
    }
    if (!(ofs >= 0)) ofs = 0;
    else if (ofs >= 1) ofs = 0.99;
    idxOut(idx);
    ofsOut(ofs);
  }

  private calcIndexBackward(z: number, idxOut: (v: number) => void, ofsOut: (v: number) => void): void {
    let idx = this.sliceBackward.length + 99999;
    let ofs = 0;
    for (let i = 1; i < this.sliceBackward.length; i++) {
      if (z > this.sliceBackward[i].depth) {
        idx = i - 1;
        ofs = (this.sliceBackward[idx].depth - z) / (this.sliceBackward[idx + 1].depth - this.sliceBackward[idx].depth);
        break;
      }
    }
    if (idx < 0) {
      idx = 0;
      ofs = 0;
    } else if (idx >= this.sliceBackward.length - 1) {
      idx = this.sliceBackward.length - 2;
      ofs = 0.99;
    }
    if (!(ofs >= 0)) ofs = 0;
    else if (ofs >= 1) ofs = 0.99;
    idxOut(idx);
    ofsOut(ofs);
  }

  public checkInScreen(p: Vector, ship: ShipLike, v = 0.03, ofs = 28): boolean {
    let xr = Math.abs(p.x - ship.eyePos.x);
    if (xr > Math.PI) xr = Math.PI * 2 - xr;
    xr *= this.getRadius(0) / SliceState.DEFAULT_RAD;
    v *= p.y + ofs;
    return xr <= v;
  }

  public checkInSight(y: number): boolean {
    let oy = y - this.torusIdx;
    if (oy < 0) oy += this.getTorusLength();
    return oy > 0 && oy < this.sightDepth - 1;
  }

  public getTorusLength(): number {
    return this.torus ? this.torus.sliceNum() : 0;
  }

  public draw(): void {
    glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE_MINUS_SRC_ALPHA);
    let lineBn = 0.4;
    let polyBn = 0;
    let lightBn = 0.5 - Slice.darkLineRatio * 0.2;
    this.slice[this.slice.length - 1].setPointPos();
    for (let i = this.slice.length - 1; i >= 1; i--) {
      this.slice[i - 1].setPointPos();
      this.slice[i].draw(this.slice[i - 1], lineBn, polyBn, lightBn, this);
      lineBn *= 1.02;
      if (lineBn > 1) lineBn = 1;
      lightBn *= 1.02;
      if (lightBn > 1) lightBn = 1;
      if (i < this.slice.length / 2) {
        if (polyBn <= 0) polyBn = 0.2;
        polyBn *= 1.03;
        if (polyBn > 1) polyBn = 1;
      }
      if (i < this.slice.length * 0.75) {
        lineBn *= 1.0 - Slice.darkLineRatio * 0.05;
        lightBn *= 1.0 + Slice.darkLineRatio * 0.02;
      }
    }
    glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE);
  }

  public drawBackward(): void {
    glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE_MINUS_SRC_ALPHA);
    let lineBn = 0.4;
    let polyBn = 0;
    let lightBn = 0.5 - Slice.darkLineRatio * 0.2;
    this.sliceBackward[this.sliceBackward.length - 1].setPointPos();
    for (let i = this.sliceBackward.length - 1; i >= 1; i--) {
      this.sliceBackward[i - 1].setPointPos();
      this.sliceBackward[i].draw(this.sliceBackward[i - 1], lineBn, polyBn, lightBn, this);
      lineBn *= 1.02;
      if (lineBn > 1) lineBn = 1;
      lightBn *= 1.02;
      if (lightBn > 1) lightBn = 1;
      if (i < this.slice.length / 2) {
        if (polyBn <= 0) polyBn = 0.2;
        polyBn *= 1.03;
        if (polyBn > 1) polyBn = 1;
      }
      if (i < this.slice.length * 0.75) {
        lineBn *= 1.0 - Slice.darkLineRatio * 0.05;
        lightBn *= 1.0 + Slice.darkLineRatio * 0.02;
      }
    }
    glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE);
  }
}

/**
 * A slice of the tunnel.
 */
export class Slice {
  public static readonly DEPTH = 5;
  public static lineR = 0.7;
  public static lineG = 0.8;
  public static lineB = 1.0;
  public static polyR = 0.05;
  public static polyG = 0.12;
  public static polyB = 0.2;
  public static darkLine = false;
  public static darkLineRatio = 0;
  private _state: SliceState;
  private _d1 = 0;
  private _d2 = 0;
  private _pointFrom = 0;
  private _centerPos: Vector3;
  private pointRatio = 1;
  private pointPos: Vector3[];
  private radOfs: Vector3;
  private polyPoint: Vector3;
  private lineVerticesBuffer: number[] = [];
  private lineColorsBuffer: number[] = [];
  private polyVerticesBuffer: number[] = [];
  private polyColorsBuffer: number[] = [];
  private sideLightLineVertices = new Array<number>(15);
  private sideLightLineColors = new Array<number>(20);
  private sideLightFanVertices = new Array<number>(18);
  private sideLightFanColors = new Array<number>(24);
  private _depth = 0;

  public constructor() {
    this._state = new SliceState();
    this._centerPos = new Vector3();
    this.pointPos = Array.from({ length: SliceState.MAX_POINT_NUM }, () => new Vector3());
    this.radOfs = new Vector3();
    this.polyPoint = new Vector3();
  }

  public setFirst(pf: number, state: SliceState, dpt: number): void {
    this._centerPos.x = 0;
    this._centerPos.y = 0;
    this._centerPos.z = 0;
    this._d1 = 0;
    this._d2 = 0;
    this._pointFrom = pf;
    this._state.set(state);
    this._depth = dpt;
    this.pointRatio = 1;
  }

  public set(prevSlice: Slice, state: SliceState, depthRatio: number, dpt: number): void {
    this._d1 = prevSlice.d1 + state.md1 * depthRatio;
    this._d2 = prevSlice.d2 + state.md2 * depthRatio;
    this._centerPos.x = 0;
    this._centerPos.y = 0;
    this._centerPos.z = Slice.DEPTH * depthRatio;
    this._centerPos.rollY(this._d1);
    this._centerPos.rollX(this._d2);
    this._centerPos.x += prevSlice.centerPos.x;
    this._centerPos.y += prevSlice.centerPos.y;
    this._centerPos.z += prevSlice.centerPos.z;
    this.pointRatio = 1 + (Math.abs(depthRatio) - 1) * 0.02;
    this._pointFrom = prevSlice.pointFrom + state.mp * depthRatio;
    this._pointFrom %= state.pointNum;
    if (this._pointFrom < 0) this._pointFrom += state.pointNum;
    this._state.set(state);
    this._depth = dpt;
  }

  public draw(prevSlice: Slice, lineBn: number, polyBn: number, lightBn: number, tunnel: Tunnel): void {
    let pi = this._pointFrom;
    let width = this._state.courseWidth;
    let prevPi = 0;
    let isFirst = true;
    let polyFirst = true;
    const roundSlice = this._state.courseWidth === this._state.pointNum;
    const lineVertices = this.lineVerticesBuffer;
    const lineColors = this.lineColorsBuffer;
    const polyVertices = this.polyVerticesBuffer;
    const polyColors = this.polyColorsBuffer;
    let lv = 0;
    let lc = 0;
    let pv = 0;
    let pc = 0;
    const lineR = Slice.lineR * lineBn;
    const lineG = Slice.lineG * lineBn;
    const lineB = Slice.lineB * lineBn;
    for (;;) {
      if (!isFirst) {
        const psPi = ((pi * prevSlice.state.pointNum) / this._state.pointNum) | 0;
        const psPrevPi = ((prevPi * prevSlice.state.pointNum) / this._state.pointNum) | 0;
        const p0 = this.pointPos[pi | 0];
        const p1 = prevSlice.pointPos[psPi];
        const p2 = prevSlice.pointPos[psPrevPi];
        lineVertices[lv++] = p0.x;
        lineVertices[lv++] = p0.y;
        lineVertices[lv++] = p0.z;
        lineVertices[lv++] = p1.x;
        lineVertices[lv++] = p1.y;
        lineVertices[lv++] = p1.z;
        lineVertices[lv++] = p1.x;
        lineVertices[lv++] = p1.y;
        lineVertices[lv++] = p1.z;
        lineVertices[lv++] = p2.x;
        lineVertices[lv++] = p2.y;
        lineVertices[lv++] = p2.z;
        for (let i = 0; i < 4; i++) {
          lineColors[lc++] = lineR;
          lineColors[lc++] = lineG;
          lineColors[lc++] = lineB;
          lineColors[lc++] = 1;
        }
        if (polyBn > 0) {
          if (roundSlice || (!polyFirst && width > 0)) {
            this.polyPoint.blend(this.pointPos[prevPi | 0], prevSlice.pointPos[psPi], 0.9);
            const ax = this.polyPoint.x;
            const ay = this.polyPoint.y;
            const az = this.polyPoint.z;
            this.polyPoint.blend(this.pointPos[pi | 0], prevSlice.pointPos[psPrevPi], 0.9);
            const bx = this.polyPoint.x;
            const by = this.polyPoint.y;
            const bz = this.polyPoint.z;
            this.polyPoint.blend(this.pointPos[prevPi | 0], prevSlice.pointPos[psPi], 0.1);
            const cx = this.polyPoint.x;
            const cy = this.polyPoint.y;
            const cz = this.polyPoint.z;
            this.polyPoint.blend(this.pointPos[pi | 0], prevSlice.pointPos[psPrevPi], 0.1);
            const dx = this.polyPoint.x;
            const dy = this.polyPoint.y;
            const dz = this.polyPoint.z;
            const polyLo = polyBn / 2;
            polyVertices[pv++] = ax;
            polyVertices[pv++] = ay;
            polyVertices[pv++] = az;
            polyVertices[pv++] = bx;
            polyVertices[pv++] = by;
            polyVertices[pv++] = bz;
            polyVertices[pv++] = cx;
            polyVertices[pv++] = cy;
            polyVertices[pv++] = cz;
            polyVertices[pv++] = ax;
            polyVertices[pv++] = ay;
            polyVertices[pv++] = az;
            polyVertices[pv++] = cx;
            polyVertices[pv++] = cy;
            polyVertices[pv++] = cz;
            polyVertices[pv++] = dx;
            polyVertices[pv++] = dy;
            polyVertices[pv++] = dz;
            polyColors[pc++] = Slice.polyR;
            polyColors[pc++] = Slice.polyG;
            polyColors[pc++] = Slice.polyB;
            polyColors[pc++] = polyBn;
            polyColors[pc++] = Slice.polyR;
            polyColors[pc++] = Slice.polyG;
            polyColors[pc++] = Slice.polyB;
            polyColors[pc++] = polyBn;
            polyColors[pc++] = Slice.polyR;
            polyColors[pc++] = Slice.polyG;
            polyColors[pc++] = Slice.polyB;
            polyColors[pc++] = polyLo;
            polyColors[pc++] = Slice.polyR;
            polyColors[pc++] = Slice.polyG;
            polyColors[pc++] = Slice.polyB;
            polyColors[pc++] = polyBn;
            polyColors[pc++] = Slice.polyR;
            polyColors[pc++] = Slice.polyG;
            polyColors[pc++] = Slice.polyB;
            polyColors[pc++] = polyLo;
            polyColors[pc++] = Slice.polyR;
            polyColors[pc++] = Slice.polyG;
            polyColors[pc++] = Slice.polyB;
            polyColors[pc++] = polyLo;
          } else {
            polyFirst = false;
          }
        }
      } else {
        isFirst = false;
      }
      prevPi = pi;
      pi += this.pointRatio;
      while (pi >= this._state.pointNum) pi -= this._state.pointNum;
      if (width <= 0) break;
      width -= this.pointRatio;
    }
    if (this._state.courseWidth < this._state.pointNum) {
      pi = this._pointFrom;
      const psPi = ((pi * prevSlice.state.pointNum) / this._state.pointNum) | 0;
      const p0 = this.pointPos[pi | 0];
      const p1 = prevSlice.pointPos[psPi];
      const edgeR = (lineBn / 3) * 2;
      const edgeG = (lineBn / 3) * 2;
      const edgeB = lineBn;
      lineVertices[lv++] = p0.x;
      lineVertices[lv++] = p0.y;
      lineVertices[lv++] = p0.z;
      lineVertices[lv++] = p1.x;
      lineVertices[lv++] = p1.y;
      lineVertices[lv++] = p1.z;
      lineColors[lc++] = edgeR;
      lineColors[lc++] = edgeG;
      lineColors[lc++] = edgeB;
      lineColors[lc++] = 1;
      lineColors[lc++] = edgeR;
      lineColors[lc++] = edgeG;
      lineColors[lc++] = edgeB;
      lineColors[lc++] = 1;
    }
    lineVertices.length = lv;
    lineColors.length = lc;
    polyVertices.length = pv;
    polyColors.length = pc;
    if (lineVertices.length > 0) Screen3D.glDrawArrays(Screen3D.GL_LINES, lineVertices, lineColors);
    if (polyVertices.length > 0) Screen3D.glDrawArrays(Screen3D.GL_TRIANGLES, polyVertices, polyColors);
    if (!roundSlice && lightBn > 0.2) {
      this.drawSideLight(this.getLeftEdgeDeg() - 0.07, lightBn);
      this.drawSideLight(this.getRightEdgeDeg() + 0.07, lightBn);
    }
    if (this._state.ring && lightBn > 0.2) this._state.ring.draw(lightBn * 0.7, tunnel);
  }

  public setPointPos(): void {
    let d = 0;
    const md = (Math.PI * 2) / (this._state.pointNum - 1);
    for (const pp of this.pointPos) {
      this.radOfs.x = 0;
      this.radOfs.y = this._state.rad * Tunnel.RAD_RATIO;
      this.radOfs.z = 0;
      this.radOfs.rollZ(d);
      this.radOfs.rollY(this._d1);
      this.radOfs.rollX(this._d2);
      pp.x = this.radOfs.x + this._centerPos.x;
      pp.y = this.radOfs.y + this._centerPos.y;
      pp.z = this.radOfs.z + this._centerPos.z;
      d += md;
    }
  }

  private drawSideLight(deg: number, lightBn: number): void {
    this.radOfs.x = 0;
    this.radOfs.y = this._state.rad;
    this.radOfs.z = 0;
    this.radOfs.rollZ(deg);
    this.radOfs.rollY(this._d1);
    this.radOfs.rollX(this._d2);
    this.radOfs.opAddAssign(this._centerPos);
    const x = this.radOfs.x;
    const y = this.radOfs.y;
    const z = this.radOfs.z;
    const x0 = x - 0.5;
    const x1 = x + 0.5;
    const y0 = y - 0.5;
    const y1 = y + 0.5;
    const lineR = 1 * lightBn;
    const lineG = 1 * lightBn;
    const lineB = 0.6 * lightBn;
    const lineV = this.sideLightLineVertices;
    const lineC = this.sideLightLineColors;
    lineV[0] = x0;
    lineV[1] = y0;
    lineV[2] = z;
    lineV[3] = x1;
    lineV[4] = y0;
    lineV[5] = z;
    lineV[6] = x1;
    lineV[7] = y1;
    lineV[8] = z;
    lineV[9] = x0;
    lineV[10] = y1;
    lineV[11] = z;
    lineV[12] = x0;
    lineV[13] = y0;
    lineV[14] = z;
    for (let i = 0; i < 5; i++) {
      const ci = i * 4;
      lineC[ci] = lineR;
      lineC[ci + 1] = lineG;
      lineC[ci + 2] = lineB;
      lineC[ci + 3] = 1;
    }
    Screen3D.glDrawArrays(Screen3D.GL_LINE_STRIP, lineV, lineC);

    const fanV = this.sideLightFanVertices;
    const fanC = this.sideLightFanColors;
    fanV[0] = x;
    fanV[1] = y;
    fanV[2] = z;
    fanV[3] = x0;
    fanV[4] = y0;
    fanV[5] = z;
    fanV[6] = x0;
    fanV[7] = y1;
    fanV[8] = z;
    fanV[9] = x1;
    fanV[10] = y1;
    fanV[11] = z;
    fanV[12] = x1;
    fanV[13] = y0;
    fanV[14] = z;
    fanV[15] = x0;
    fanV[16] = y0;
    fanV[17] = z;
    fanC[0] = 0.5 * lightBn;
    fanC[1] = 0.5 * lightBn;
    fanC[2] = 0.3 * lightBn;
    fanC[3] = 1;
    for (let i = 1; i < 6; i++) {
      const ci = i * 4;
      fanC[ci] = 0.9 * lightBn;
      fanC[ci + 1] = 0.9 * lightBn;
      fanC[ci + 2] = 0.6 * lightBn;
      fanC[ci + 3] = 1;
    }
    Screen3D.glDrawArrays(Screen3D.GL_TRIANGLE_FAN, fanV, fanC);
  }

  public isNearlyRound(): boolean {
    return this._state.courseWidth >= this._state.pointNum - 1;
  }

  public getLeftEdgeDeg(): number {
    return (this._pointFrom * Math.PI * 2) / this._state.pointNum;
  }

  public getRightEdgeDeg(): number {
    let rd = ((this._pointFrom + this._state.courseWidth) * Math.PI * 2) / this._state.pointNum;
    if (rd >= Math.PI * 2) rd -= Math.PI * 2;
    return rd;
  }

  public get state(): SliceState {
    return this._state;
  }
  public get d1(): number {
    return this._d1;
  }
  public get d2(): number {
    return this._d2;
  }
  public get centerPos(): Vector3 {
    return this._centerPos;
  }
  public get pointFrom(): number {
    return this._pointFrom;
  }
  public get depth(): number {
    return this._depth;
  }
  public getPointPos(i: number): Vector3 {
    return this.pointPos[i];
  }
}

/**
 * Torus(Circuit data).
 */
export class Torus {
  private static readonly LENGTH = 5000;
  private _sliceNum = 0;
  private torusPart: TorusPart[] = [];
  private rand: Rand;
  private tpIdx = 0;
  private ring: Ring[] = [];

  public constructor() {
    this.rand = new Rand();
  }

  public create(seed: number): void {
    this.rand.setSeed(seed);
    this.tpIdx = 0;
    this.torusPart = [];
    this._sliceNum = 0;
    let tl = Torus.LENGTH;
    let prev = new SliceState();
    while (tl > 0) {
      const tp = new TorusPart();
      const lgt = 64 + this.rand.nextInt(30);
      tp.create(prev, this._sliceNum, lgt, this.rand);
      prev = tp.sliceState;
      this.torusPart.push(tp);
      tl -= tp.sliceNum;
      this._sliceNum += tp.sliceNum;
    }
    this.torusPart[0].sliceState.init();
    this.torusPart[this.torusPart.length - 1].sliceState.init();
    this.ring = [];
    let ri = 5;
    while (ri < this._sliceNum - 100) {
      const ss = this.getSliceState(ri);
      if (ri === 5) this.ring.push(new Ring(ri, ss, 1));
      else this.ring.push(new Ring(ri, ss));
      ri += 100 + this.rand.nextInt(200);
    }
  }

  public close(): void {
    for (const r of this.ring) r.close();
  }

  public getTorusPart(idx: number): TorusPart {
    for (let i = 0; i < this.torusPart.length; i++) {
      if (this.torusPart[this.tpIdx].contains(idx)) break;
      this.tpIdx++;
      if (this.tpIdx >= this.torusPart.length) this.tpIdx = 0;
    }
    return this.torusPart[this.tpIdx];
  }

  public getSliceState(idx: number): SliceState {
    const tp = this.getTorusPart(idx);
    let prvTpIdx = this.tpIdx - 1;
    if (prvTpIdx < 0) prvTpIdx = this.torusPart.length - 1;
    return tp.createBlendedSliceState(this.torusPart[prvTpIdx].sliceState, idx);
  }

  public getSliceStateWithRing(idx: number, pidx: number): SliceState {
    const ss = this.getSliceState(idx);
    ss.ring = null;
    for (const r of this.ring) {
      if (idx > pidx) {
        if (r.idx <= idx && r.idx > pidx) {
          ss.ring = r;
          break;
        }
      } else {
        if (r.idx <= idx || r.idx > pidx) {
          ss.ring = r;
          break;
        }
      }
    }
    if (ss.ring) ss.ring.move();
    return ss;
  }

  public sliceNum(): number {
    return this._sliceNum;
  }
}

export class TorusPart {
  private _sliceNum = 0;
  private _sliceState: SliceState;
  private sliceIdxFrom = 0;
  private sliceIdxTo = 0;
  private blendedSliceState: SliceState;
  private static readonly BLEND_DISTANCE = 64;

  public constructor() {
    this._sliceState = new SliceState();
    this.blendedSliceState = new SliceState();
  }

  public create(prev: SliceState, sliceIdx: number, sn: number, rand: Rand): void {
    this._sliceState.set(prev);
    this._sliceState.changeDeg(rand);
    if (Math.abs(prev.mp) >= 1) {
      if (rand.nextInt(2) === 0) {
        if (prev.mp >= 1) this._sliceState.changeToTightCurve(rand, -1);
        else this._sliceState.changeToTightCurve(rand, 1);
      } else {
        this._sliceState.changeToStraight();
      }
    } else if (prev.courseWidth === prev.pointNum || rand.nextInt(2) === 0) {
      switch (rand.nextInt(3)) {
        case 0:
          this._sliceState.changeRad(rand);
          break;
        case 1:
          this._sliceState.changeWidth(rand);
          break;
        case 2:
          this._sliceState.changeWidthToFull();
          break;
      }
    } else {
      switch (rand.nextInt(4)) {
        case 0:
          this._sliceState.changeToTightCurve(rand);
          break;
        case 2:
          this._sliceState.changeToEasyCurve(rand);
          break;
        default:
          this._sliceState.changeToStraight();
          break;
      }
    }
    this._sliceNum = sn;
    this.sliceIdxFrom = sliceIdx;
    this.sliceIdxTo = sliceIdx + this._sliceNum;
  }

  public contains(idx: number): boolean {
    return idx >= this.sliceIdxFrom && idx < this.sliceIdxTo;
  }

  public createBlendedSliceState(blendee: SliceState, idx: number): SliceState {
    const dst = idx - this.sliceIdxFrom;
    const blendRatio = dst / TorusPart.BLEND_DISTANCE;
    if (blendRatio >= 1) return this._sliceState;
    this.blendedSliceState.blend(this._sliceState, blendee, blendRatio);
    return this.blendedSliceState;
  }

  public get sliceNum(): number {
    return this._sliceNum;
  }
  public get sliceState(): SliceState {
    return this._sliceState;
  }
}

export class SliceState {
  public static readonly MAX_POINT_NUM = 36;
  public static readonly DEFAULT_POINT_NUM = 24;
  public static readonly DEFAULT_RAD = 21;
  private _md1 = 0;
  private _md2 = 0;
  private _rad = SliceState.DEFAULT_RAD;
  private _pointNum = SliceState.DEFAULT_POINT_NUM;
  private _courseWidth = this._pointNum;
  private _mp = 0;
  private _ring: Ring | null = null;

  public constructor() {
    this.init();
  }

  public init(): void {
    this._md1 = 0;
    this._md2 = 0;
    this._rad = SliceState.DEFAULT_RAD;
    this._pointNum = SliceState.DEFAULT_POINT_NUM;
    this._courseWidth = this._pointNum;
    this._mp = 0;
    this._ring = null;
  }

  public changeDeg(rand: Rand): void {
    this._md1 = rand.nextSignedFloat(0.005);
    this._md2 = rand.nextSignedFloat(0.005);
  }

  public changeRad(rand: Rand): void {
    this._rad = SliceState.DEFAULT_RAD + rand.nextSignedFloat(SliceState.DEFAULT_RAD * 0.3);
    const ppn = this._pointNum;
    this._pointNum = (this._rad * SliceState.DEFAULT_POINT_NUM / SliceState.DEFAULT_RAD) | 0;
    if (ppn === this._courseWidth) this.changeWidthToFull();
    else this._courseWidth = (this._courseWidth * this._pointNum) / ppn;
  }

  public changeWidth(rand: Rand): void {
    this._courseWidth = rand.nextInt((this._pointNum / 4) | 0) + this._pointNum * 0.36;
  }

  public changeWidthToFull(): void {
    this._courseWidth = this._pointNum;
  }

  public changeToStraight(): void {
    this._mp = 0;
  }

  public changeToEasyCurve(rand: Rand): void {
    this._mp = rand.nextFloat(0.05) + 0.04;
    if (rand.nextInt(2) === 0) this._mp = -this._mp;
  }

  public changeToTightCurve(rand: Rand, dir?: number): void {
    const d = dir ?? rand.nextInt(2) * 2 - 1;
    this._mp = (rand.nextFloat(0.04) + 0.1) * d;
  }

  public blend(s1: SliceState, s2: SliceState, ratio: number): void {
    this._md1 = s1.md1 * ratio + s2.md1 * (1 - ratio);
    this._md2 = s1.md2 * ratio + s2.md2 * (1 - ratio);
    this._rad = s1.rad * ratio + s2.rad * (1 - ratio);
    this._pointNum = (s1.pointNum * ratio + s2.pointNum * (1 - ratio)) | 0;
    if (s1.courseWidth === s1.pointNum && s2.courseWidth === s2.pointNum) this._courseWidth = this._pointNum;
    else this._courseWidth = s1.courseWidth * ratio + s2.courseWidth * (1 - ratio);
    this._mp = s1.mp;
  }

  public set(s: SliceState): void {
    this._md1 = s.md1;
    this._md2 = s.md2;
    this._rad = s.rad;
    this._pointNum = s.pointNum;
    this._courseWidth = s.courseWidth;
    this._mp = s.mp;
    this._ring = s.ring;
  }

  public get md1(): number {
    return this._md1;
  }
  public get md2(): number {
    return this._md2;
  }
  public get rad(): number {
    return this._rad;
  }
  public get pointNum(): number {
    return this._pointNum;
  }
  public get courseWidth(): number {
    return this._courseWidth;
  }
  public get mp(): number {
    return this._mp;
  }
  public get ring(): Ring | null {
    return this._ring;
  }
  public set ring(v: Ring | null) {
    this._ring = v;
  }
}

export class Ring {
  private static readonly COLOR_RGB = [
    [0.5, 1, 0.9],
    [1, 0.9, 0.5],
  ];
  private _idx: number;
  private parts: RingPart[] = [];
  private cnt: number;
  private type: number;

  public constructor(idx: number, ss: SliceState, type = 0) {
    this._idx = idx;
    this.cnt = 0;
    this.type = type;
    const r = ss.rad;
    if (type === 1) this.createFinalRing(r);
    else this.createNormalRing(r);
  }

  private createNormalRing(r: number): void {
    this.parts = [this.createRingPart(r, 1.2, 1.4, 16)];
  }

  private createFinalRing(r: number): void {
    this.parts = [this.createRingPart(r, 1.2, 1.5, 14), this.createRingPart(r, 1.6, 1.9, 14)];
  }

  private createRingPart(r: number, rr1: number, rr2: number, num: number): RingPart {
    const vertices: number[] = [];
    const baseColors: number[] = [];
    let d = 0;
    const md = 0.2;
    for (let i = 0; i < num; i++) {
      const p1 = new Vector3(Math.sin(d) * r * rr1, Math.cos(d) * r * rr1, 0);
      const p2 = new Vector3(Math.sin(d) * r * rr2, Math.cos(d) * r * rr2, 0);
      const p3 = new Vector3(Math.sin(d + md) * r * rr2, Math.cos(d + md) * r * rr2, 0);
      const p4 = new Vector3(Math.sin(d + md) * r * rr1, Math.cos(d + md) * r * rr1, 0);
      const cp = new Vector3();
      cp.opAddAssign(p1);
      cp.opAddAssign(p2);
      cp.opAddAssign(p3);
      cp.opAddAssign(p4);
      cp.opDivAssign(4);
      const np1 = new Vector3();
      const np2 = new Vector3();
      const np3 = new Vector3();
      const np4 = new Vector3();
      np1.blend(p1, cp, 0.7);
      np2.blend(p2, cp, 0.7);
      np3.blend(p3, cp, 0.7);
      np4.blend(p4, cp, 0.7);
      // GL_LINE_LOOP(np1,np2,np3,np4) -> GL_LINES x4 segments
      vertices.push(
        np1.x,
        np1.y,
        np1.z,
        np2.x,
        np2.y,
        np2.z,
        np2.x,
        np2.y,
        np2.z,
        np3.x,
        np3.y,
        np3.z,
        np3.x,
        np3.y,
        np3.z,
        np4.x,
        np4.y,
        np4.z,
        np4.x,
        np4.y,
        np4.z,
        np1.x,
        np1.y,
        np1.z,
      );
      for (let j = 0; j < 8; j++) {
        baseColors.push(1, 1, 1, 1);
      }
      d += md;
    }
    return {
      vertices,
      baseColors,
      drawColors: new Array<number>(baseColors.length).fill(1),
    };
  }

  public close(): void {
    this.parts = [];
  }

  public move(): void {
    this.cnt++;
  }

  public draw(a: number, tunnel: Tunnel): void {
    glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE);
    const c = tunnel.getCenterPos(this._idx);
    const p = c.pos;
    const d1 = c.d1;
    const d2 = c.d2;
    const r = Ring.COLOR_RGB[this.type][0] * a;
    const g = Ring.COLOR_RGB[this.type][1] * a;
    const b = Ring.COLOR_RGB[this.type][2] * a;
    glPushMatrix();
    glTranslatef(p.x, p.y, p.z);
    glRotatef(this.cnt * 1.0, 0, 0, 1);
    glRotatef(d1, 0, 1, 0);
    glRotatef(d2, 1, 0, 0);
    this.drawPart(0, r, g, b);
    glPopMatrix();
    if (this.type === 1) {
      glPushMatrix();
      glTranslatef(p.x, p.y, p.z);
      glRotatef(this.cnt * -1.0, 0, 0, 1);
      glRotatef(d1, 0, 1, 0);
      glRotatef(d2, 1, 0, 0);
      this.drawPart(1, r, g, b);
      glPopMatrix();
    }
    glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE_MINUS_SRC_ALPHA);
  }

  private drawPart(idx: number, r: number, g: number, b: number): void {
    const part = this.parts[idx];
    if (!part || part.vertices.length <= 0) return;
    for (let i = 0; i < part.drawColors.length; i += 4) {
      part.drawColors[i] = part.baseColors[i] * r;
      part.drawColors[i + 1] = part.baseColors[i + 1] * g;
      part.drawColors[i + 2] = part.baseColors[i + 2] * b;
      part.drawColors[i + 3] = 1;
    }
    Screen3D.glDrawArrays(Screen3D.GL_LINES, part.vertices, part.drawColors);
  }

  public get idx(): number {
    return this._idx;
  }
}

interface RingPart {
  vertices: number[];
  baseColors: number[];
  drawColors: number[];
}

function glPushMatrix(): void {
  Screen3D.glPushMatrix();
}
function glPopMatrix(): void {
  Screen3D.glPopMatrix();
}
function glTranslatef(x: number, y: number, z: number): void {
  Screen3D.glTranslatef(x, y, z);
}
function glRotatef(angleDeg: number, x: number, y: number, z: number): void {
  Screen3D.glRotatef(angleDeg, x, y, z);
}
function glBlendFunc(sfactor: number, dfactor: number): void {
  Screen3D.glBlendFunc(sfactor, dfactor);
}
