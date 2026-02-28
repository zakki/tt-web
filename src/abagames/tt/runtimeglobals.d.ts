import type { BulletMLRunner, BulletMLState } from "../util/bulletml/bullet";

declare global {
  var __ttAssets: Record<string, string> | undefined;
  var __ttBarrageParsers: Record<string, Record<string, unknown>> | undefined;
  var __ttMusicFiles: string[] | undefined;
  var __ttBulletMLRunnerFactory:
    | {
        createRunnerFromParser?: (parser: unknown) => BulletMLRunner;
        createRunnerFromState?: (state: BulletMLState) => BulletMLRunner;
      }
    | undefined;
}

export {};
