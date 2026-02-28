/*
 * BulletML bridge for Web port.
 *
 * D source references:
 * - tt/src/abagames/tt/bulletactor.d
 * - tt/src/abagames/tt/bulletactorpool.d
 */

import type { BulletMLRunner, BulletMLState } from "../util/bulletml/bullet";

type RunnerFactory = {
  createRunnerFromParser?: (parser: unknown) => BulletMLRunner;
  createRunnerFromState?: (state: BulletMLState) => BulletMLRunner;
};

let runnerFactory: RunnerFactory = {};

/**
 * Registers external BulletML runtime adapters.
 */
export function setBulletMLRunnerFactory(factory: RunnerFactory): void {
  runnerFactory = factory;
}

export function createRunnerFromParser(parser: unknown): BulletMLRunner {
  /*
   * D source:
   *   BulletMLRunner *runner = BulletMLRunner_new_parser(nbi.getParser());
   *   BulletActorPool.registFunctions(runner);
   */
  if (runnerFactory.createRunnerFromParser) {
    return runnerFactory.createRunnerFromParser(parser);
  }
  const p = parser as { createRunner?: () => BulletMLRunner };
  if (typeof p?.createRunner === "function") return p.createRunner();
  return { end: true };
}

export function createRunnerFromState(state: BulletMLState): BulletMLRunner {
  /*
   * D source:
   *   BulletMLRunner* runner = BulletMLRunner_new_state(state);
   *   registFunctions(runner);
   */
  if (runnerFactory.createRunnerFromState) {
    return runnerFactory.createRunnerFromState(state);
  }
  const s = state as { createRunner?: () => BulletMLRunner };
  if (typeof s?.createRunner === "function") return s.createRunner();
  return { end: true };
}
