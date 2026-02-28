/*
 * Ported from tt/src/abagames/tt/shape.d
 */

import { Rand } from "../util/rand";
import type { GLCompatStaticMesh } from "../util/sdl/glcompat";
import { Screen3D } from "../util/sdl/screen3d";
import { Vector, Vector3 } from "../util/vector";

/**
 * Interface for drawing a shape.
 */
export interface Drawable {
  draw(): void;
}

/**
 * Interface for shape that has a collision.
 */
export interface Collidable {
  collision(): Vector | null;
  checkCollision(ax: number, ay: number, shape?: Collidable | null, speed?: number): boolean;
}

abstract class CollidableBase implements Collidable {
  public abstract collision(): Vector | null;

  public checkCollision(ax: number, ay: number, shape: Collidable | null = null, speed = 1): boolean {
    const c = this.collision();
    if (!c) return false;
    let cx: number;
    let cy: number;
    if (shape) {
      const sc = shape.collision();
      if (!sc) return false;
      cx = c.x + sc.x;
      cy = c.y + sc.y;
    } else {
      cx = c.x;
      cy = c.y;
    }
    cy *= speed;
    return ax <= cx && ay <= cy;
  }
}

interface ParticleLike {
  set(...args: unknown[]): void;
}

interface ParticlePoolLike {
  getInstance(): ParticleLike | null;
}

const ParticlePType = {
  JET: 0,
  FRAGMENT: 1,
} as const;

class VboGeometry {
  private batches: { mode: number; vertices: number[]; colors: number[] }[] = [];
  private meshes: GLCompatStaticMesh[] = [];
  private uploaded = false;

  public clear(): void {
    for (const mesh of this.meshes) Screen3D.glDeleteStaticMesh(mesh);
    this.meshes = [];
    this.uploaded = false;
    this.batches = [];
  }

  public add(mode: number, vertices: number[], colors: number[] | [number, number, number, number]): void {
    if (vertices.length === 0) return;
    const colorArray = this.expandColors(vertices.length / 3, colors);
    const last = this.batches[this.batches.length - 1];
    if (last && last.mode === mode) {
      last.vertices.push(...vertices);
      last.colors.push(...colorArray);
      this.uploaded = false;
      return;
    }
    this.uploaded = false;
    this.batches.push({ mode, vertices: vertices.slice(), colors: colorArray });
  }

  public draw(): void {
    if (!this.uploaded) this.upload();
    if (this.meshes.length === this.batches.length) {
      for (const m of this.meshes) Screen3D.glDrawStaticMesh(m);
      return;
    }
    for (const b of this.batches) Screen3D.glDrawArrays(b.mode, b.vertices, b.colors);
  }

  private expandColors(vertexCount: number, colors: number[] | [number, number, number, number]): number[] {
    if (colors.length === 4) {
      const c = colors as [number, number, number, number];
      const expanded: number[] = [];
      for (let i = 0; i < vertexCount; i++) expanded.push(c[0], c[1], c[2], c[3]);
      return expanded;
    }
    return colors.slice();
  }

  private upload(): void {
    for (const mesh of this.meshes) Screen3D.glDeleteStaticMesh(mesh);
    this.meshes = [];
    for (const b of this.batches) {
      const mesh = Screen3D.glCreateStaticMesh(b.mode, b.vertices, b.colors);
      if (!mesh) {
        this.meshes = [];
        this.uploaded = false;
        return;
      }
      this.meshes.push(mesh);
    }
    this.uploaded = true;
  }
}

/**
 * Enemy and my ship shape.
 */
export class ShipShape extends CollidableBase implements Drawable {
  public static readonly Type = {
    SMALL: 0,
    MIDDLE: 1,
    LARGE: 2,
  } as const;
  private static rand = new Rand();
  private structure: Structure[] = [];
  private _collision: Vector = new Vector();
  private geometry: VboGeometry = new VboGeometry();
  private rocketX: number[] = [];
  private rocketPos: Vector = new Vector();
  private fragmentPos: Vector = new Vector();
  private color = 0;

  public constructor(randSeed: number) {
    super();
    ShipShape.rand.setSeed(randSeed);
  }

  public close(): void {
    this.geometry.clear();
  }

  public setSeed(n: number): void {
    ShipShape.rand.setSeed(n);
  }

  public create(type: number, damaged = false): void {
    this.structure = [];
    this.rocketX = [];
    switch (type) {
      case ShipShape.Type.SMALL:
        this.createSmallType(damaged);
        break;
      case ShipShape.Type.MIDDLE:
        this.createMiddleType(damaged);
        break;
      case ShipShape.Type.LARGE:
        this.createLargeType(damaged);
        break;
    }
    this.createGeometry();
    this.rocketPos = new Vector();
    this.fragmentPos = new Vector();
  }

  private createGeometry(): void {
    this.geometry.clear();
    for (const st of this.structure) st.appendGeometry(this.geometry);
  }

  private createSmallType(damaged = false): void {
    this._collision = new Vector();
    const shaftNum = 1 + ShipShape.rand.nextInt(2);
    let sx = 0.25 + ShipShape.rand.nextFloat(0.1);
    let so = 0.5 + ShipShape.rand.nextFloat(0.3);
    let sl = 0.7 + ShipShape.rand.nextFloat(0.9);
    let sw = 1.5 + ShipShape.rand.nextFloat(0.7);
    sx *= 1.5;
    so *= 1.5;
    sl *= 1.5;
    sw *= 1.5;
    const sd1 = (ShipShape.rand.nextFloat(1) * Math.PI) / 3 + Math.PI / 4;
    const sd2 = (ShipShape.rand.nextFloat(1) * Math.PI) / 10;
    const cl = ShipShape.rand.nextInt(Structure.COLOR_RGB.length - 2) + 2;
    this.color = cl;
    const shp = ShipShape.rand.nextInt(Structure.Shape.ROCKET);
    switch (shaftNum) {
      case 1:
        this.structure.push(...this.createShaft(0, 0, so, sd1, sl, 2, sw, sd1 / 2, sd2, cl, shp, 5, 1, damaged));
        this._collision.x = so / 2 + sw;
        this._collision.y = sl / 2;
        this.rocketX.push(0);
        break;
      case 2:
        this.structure.push(...this.createShaft(sx, 0, so, sd1, sl, 1, sw, sd1 / 2, sd2, cl, shp, 5, 1, damaged));
        this.structure.push(...this.createShaft(sx, 0, so, sd1, sl, 1, sw, sd1 / 2, sd2, cl, shp, 5, -1, damaged));
        this._collision.x = sx + so / 2 + sw;
        this._collision.y = sl / 2;
        this.rocketX.push(sx * 0.05, -sx * 0.05);
        break;
    }
    this._collision.x *= 0.1;
    this._collision.y *= 1.2;
  }

  private createMiddleType(damaged = false): void {
    this._collision = new Vector();
    const shaftNum = 3 + ShipShape.rand.nextInt(2);
    let sx = 1.0 + ShipShape.rand.nextFloat(0.7);
    let so = 0.9 + ShipShape.rand.nextFloat(0.6);
    let sl = 1.5 + ShipShape.rand.nextFloat(2.0);
    let sw = 2.5 + ShipShape.rand.nextFloat(1.4);
    sx *= 1.6;
    so *= 1.6;
    sl *= 1.6;
    sw *= 1.6;
    const sd1 = (ShipShape.rand.nextFloat(1) * Math.PI) / 3 + Math.PI / 4;
    const sd2 = (ShipShape.rand.nextFloat(1) * Math.PI) / 10;
    const cl = ShipShape.rand.nextInt(Structure.COLOR_RGB.length - 2) + 2;
    this.color = cl;
    const shp = ShipShape.rand.nextInt(Structure.Shape.ROCKET);
    switch (shaftNum) {
      case 3: {
        const cshp = ShipShape.rand.nextInt(Structure.Shape.ROCKET);
        this.structure.push(...this.createShaft(0, 0, so * 0.5, sd1, sl, 2, sw, sd1, sd2, cl, cshp, 8, 1, damaged));
        this.structure.push(...this.createShaft(sx, 0, so, sd1, sl * 0.8, 1, sw, sd1 / 2, sd2, cl, shp, 5, 1, damaged));
        this.structure.push(...this.createShaft(sx, 0, so, sd1, sl * 0.8, 1, sw, sd1 / 2, sd2, cl, shp, 5, -1, damaged));
        this._collision.x = sx + so / 2 + sw;
        this._collision.y = sl / 2;
        this.rocketX.push(0, sx * 0.05, -sx * 0.05);
        break;
      }
      case 4:
        this.structure.push(...this.createShaft(sx / 3, -sx / 2, so, sd1, sl * 0.7, 1, sw * 0.6, sd1 / 3, sd2 / 2, cl, shp, 5, 1));
        this.structure.push(...this.createShaft(sx / 3, -sx / 2, so, sd1, sl * 0.7, 1, sw * 0.6, sd1 / 3, sd2 / 2, cl, shp, 5, -1));
        this.structure.push(...this.createShaft(sx, 0, so, sd1, sl, 1, sw, sd1 / 2, sd2, cl, shp, 5, 1, damaged));
        this.structure.push(...this.createShaft(sx, 0, so, sd1, sl, 1, sw, sd1 / 2, sd2, cl, shp, 5, -1, damaged));
        this._collision.x = sx + so / 2 + sw;
        this._collision.y = sl / 2;
        this.rocketX.push(sx * 0.025, -sx * 0.025, sx * 0.05, -sx * 0.05);
        break;
    }
    this._collision.x *= 0.1;
    this._collision.y *= 1.2;
  }

  private createLargeType(damaged = false): void {
    this._collision = new Vector();
    const shaftNum = 5 + ShipShape.rand.nextInt(2);
    let sx = 3.0 + ShipShape.rand.nextFloat(2.2);
    let so = 1.5 + ShipShape.rand.nextFloat(1.0);
    let sl = 3.0 + ShipShape.rand.nextFloat(4.0);
    let sw = 5.0 + ShipShape.rand.nextFloat(2.5);
    sx *= 1.6;
    so *= 1.6;
    sl *= 1.6;
    sw *= 1.6;
    const sd1 = (ShipShape.rand.nextFloat(1) * Math.PI) / 3 + Math.PI / 4;
    const sd2 = (ShipShape.rand.nextFloat(1) * Math.PI) / 10;
    const cl = ShipShape.rand.nextInt(Structure.COLOR_RGB.length - 2) + 2;
    this.color = cl;
    const shp = ShipShape.rand.nextInt(Structure.Shape.ROCKET);
    switch (shaftNum) {
      case 5: {
        const cshp = ShipShape.rand.nextInt(Structure.Shape.ROCKET);
        this.structure.push(...this.createShaft(0, 0, so * 0.5, sd1, sl, 2, sw, sd1, sd2, cl, cshp, 8, 1, damaged));
        this.structure.push(...this.createShaft(sx * 0.6, 0, so, sd1, sl * 0.6, 1, sw, sd1 / 3, sd2 / 2, cl, shp, 5, 1, damaged));
        this.structure.push(...this.createShaft(sx * 0.6, 0, so, sd1, sl * 0.6, 1, sw, sd1 / 3, sd2 / 2, cl, shp, 5, -1, damaged));
        this.structure.push(...this.createShaft(sx, 0, so, sd1, sl * 0.9, 1, sw, sd1 / 2, sd2, cl, shp, 5, 1, damaged));
        this.structure.push(...this.createShaft(sx, 0, so, sd1, sl * 0.9, 1, sw, sd1 / 2, sd2, cl, shp, 5, -1, damaged));
        this._collision.x = sx + so / 2 + sw;
        this._collision.y = sl / 2;
        this.rocketX.push(0, sx * 0.03, -sx * 0.03, sx * 0.05, -sx * 0.05);
        break;
      }
      case 6:
        this.structure.push(...this.createShaft(sx / 4, -sx / 2, so, sd1, sl * 0.6, 1, sw * 0.6, sd1 / 3, sd2 / 2, cl, shp, 5, 1));
        this.structure.push(...this.createShaft(sx / 4, -sx / 2, so, sd1, sl * 0.6, 1, sw * 0.6, sd1 / 3, sd2 / 2, cl, shp, 5, -1));
        this.structure.push(...this.createShaft(sx / 2, (-sx / 3) * 2, so, sd1, sl * 0.8, 1, sw * 0.8, sd1 / 3, (sd2 / 3) * 2, cl, shp, 5, 1));
        this.structure.push(...this.createShaft(sx / 2, (-sx / 3) * 2, so, sd1, sl * 0.8, 1, sw * 0.8, sd1 / 3, (sd2 / 3) * 2, cl, shp, 5, -1));
        this.structure.push(...this.createShaft(sx, 0, so, sd1, sl, 1, sw, sd1 / 2, sd2, cl, shp, 5, 1, damaged));
        this.structure.push(...this.createShaft(sx, 0, so, sd1, sl, 1, sw, sd1 / 2, sd2, cl, shp, 5, -1, damaged));
        this._collision.x = sx + so / 2 + sw;
        this._collision.y = sl / 2;
        this.rocketX.push(sx * 0.0125, -sx * 0.0125, sx * 0.025, -sx * 0.025, sx * 0.05, -sx * 0.05);
        break;
    }
    this._collision.x *= 0.1;
    this._collision.y *= 1.2;
  }

  private createShaft(
    ox: number,
    oy: number,
    offset: number,
    od1: number,
    rocketLength: number,
    wingNum: number,
    wingWidth: number,
    wingD1: number,
    wingD2: number,
    color: number,
    shp: number,
    divNum: number,
    rev: number,
    damaged = false,
  ): Structure[] {
    const sts: Structure[] = [];
    const st = new Structure();
    st.pos.x = ox;
    st.pos.y = oy;
    st.d1 = 0;
    st.d2 = 0;
    st.width = rocketLength * 0.15;
    st.height = rocketLength;
    st.shape = Structure.Shape.ROCKET;
    st.shapeXReverse = 1;
    st.color = damaged ? 0 : 1;
    if (rev === -1) st.pos.x *= -1;
    sts.push(st);
    const wofs = offset;
    const whgt = rocketLength * (ShipShape.rand.nextFloat(0.5) + 1.5);
    for (let i = 0; i < wingNum; i++) {
      const w = new Structure();
      w.d1 = (wingD1 * 180) / Math.PI;
      w.d2 = (wingD2 * 180) / Math.PI;
      w.pos.x = ox + Math.sin(od1) * wofs;
      w.pos.y = oy + Math.cos(od1) * wofs;
      w.width = wingWidth;
      w.height = whgt;
      w.shape = shp;
      w.divNum = divNum;
      w.shapeXReverse = 1;
      w.color = damaged ? 0 : color;
      if ((((i % 2) * 2 - 1) * rev) === 1) {
        w.pos.x *= -1;
        w.d1 *= -1;
        w.shapeXReverse *= -1;
      }
      sts.push(w);
    }
    return sts;
  }

  public addParticles(pos: Vector, particles: ParticlePoolLike): void {
    for (const rx of this.rocketX) {
      const pt = particles.getInstance();
      if (!pt) break;
      this.rocketPos.x = pos.x + rx;
      this.rocketPos.y = pos.y - 0.15;
      pt.set(this.rocketPos, 1, Math.PI, 0, 0.2, 0.3, 0.4, 1.0, 16, ParticlePType.JET);
    }
  }

  public addFragments(pos: Vector, particles: ParticlePoolLike): void {
    if (this.collision() && this.collision()!.x < 0.5) return;
    for (let i = 0; i < this._collision.x * 40; i++) {
      const pt = particles.getInstance();
      if (!pt) break;
      this.fragmentPos.x = pos.x;
      this.fragmentPos.y = pos.y;
      const wb = this._collision.x;
      const hb = this._collision.y;
      pt.set(
        this.fragmentPos,
        1,
        ShipShape.rand.nextSignedFloat(0.1),
        1 + ShipShape.rand.nextSignedFloat(1),
        0.2 + ShipShape.rand.nextFloat(0.2),
        Structure.COLOR_RGB[this.color][0],
        Structure.COLOR_RGB[this.color][1],
        Structure.COLOR_RGB[this.color][2],
        32 + ShipShape.rand.nextInt(16),
        ParticlePType.FRAGMENT,
        wb + ShipShape.rand.nextFloat(wb),
        hb + ShipShape.rand.nextFloat(hb),
      );
    }
  }

  public draw(): void {
    this.geometry.draw();
  }

  public collision(): Vector {
    return this._collision;
  }
}

/**
 * Structures that make up ShipShape.
 */
export class Structure {
  public static readonly COLOR_RGB: number[][] = [
    [1, 1, 1],
    [0.6, 0.6, 0.6],
    [0.9, 0.5, 0.5],
    [0.5, 0.9, 0.5],
    [0.5, 0.5, 0.9],
    [0.7, 0.7, 0.5],
    [0.7, 0.5, 0.7],
    [0.5, 0.7, 0.7],
  ];
  public pos: Vector = new Vector();
  public d1 = 0;
  public d2 = 0;
  public static readonly Shape = {
    SQUARE: 0,
    WING: 1,
    TRIANGLE: 2,
    ROCKET: 3,
  } as const;
  public width = 0;
  public height = 0;
  public shape = 0;
  public shapeXReverse = 1;
  public color = 0;
  public divNum = 0;

  public appendGeometry(geometry: VboGeometry): void {
    const rgb = Structure.COLOR_RGB[this.color];
    const lineColor: [number, number, number, number] = [rgb[0], rgb[1], rgb[2], 1];
    const fillAlpha = this.color === 0 ? 1 : 0.5;
    const fillColor: [number, number, number, number] = [rgb[0], rgb[1], rgb[2], fillAlpha];
    switch (this.shape) {
      case Structure.Shape.SQUARE:
        for (let i = 0; i < this.divNum; i++) {
          const x11 = -0.5 + (1.0 / this.divNum) * i;
          const x12 = x11 + (1.0 / this.divNum) * 0.8;
          const x21 = -0.5 + (0.8 / this.divNum) * i;
          const x22 = x21 + (0.8 / this.divNum) * 0.8;
          this.addPrimitive(geometry, Screen3D.GL_LINE_LOOP, [x21, 0, -0.5, x22, 0, -0.5, x12, 0, 0.5, x11, 0, 0.5], lineColor);
          this.addPrimitive(geometry, Screen3D.GL_LINE_LOOP, [x21, 0.1, -0.5, x22, 0.1, -0.5, x12, 0.1, 0.5, x11, 0.1, 0.5], lineColor);
          this.addPrimitive(
            geometry,
            Screen3D.GL_TRIANGLE_FAN,
            [x21, 0, -0.5, x22, 0, -0.5, x12, 0, 0.5, x11, 0, 0.5],
            fillColor,
          );
        }
        break;
      case Structure.Shape.WING:
        for (let i = 0; i < this.divNum; i++) {
          const x1 = -0.5 + (1.0 / this.divNum) * i;
          const x2 = x1 + (1.0 / this.divNum) * 0.8;
          const y1 = x1;
          const y2 = x2;
          this.addPrimitive(geometry, Screen3D.GL_LINE_LOOP, [x1, 0, y1, x2, 0, y2, x2, 0, 0.5, x1, 0, 0.5], lineColor);
          this.addPrimitive(
            geometry,
            Screen3D.GL_LINE_LOOP,
            [x1, 0.1, y1, x2, 0.1, y2, x2, 0.1, 0.5, x1, 0.1, 0.5],
            lineColor,
          );
          this.addPrimitive(geometry, Screen3D.GL_TRIANGLE_FAN, [x1, 0, y1, x2, 0, y2, x2, 0, 0.5, x1, 0, 0.5], fillColor);
        }
        break;
      case Structure.Shape.TRIANGLE:
        for (let i = 0; i < this.divNum; i++) {
          const x1 = -0.5 + (1.0 / this.divNum) * i;
          const x2 = x1 + (1.0 / this.divNum) * 0.8;
          const y1 = -0.5 + (1.0 / this.divNum) * Math.abs(i - this.divNum / 2) * 2;
          const y2 = -0.5 + (1.0 / this.divNum) * Math.abs(i + 0.8 - this.divNum / 2) * 2;
          this.addPrimitive(geometry, Screen3D.GL_LINE_LOOP, [x1, 0, y1, x2, 0, y2, x2, 0, 0.5, x1, 0, 0.5], lineColor);
          this.addPrimitive(
            geometry,
            Screen3D.GL_LINE_LOOP,
            [x1, 0.1, y1, x2, 0.1, y2, x2, 0.1, 0.5, x1, 0.1, 0.5],
            lineColor,
          );
          this.addPrimitive(geometry, Screen3D.GL_TRIANGLE_FAN, [x1, 0, y1, x2, 0, y2, x2, 0, 0.5, x1, 0, 0.5], fillColor);
        }
        break;
      case Structure.Shape.ROCKET:
        for (let i = 0; i < 4; i++) {
          const d = (i * Math.PI) / 2 + Math.PI / 4;
          const v = [
            Math.sin(d - 0.3),
            Math.cos(d - 0.3),
            -0.5,
            Math.sin(d + 0.3),
            Math.cos(d + 0.3),
            -0.5,
            Math.sin(d + 0.3),
            Math.cos(d + 0.3),
            0.5,
            Math.sin(d - 0.3),
            Math.cos(d - 0.3),
            0.5,
          ];
          this.addPrimitive(geometry, Screen3D.GL_LINE_LOOP, v, lineColor);
          this.addPrimitive(geometry, Screen3D.GL_TRIANGLE_FAN, v, fillColor);
        }
        break;
    }
  }

  private addPrimitive(
    geometry: VboGeometry,
    mode: number,
    vertices: number[],
    colors: number[] | [number, number, number, number],
  ): void {
    const transformed: number[] = [];
    for (let i = 0; i < vertices.length; i += 3) {
      const p = this.transformPoint(vertices[i], vertices[i + 1], vertices[i + 2]);
      transformed.push(p[0], p[1], p[2]);
    }
    geometry.add(mode, transformed, colors);
  }

  private transformPoint(x: number, y: number, z: number): [number, number, number] {
    x *= this.shapeXReverse;
    if (this.shape === Structure.Shape.ROCKET) {
      x *= this.width;
      y *= this.width;
      z *= this.height;
    } else {
      x *= this.width;
      y *= this.height;
    }
    const zRad = (this.d1 * Math.PI) / 180;
    const zCos = Math.cos(zRad);
    const zSin = Math.sin(zRad);
    const rx = x * zCos - y * zSin;
    const ry = x * zSin + y * zCos;
    const xRad = (-this.d2 * Math.PI) / 180;
    const xCos = Math.cos(xRad);
    const xSin = Math.sin(xRad);
    const y2 = ry * xCos - z * xSin;
    const z2 = ry * xSin + z * xCos;
    return [rx + this.pos.x, y2 + this.pos.y, z2];
  }
}

/**
 * Shape for an enemy's bit.
 */
export class BitShape implements Drawable {
  private static readonly COLOR_RGB = [1, 0.9, 0.5];
  private geometry: VboGeometry = new VboGeometry();

  public create(): void {
    this.geometry.clear();
    const lineColor: [number, number, number, number] = [BitShape.COLOR_RGB[0], BitShape.COLOR_RGB[1], BitShape.COLOR_RGB[2], 1];
    const fillColor: [number, number, number, number] = [BitShape.COLOR_RGB[0], BitShape.COLOR_RGB[1], BitShape.COLOR_RGB[2], 0.5];
    for (let i = 0; i < 4; i++) {
      let d = (i * Math.PI) / 2 + Math.PI / 4;
      const innerVerts = [
        Math.sin(d - 0.3),
        -0.8,
        Math.cos(d - 0.3),
        Math.sin(d + 0.3),
        -0.8,
        Math.cos(d + 0.3),
        Math.sin(d + 0.3),
        0.8,
        Math.cos(d + 0.3),
        Math.sin(d - 0.3),
        0.8,
        Math.cos(d - 0.3),
      ];
      this.geometry.add(Screen3D.GL_LINE_LOOP, innerVerts, lineColor);
      d += Math.PI / 4;
      const outerVerts = [
        Math.sin(d - 0.3) * 2,
        -0.2,
        Math.cos(d - 0.3) * 2,
        Math.sin(d + 0.3) * 2,
        -0.2,
        Math.cos(d + 0.3) * 2,
        Math.sin(d + 0.3) * 2,
        0.2,
        Math.cos(d + 0.3) * 2,
        Math.sin(d - 0.3) * 2,
        0.2,
        Math.cos(d - 0.3) * 2,
      ];
      this.geometry.add(Screen3D.GL_LINE_LOOP, outerVerts, lineColor);
      d -= Math.PI / 4;
      this.geometry.add(Screen3D.GL_TRIANGLE_FAN, innerVerts, fillColor);
      d += Math.PI / 4;
      this.geometry.add(Screen3D.GL_TRIANGLE_FAN, outerVerts, fillColor);
    }
  }

  public close(): void {
    this.geometry.clear();
  }

  public draw(): void {
    this.geometry.draw();
  }
}

/**
 * Shape for an enemy's bullet.
 */
export class BulletShape implements Drawable {
  public static readonly BSType = {
    TRIANGLE: 0,
    TRIANGLE_WIRE: 1,
    SQUARE: 2,
    SQUARE_WIRE: 3,
    BAR: 4,
    BAR_WIRE: 5,
  } as const;
  public static readonly NUM = 6;
  private static readonly COLOR_RGB = [1, 0.7, 0.8];
  private geometry: VboGeometry = new VboGeometry();

  public create(type: number): void {
    this.geometry.clear();
    switch (type) {
      case 0:
        this.createTriangleShape(false);
        break;
      case 1:
        this.createTriangleShape(true);
        break;
      case 2:
        this.createSquareShape(false);
        break;
      case 3:
        this.createSquareShape(true);
        break;
      case 4:
        this.createBarShape(false);
        break;
      case 5:
        this.createBarShape(true);
        break;
    }
  }

  public close(): void {
    this.geometry.clear();
  }

  private createTriangleShape(wireShape: boolean): void {
    const cp = new Vector3();
    const p1 = new Vector3();
    const p2 = new Vector3();
    const p3 = new Vector3();
    const np1 = new Vector3();
    const np2 = new Vector3();
    const np3 = new Vector3();
    for (let i = 0; i < 3; i++) {
      const d = ((Math.PI * 2) / 3) * i;
      p1.x = 0;
      p1.y = 0;
      p1.z = 2.5;
      p2.x = Math.sin(d) * 1.8;
      p2.y = Math.cos(d) * 1.8;
      p2.z = -1.2;
      p3.x = Math.sin(d + (Math.PI * 2) / 3) * 1.2;
      p3.y = Math.cos(d + (Math.PI * 2) / 3) * 1.2;
      p3.z = -1.2;
      cp.x = 0;
      cp.y = 0;
      cp.z = 0;
      cp.opAddAssign(p1);
      cp.opAddAssign(p2);
      cp.opAddAssign(p3);
      cp.opDivAssign(3);
      np1.blend(p1, cp, 0.6);
      np2.blend(p2, cp, 0.6);
      np3.blend(p3, cp, 0.6);
      const lineColor: [number, number, number, number] = !wireShape
        ? [BulletShape.COLOR_RGB[0], BulletShape.COLOR_RGB[1], BulletShape.COLOR_RGB[2], 1]
        : [BulletShape.COLOR_RGB[0] * 0.6, BulletShape.COLOR_RGB[1], BulletShape.COLOR_RGB[2], 1];
      const lineVertices = [np1.x, np1.y, np1.z, np2.x, np2.y, np2.z, np3.x, np3.y, np3.z];
      this.geometry.add(Screen3D.GL_LINE_LOOP, lineVertices, lineColor);
      if (!wireShape) {
        this.geometry.add(Screen3D.GL_TRIANGLE_FAN, lineVertices, [
          BulletShape.COLOR_RGB[0] * 0.7,
          BulletShape.COLOR_RGB[1] * 0.7,
          BulletShape.COLOR_RGB[2] * 0.7,
          1,
          BulletShape.COLOR_RGB[0] * 0.4,
          BulletShape.COLOR_RGB[1] * 0.4,
          BulletShape.COLOR_RGB[2] * 0.4,
          1,
          BulletShape.COLOR_RGB[0] * 0.4,
          BulletShape.COLOR_RGB[1] * 0.4,
          BulletShape.COLOR_RGB[2] * 0.4,
          1,
        ]);
      }
    }
  }

  private createSquareShape(wireShape: boolean): void {
    const cp = new Vector3();
    const p = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    const np = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    const POINT_DAT = [
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
      [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]],
      [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
      [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
      [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]],
      [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
    ];
    for (let i = 0; i < 6; i++) {
      cp.x = 0;
      cp.y = 0;
      cp.z = 0;
      for (let j = 0; j < 4; j++) {
        p[j].x = POINT_DAT[i][j][0];
        p[j].y = POINT_DAT[i][j][1];
        p[j].z = POINT_DAT[i][j][2];
        cp.opAddAssign(p[j]);
      }
      cp.opDivAssign(4);
      for (let j = 0; j < 4; j++) np[j].blend(p[j], cp, 0.6);
      const lineColor: [number, number, number, number] = !wireShape
        ? [BulletShape.COLOR_RGB[0], BulletShape.COLOR_RGB[1], BulletShape.COLOR_RGB[2], 1]
        : [BulletShape.COLOR_RGB[0] * 0.6, BulletShape.COLOR_RGB[1], BulletShape.COLOR_RGB[2], 1];
      const vertices: number[] = [];
      for (let j = 0; j < 4; j++) vertices.push(np[j].x, np[j].y, np[j].z);
      this.geometry.add(Screen3D.GL_LINE_LOOP, vertices, lineColor);
      if (!wireShape) {
        this.geometry.add(
          Screen3D.GL_TRIANGLE_FAN,
          vertices,
          [BulletShape.COLOR_RGB[0] * 0.7, BulletShape.COLOR_RGB[1] * 0.7, BulletShape.COLOR_RGB[2] * 0.7, 1],
        );
      }
    }
  }

  private createBarShape(wireShape: boolean): void {
    const cp = new Vector3();
    const p = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    const np = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    const POINT_DAT = [
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
      [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
      [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
      [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]],
      [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
    ];
    for (let i = 0; i < 5; i++) {
      cp.x = 0;
      cp.y = 0;
      cp.z = 0;
      for (let j = 0; j < 4; j++) {
        p[j].x = POINT_DAT[i][j][0] * 0.7;
        p[j].y = POINT_DAT[i][j][1] * 0.7;
        p[j].z = POINT_DAT[i][j][2] * 1.75;
        cp.opAddAssign(p[j]);
      }
      cp.opDivAssign(4);
      for (let j = 0; j < 4; j++) np[j].blend(p[j], cp, 0.6);
      const lineColor: [number, number, number, number] = !wireShape
        ? [BulletShape.COLOR_RGB[0], BulletShape.COLOR_RGB[1], BulletShape.COLOR_RGB[2], 1]
        : [BulletShape.COLOR_RGB[0] * 0.6, BulletShape.COLOR_RGB[1], BulletShape.COLOR_RGB[2], 1];
      const vertices: number[] = [];
      for (let j = 0; j < 4; j++) vertices.push(np[j].x, np[j].y, np[j].z);
      this.geometry.add(Screen3D.GL_LINE_LOOP, vertices, lineColor);
      if (!wireShape) {
        this.geometry.add(
          Screen3D.GL_TRIANGLE_FAN,
          vertices,
          [BulletShape.COLOR_RGB[0] * 0.7, BulletShape.COLOR_RGB[1] * 0.7, BulletShape.COLOR_RGB[2] * 0.7, 1],
        );
      }
    }
  }

  public draw(): void {
    this.geometry.draw();
  }
}

/**
 * Shape for a player's shot.
 */
export class ShotShape extends CollidableBase implements Drawable {
  private static readonly COLOR_RGB = [0.8, 1, 0.7];
  private geometry: VboGeometry = new VboGeometry();
  private _collision: Vector = new Vector(0.15, 0.3);

  public create(charge: boolean): void {
    this.geometry.clear();
    const lineColor: [number, number, number, number] = [ShotShape.COLOR_RGB[0], ShotShape.COLOR_RGB[1], ShotShape.COLOR_RGB[2], 1];
    const headColor = [ShotShape.COLOR_RGB[0], ShotShape.COLOR_RGB[1], ShotShape.COLOR_RGB[2], 1];
    const tailColor = [ShotShape.COLOR_RGB[0] * 0.2, ShotShape.COLOR_RGB[1] * 0.2, ShotShape.COLOR_RGB[2] * 0.2, 1];
    if (charge) {
      for (let i = 0; i < 8; i++) {
        const d = (i * Math.PI) / 4;
        const vertices = [
          Math.sin(d) * 0.1,
          Math.cos(d) * 0.1,
          0.2,
          Math.sin(d) * 0.5,
          Math.cos(d) * 0.5,
          0.5,
          Math.sin(d) * 1.0,
          Math.cos(d) * 1.0,
          -0.7,
        ];
        this.geometry.add(Screen3D.GL_TRIANGLES, vertices, [...headColor, ...headColor, ...tailColor]);
        this.geometry.add(Screen3D.GL_LINE_LOOP, vertices, lineColor);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const d = (i * Math.PI) / 2;
        const vertices = [
          Math.sin(d) * 0.1,
          Math.cos(d) * 0.1,
          0.4,
          Math.sin(d) * 0.3,
          Math.cos(d) * 0.3,
          1.0,
          Math.sin(d) * 0.5,
          Math.cos(d) * 0.5,
          -1.4,
        ];
        this.geometry.add(Screen3D.GL_TRIANGLES, vertices, [...headColor, ...headColor, ...tailColor]);
        this.geometry.add(Screen3D.GL_LINE_LOOP, vertices, lineColor);
      }
    }
    this._collision = new Vector(0.15, 0.3);
  }

  public close(): void {
    this.geometry.clear();
  }

  public draw(): void {
    this.geometry.draw();
  }

  public collision(): Vector {
    return this._collision;
  }
}

/**
 * Drawable that can change its size.
 */
export class ResizableDrawable extends CollidableBase implements Drawable {
  private _shape: Drawable | null = null;
  private _size = 1;
  private _collision: Vector = new Vector();

  public draw(): void {
    Screen3D.glScalef(this._size, this._size, this._size);
    this._shape?.draw();
  }

  public shape(v: Drawable): Drawable {
    this._collision = new Vector();
    this._shape = v;
    return this._shape;
  }

  public size(v: number): number {
    this._size = v;
    return this._size;
  }

  public collision(): Vector | null {
    const cd = this._shape as Collidable | null;
    if (cd?.collision()) {
      this._collision.x = (cd.collision() as Vector).x * this._size;
      this._collision.y = (cd.collision() as Vector).y * this._size;
      return this._collision;
    }
    return null;
  }
}
