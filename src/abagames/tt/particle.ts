/*
 * Ported from tt/src/abagames/tt/particle.d
 */

import { Rand } from "../util/rand";
import { LuminousActor, LuminousActorPool } from "../util/sdl/luminous";
import { Screen3D } from "../util/sdl/screen3d";
import { Vector, Vector3 } from "../util/vector";
import { Ship } from "./ship";
import { Tunnel } from "./tunnel";

/**
 * Particles.
 */
export class Particle extends LuminousActor {
  public static readonly PType = {
    SPARK: 0,
    STAR: 1,
    FRAGMENT: 2,
    JET: 3,
  } as const;
  private static readonly GRAVITY = 0.02;
  private static readonly SIZE = 0.3;
  private static readonly rand = new Rand();
  private tunnel!: Tunnel;
  private ship!: Ship;
  private pos!: Vector3;
  private vel!: Vector3;
  private sp!: Vector3;
  private psp!: Vector3;
  private rsp!: Vector3;
  private rpsp!: Vector3;
  private icp!: Vector;
  private r = 0;
  private g = 0;
  private b = 0;
  private lumAlp = 0;
  private cnt = 0;
  private inCourse = true;
  private type: number = Particle.PType.SPARK;
  private d1 = 0;
  private d2 = 0;
  private md1 = 0;
  private md2 = 0;
  private width = 0;
  private height = 0;
  private sparkVertices = new Array<number>(18);
  private sparkColors = new Array<number>(24);
  private reflectedSparkVertices = new Array<number>(18);
  private reflectedSparkColors = new Array<number>(24);
  private starVertices = new Array<number>(6);
  private starColors = new Array<number>(8);
  private fragmentLineVertices = new Array<number>(15);
  private fragmentLineColors = new Array<number>(20);
  private fragmentFanVertices = new Array<number>(12);
  private fragmentFanColors = new Array<number>(16);
  private luminousVertices = new Array<number>(18);
  private luminousColors = new Array<number>(24);

  public static setRandSeed(seed: number): void {
    Particle.rand.setSeed(seed);
  }

  public override init(args: unknown[] | null): void {
    if (!args || args.length < 2) throw new Error("Particle.init requires args");
    this.tunnel = args[0] as Tunnel;
    this.ship = args[1] as Ship;
    this.pos = new Vector3();
    this.vel = new Vector3();
    this.sp = new Vector3();
    this.psp = new Vector3();
    this.rsp = new Vector3();
    this.rpsp = new Vector3();
    this.icp = new Vector();
  }

  public set(
    p: Vector,
    z: number,
    d: number,
    mz: number,
    speed: number,
    r: number,
    g: number,
    b: number,
    c = 16,
    t = Particle.PType.SPARK,
    w = 0,
    h = 0,
  ): void {
    this.pos.x = p.x;
    this.pos.y = p.y;
    this.pos.z = z;
    const sb = Particle.rand.nextFloat(0.8) + 0.4;
    this.vel.x = Math.sin(d) * speed * sb;
    this.vel.y = Math.cos(d) * speed * sb;
    this.vel.z = mz;
    this.r = r;
    this.g = g;
    this.b = b;
    this.cnt = c + Particle.rand.nextInt((c / 2) | 0);
    this.type = t;
    this.lumAlp = 0.8 + Particle.rand.nextFloat(0.2);
    this.inCourse = this.type !== Particle.PType.STAR;
    if (this.type === Particle.PType.FRAGMENT) {
      this.d1 = 0;
      this.d2 = 0;
      this.md1 = Particle.rand.nextSignedFloat(12);
      this.md2 = Particle.rand.nextSignedFloat(12);
      this.width = w;
      this.height = h;
    }
    this.checkInCourse();
    this.calcScreenPos();
    this.exists = true;
  }

  public override move(): void {
    this.cnt--;
    if (this.cnt < 0 || this.pos.y < -2) {
      this.exists = false;
      return;
    }
    this.psp.x = this.sp.x;
    this.psp.y = this.sp.y;
    this.psp.z = this.sp.z;
    if (this.inCourse) {
      this.rpsp.x = this.rsp.x;
      this.rpsp.y = this.rsp.y;
      this.rpsp.z = this.rsp.z;
    }
    this.pos.opAddAssign(this.vel);
    if (this.type === Particle.PType.FRAGMENT) this.pos.y -= this.ship.speed / 2;
    else if (this.type === Particle.PType.SPARK) this.pos.y -= this.ship.speed * 0.33;
    else this.pos.y -= this.ship.speed;
    if (this.type !== Particle.PType.STAR) {
      if (this.type === Particle.PType.FRAGMENT) this.vel.z -= Particle.GRAVITY / 2;
      else this.vel.z -= Particle.GRAVITY;
      if (this.inCourse && this.pos.z < 0) {
        if (this.type === Particle.PType.FRAGMENT) this.vel.z *= -0.6;
        else this.vel.z *= -0.8;
        this.vel.opMulAssign(0.9);
        this.pos.z += this.vel.z * 2;
        this.checkInCourse();
      }
    }
    if (this.type === Particle.PType.FRAGMENT) {
      this.d1 += this.md1;
      this.d2 += this.md2;
      this.md1 *= 0.98;
      this.md2 *= 0.98;
      this.width *= 0.98;
      this.height *= 0.98;
    }
    this.lumAlp *= 0.98;
    this.calcScreenPos();
  }

  private calcScreenPos(): void {
    let p = this.tunnel.getPos(this.pos);
    this.sp.x = p.x;
    this.sp.y = p.y;
    this.sp.z = p.z;
    if (this.inCourse) {
      this.pos.z = -this.pos.z;
      p = this.tunnel.getPos(this.pos);
      this.rsp.x = p.x;
      this.rsp.y = p.y;
      this.rsp.z = p.z;
      this.pos.z = -this.pos.z;
    }
  }

  private checkInCourse(): void {
    this.icp.x = this.pos.x;
    this.icp.y = this.pos.y;
    if (this.tunnel.checkInCourse(this.icp) !== 0) this.inCourse = false;
  }

  public override draw(): void {
    switch (this.type) {
      case Particle.PType.SPARK:
      case Particle.PType.JET:
        this.drawSpark();
        break;
      case Particle.PType.STAR:
        this.drawStar();
        break;
      case Particle.PType.FRAGMENT:
        this.drawFragment();
        break;
    }
  }

  private drawSpark(): void {
    this.setSparkFan(this.sparkVertices, this.sparkColors, this.psp, this.sp, 0.5);
    Screen3D.glDrawArrays(Screen3D.GL_TRIANGLE_FAN, this.sparkVertices, this.sparkColors);
    if (this.inCourse) {
      this.setSparkFan(this.reflectedSparkVertices, this.reflectedSparkColors, this.rpsp, this.rsp, 0.2);
      Screen3D.glDrawArrays(Screen3D.GL_TRIANGLE_FAN, this.reflectedSparkVertices, this.reflectedSparkColors);
    }
  }

  private drawStar(): void {
    const v = this.starVertices;
    const c = this.starColors;
    v[0] = this.psp.x;
    v[1] = this.psp.y;
    v[2] = this.psp.z;
    v[3] = this.sp.x;
    v[4] = this.sp.y;
    v[5] = this.sp.z;
    c[0] = this.r;
    c[1] = this.g;
    c[2] = this.b;
    c[3] = 1;
    c[4] = this.r;
    c[5] = this.g;
    c[6] = this.b;
    c[7] = 0.2;
    Screen3D.glDrawArrays(Screen3D.GL_LINES, v, c);
  }

  private drawFragment(): void {
    glPushMatrix();
    glTranslatef(this.sp.x, this.sp.y, this.sp.z);
    glRotatef(this.d1, 0, 0, 1);
    glRotatef(this.d2, 0, 1, 0);
    const lv = this.fragmentLineVertices;
    const lc = this.fragmentLineColors;
    const fv = this.fragmentFanVertices;
    const fc = this.fragmentFanColors;
    const x = this.width;
    const z = this.height;
    lv[0] = x;
    lv[1] = 0;
    lv[2] = z;
    lv[3] = -x;
    lv[4] = 0;
    lv[5] = z;
    lv[6] = -x;
    lv[7] = 0;
    lv[8] = -z;
    lv[9] = x;
    lv[10] = 0;
    lv[11] = -z;
    lv[12] = x;
    lv[13] = 0;
    lv[14] = z;
    for (let i = 0; i < 5; i++) {
      const ci = i * 4;
      lc[ci] = this.r;
      lc[ci + 1] = this.g;
      lc[ci + 2] = this.b;
      lc[ci + 3] = 0.5;
    }
    Screen3D.glDrawArrays(Screen3D.GL_LINE_STRIP, lv, lc);
    fv[0] = x;
    fv[1] = 0;
    fv[2] = z;
    fv[3] = -x;
    fv[4] = 0;
    fv[5] = z;
    fv[6] = -x;
    fv[7] = 0;
    fv[8] = -z;
    fv[9] = x;
    fv[10] = 0;
    fv[11] = -z;
    for (let i = 0; i < 4; i++) {
      const ci = i * 4;
      fc[ci] = this.r;
      fc[ci + 1] = this.g;
      fc[ci + 2] = this.b;
      fc[ci + 3] = 0.2;
    }
    Screen3D.glDrawArrays(Screen3D.GL_TRIANGLE_FAN, fv, fc);
    glPopMatrix();
  }

  public override drawLuminous(): void {
    if (this.lumAlp < 0.2 || this.type !== Particle.PType.SPARK) return;
    this.setSparkFan(this.luminousVertices, this.luminousColors, this.psp, this.sp, this.lumAlp * 0.6);
    Screen3D.glDrawArrays(Screen3D.GL_TRIANGLE_FAN, this.luminousVertices, this.luminousColors);
  }

  public appendDrawBatch(
    sparkVertices: number[],
    sparkColors: number[],
    starVertices: number[],
    starColors: number[],
    fragments: Particle[],
  ): void {
    switch (this.type) {
      case Particle.PType.SPARK:
      case Particle.PType.JET:
        this.appendSparkTriangles(sparkVertices, sparkColors, this.psp, this.sp, 0.5);
        if (this.inCourse) this.appendSparkTriangles(sparkVertices, sparkColors, this.rpsp, this.rsp, 0.2);
        break;
      case Particle.PType.STAR:
        starVertices.push(this.psp.x, this.psp.y, this.psp.z, this.sp.x, this.sp.y, this.sp.z);
        starColors.push(this.r, this.g, this.b, 1, this.r, this.g, this.b, 0.2);
        break;
      case Particle.PType.FRAGMENT:
        fragments.push(this);
        break;
    }
  }

  public appendLuminousBatch(vertices: number[], colors: number[]): void {
    if (this.lumAlp < 0.2 || this.type !== Particle.PType.SPARK) return;
    this.appendSparkTriangles(vertices, colors, this.psp, this.sp, this.lumAlp * 0.6);
  }

  public drawFragmentOnly(): void {
    this.drawFragment();
  }

  private appendSparkTriangles(vertices: number[], colors: number[], center: Vector3, edgeCenter: Vector3, centerAlpha: number): void {
    const x0 = edgeCenter.x - Particle.SIZE;
    const x1 = edgeCenter.x + Particle.SIZE;
    const y0 = edgeCenter.y - Particle.SIZE;
    const y1 = edgeCenter.y + Particle.SIZE;
    const z = edgeCenter.z;
    const cx = center.x;
    const cy = center.y;
    const cz = center.z;
    vertices.push(
      cx,
      cy,
      cz,
      x0,
      y0,
      z,
      x1,
      y0,
      z,
      cx,
      cy,
      cz,
      x1,
      y0,
      z,
      x1,
      y1,
      z,
      cx,
      cy,
      cz,
      x1,
      y1,
      z,
      x0,
      y1,
      z,
      cx,
      cy,
      cz,
      x0,
      y1,
      z,
      x0,
      y0,
      z,
    );
    for (let i = 0; i < 4; i++) {
      colors.push(this.r, this.g, this.b, centerAlpha, this.r, this.g, this.b, 0, this.r, this.g, this.b, 0);
    }
  }

  private setSparkFan(vertices: number[], colors: number[], center: Vector3, edgeCenter: Vector3, centerAlpha: number): void {
    const x0 = edgeCenter.x - Particle.SIZE;
    const x1 = edgeCenter.x + Particle.SIZE;
    const y0 = edgeCenter.y - Particle.SIZE;
    const y1 = edgeCenter.y + Particle.SIZE;
    const z = edgeCenter.z;
    vertices[0] = center.x;
    vertices[1] = center.y;
    vertices[2] = center.z;
    vertices[3] = x0;
    vertices[4] = y0;
    vertices[5] = z;
    vertices[6] = x1;
    vertices[7] = y0;
    vertices[8] = z;
    vertices[9] = x1;
    vertices[10] = y1;
    vertices[11] = z;
    vertices[12] = x0;
    vertices[13] = y1;
    vertices[14] = z;
    vertices[15] = x0;
    vertices[16] = y0;
    vertices[17] = z;
    colors[0] = this.r;
    colors[1] = this.g;
    colors[2] = this.b;
    colors[3] = centerAlpha;
    for (let i = 1; i < 6; i++) {
      const ci = i * 4;
      colors[ci] = this.r;
      colors[ci + 1] = this.g;
      colors[ci + 2] = this.b;
      colors[ci + 3] = 0;
    }
  }
}

export class ParticlePool extends LuminousActorPool<Particle> {
  private sparkVertices: number[] = [];
  private sparkColors: number[] = [];
  private starVertices: number[] = [];
  private starColors: number[] = [];
  private fragmentParticles: Particle[] = [];
  private luminousSparkVertices: number[] = [];
  private luminousSparkColors: number[] = [];

  public constructor(n: number, args: unknown[]) {
    super(n, args, () => new Particle());
  }

  public override draw(): void {
    this.sparkVertices.length = 0;
    this.sparkColors.length = 0;
    this.starVertices.length = 0;
    this.starColors.length = 0;
    this.fragmentParticles.length = 0;
    for (let i = 0; i < this.actor.length; i++) {
      const p = this.actor[i];
      if (!p.exists) continue;
      p.appendDrawBatch(
        this.sparkVertices,
        this.sparkColors,
        this.starVertices,
        this.starColors,
        this.fragmentParticles,
      );
    }
    if (this.sparkVertices.length > 0) {
      Screen3D.glDrawArrays(Screen3D.GL_TRIANGLES, this.sparkVertices, this.sparkColors);
    }
    if (this.starVertices.length > 0) {
      Screen3D.glDrawArrays(Screen3D.GL_LINES, this.starVertices, this.starColors);
    }
    for (let i = 0; i < this.fragmentParticles.length; i++) {
      this.fragmentParticles[i].drawFragmentOnly();
    }
  }

  public override drawLuminous(): void {
    this.luminousSparkVertices.length = 0;
    this.luminousSparkColors.length = 0;
    for (let i = 0; i < this.actor.length; i++) {
      const p = this.actor[i];
      if (!p.exists) continue;
      p.appendLuminousBatch(this.luminousSparkVertices, this.luminousSparkColors);
    }
    if (this.luminousSparkVertices.length > 0) {
      Screen3D.glDrawArrays(Screen3D.GL_TRIANGLES, this.luminousSparkVertices, this.luminousSparkColors);
    }
  }
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
