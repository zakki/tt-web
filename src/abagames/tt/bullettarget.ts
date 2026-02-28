/*
 * Ported from tt/src/abagames/tt/bullettarget.d
 */

import { Vector } from "../util/vector";

/**
 * Target that is aimed by bullets.
 */
export interface BulletTarget {
  getTargetPos(): Vector;
}

export class VirtualBulletTarget implements BulletTarget {
  public readonly pos: Vector;

  public constructor() {
    this.pos = new Vector();
  }

  public getTargetPos(): Vector {
    return this.pos;
  }
}
