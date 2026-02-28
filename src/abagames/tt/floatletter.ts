/*
 * Ported from tt/src/abagames/tt/floatletter.d
 */

import { Actor, ActorPool } from "../util/actor";
import { Rand } from "../util/rand";
import { Screen3D } from "../util/sdl/screen3d";
import { Vector, Vector3 } from "../util/vector";
import { Letter } from "./letter";
import { Screen } from "./screen";
import { Tunnel } from "./tunnel";

/**
 * Floating letters (display the multiplier).
 */
export class FloatLetter extends Actor {
  private static readonly rand = new Rand();
  private tunnel!: Tunnel;
  private pos!: Vector3;
  private mx = 0;
  private my = 0;
  private d = 0;
  private size = 0;
  private msg = "";
  private cnt = 0;
  private alpha = 0;

  public static setRandSeed(seed: number): void {
    FloatLetter.rand.setSeed(seed);
  }

  public override init(args: unknown[] | null): void {
    if (!args || args.length < 1) throw new Error("FloatLetter.init requires args");
    this.tunnel = args[0] as Tunnel;
    this.pos = new Vector3();
  }

  public set(m: string, p: Vector, s: number, c = 120): void {
    this.pos.x = p.x;
    this.pos.y = p.y;
    this.pos.z = 1;
    this.mx = FloatLetter.rand.nextSignedFloat(0.001);
    this.my = -FloatLetter.rand.nextFloat(0.2) + 0.2;
    this.d = p.x;
    this.size = s;
    this.msg = m;
    this.cnt = c;
    this.alpha = 0.8;
    this.exists = true;
  }

  public override move(): void {
    this.pos.x += this.mx * this.pos.y;
    this.pos.y += this.my;
    this.pos.z -= 0.03 * this.pos.y;
    this.cnt--;
    if (this.cnt < 0) this.exists = false;
    if (this.alpha >= 0.03) this.alpha -= 0.03;
  }

  public override draw(): void {
    glPushMatrix();
    const sp = this.tunnel.getPos(this.pos);
    glTranslatef(0, 0, sp.z);
    Screen.setColor(1, 1, 1, 1);
    Letter.drawString(this.msg, sp.x, sp.y, this.size, Letter.Direction.TO_RIGHT, 2, false, (this.d * 180) / Math.PI);
    Screen.setColor(1, 1, 1, this.alpha);
    Letter.drawString(this.msg, sp.x, sp.y, this.size, Letter.Direction.TO_RIGHT, 3, false, (this.d * 180) / Math.PI);
    glPopMatrix();
  }
}

export class FloatLetterPool extends ActorPool<FloatLetter> {
  public constructor(n: number, args: unknown[]) {
    super(undefined, null, () => new FloatLetter());
    this.createActors(n, args);
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
