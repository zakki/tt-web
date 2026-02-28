/*
 * Shared BulletML runner callback registration.
 */

import type { BulletMLRunner } from "../util/bulletml/bullet";
import {
  Bullet,
  createBullet_,
  createSimpleBullet_,
  doAccelX_,
  doAccelY_,
  doChangeDirection_,
  doChangeSpeed_,
  doVanish_,
  getBulletDirection_,
  getBulletSpeed_,
  getBulletSpeedX_,
  getBulletSpeedY_,
  getDefaultSpeed_,
  getRand_,
  getRank_,
  getTurn_,
  rtod,
} from "../util/bulletml/bullet";

export function registerBulletMLRunnerCallbacks(runner: BulletMLRunner): void {
  setRunnerCallback(runner, "getBulletDirection", getBulletDirection_);
  setRunnerCallback(runner, "getAimDirection", getAimDirectionWithRev_);
  setRunnerCallback(runner, "getBulletSpeed", getBulletSpeed_);
  setRunnerCallback(runner, "getDefaultSpeed", getDefaultSpeed_);
  setRunnerCallback(runner, "getRank", getRank_);
  setRunnerCallback(runner, "createSimpleBullet", createSimpleBullet_);
  setRunnerCallback(runner, "createBullet", createBullet_);
  setRunnerCallback(runner, "getTurn", getTurn_);
  setRunnerCallback(runner, "doVanish", doVanish_);
  setRunnerCallback(runner, "doChangeDirection", doChangeDirection_);
  setRunnerCallback(runner, "doChangeSpeed", doChangeSpeed_);
  setRunnerCallback(runner, "doAccelX", doAccelX_);
  setRunnerCallback(runner, "doAccelY", doAccelY_);
  setRunnerCallback(runner, "getBulletSpeedX", getBulletSpeedX_);
  setRunnerCallback(runner, "getBulletSpeedY", getBulletSpeedY_);
  setRunnerCallback(runner, "getRand", getRand_);
}

function getAimDirectionWithRev_(r: BulletMLRunner): number {
  const b = Bullet.now.pos;
  const t = Bullet.target;
  const impl = Bullet.now as unknown as { xReverse: number; yReverse: number };
  const xrev = impl.xReverse;
  const yrev = impl.yReverse;
  let ox = t.x - b.x;
  if (ox > Math.PI) ox -= Math.PI * 2;
  else if (ox < -Math.PI) ox += Math.PI * 2;
  void r;
  return rtod((Math.atan2(ox, t.y - b.y) * xrev + Math.PI / 2) * yrev - Math.PI / 2);
}

function setRunnerCallback(runner: BulletMLRunner, name: string, cb: unknown): void {
  const ex = runner as BulletMLRunner & { callbacks?: Record<string, unknown> };
  if (!ex.callbacks) ex.callbacks = {};
  ex.callbacks[name] = cb;
}
