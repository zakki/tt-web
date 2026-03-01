import { setupRuntimeAssets } from "./abagames/tt/assetbootstrap";
import { boot } from "./abagames/tt/boot";

async function tryEnterFullscreenAndLockOrientation(): Promise<void> {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!document.fullscreenElement && typeof root.requestFullscreen === "function") {
    try {
      await root.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // ignore: fullscreen may be blocked or unsupported.
    }
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: "any" | "natural" | "landscape" | "portrait" | "portrait-primary" | "portrait-secondary" | "landscape-primary" | "landscape-secondary") => Promise<void>;
    };
    if (typeof orientation.lock === "function") await orientation.lock("landscape");
  } catch {
    // ignore: orientation lock is optional.
  }
}

function installMobileFullscreenHint(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const tryEnterFullscreen = () => {
    cleanup();
    void tryEnterFullscreenAndLockOrientation();
  };
  const cleanup = () => {
    window.removeEventListener("pointerdown", onFirstInput);
    window.removeEventListener("keydown", onFirstInput);
  };
  const onFirstInput = () => {
    void tryEnterFullscreen();
  };
  window.addEventListener("pointerdown", onFirstInput, { once: true });
  window.addEventListener("keydown", onFirstInput, { once: true });
}

interface LaunchOptions {
  useResolution: boolean;
  resolutionWidth: number;
  resolutionHeight: number;
  noSound: boolean;
  windowMode: boolean;
  reverseButtons: boolean;
}

async function promptLaunchOptions(): Promise<string[]> {
  if (typeof document === "undefined") return [];
  const options: LaunchOptions = {
    useResolution: false,
    resolutionWidth: 640,
    resolutionHeight: 480,
    noSound: false,
    windowMode: false,
    reverseButtons: false,
  };
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "10000";
    overlay.style.display = "grid";
    overlay.style.placeItems = "center";
    overlay.style.background = "rgba(0, 0, 0, 0.88)";
    overlay.style.color = "#fff";
    overlay.style.fontFamily = "monospace";
    overlay.style.padding = "16px";

    const panel = document.createElement("div");
    panel.style.width = "min(680px, 100%)";
    panel.style.maxHeight = "100%";
    panel.style.overflow = "auto";
    panel.style.boxSizing = "border-box";
    panel.style.padding = "16px";
    panel.style.border = "1px solid rgba(255, 255, 255, 0.35)";
    panel.style.background = "rgba(10, 10, 10, 0.92)";

    panel.innerHTML = `
      <h1 style="margin:0 0 8px 0; font-size:20px;">Torus Trooper Options</h1>
      <p style="margin:0 0 12px 0; color:#ddd; line-height:1.45;">
        Configure startup options from readme_e.txt before launch.
      </p>
      <div style="display:grid; gap:10px;">

        <label style="display:flex; gap:8px; align-items:center;">
          <input id="tt-opt-res-enable" type="checkbox" />
          -res x y Set ths screen resolution to (x, y).
        </label>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <input id="tt-opt-res-w" type="number" min="320" max="7680" value="640" style="width:120px;" />
          <input id="tt-opt-res-h" type="number" min="240" max="4320" value="480" style="width:120px;" />
        </div>

        <label style="display:flex; gap:8px; align-items:center;">
          <input id="tt-opt-nosound" type="checkbox" />
          -nosound Stop the sound.
        </label>
        <label style="display:flex; gap:8px; align-items:center;">
          <input id="tt-opt-window" type="checkbox" />
          -window Launch the game in the window, not use the full-screen.
        </label>
        <label style="display:flex; gap:8px; align-items:center;">
          <input id="tt-opt-reverse" type="checkbox" />
          -reverse Reverse a shot key and a charge shot key.
        </label>
      </div>
      <div style="display:flex; gap:8px; margin-top:16px; justify-content:flex-end;">
        <button id="tt-opt-start" style="padding:8px 14px; cursor:pointer;">Start</button>
      </div>
    `;
    overlay.append(panel);
    document.body.append(overlay);

    const byId = <T extends HTMLElement>(id: string): T => {
      const el = panel.querySelector(`#${id}`);
      if (!el) throw new Error(`Missing element: ${id}`);
      return el as T;
    };

    const useResolutionInput = byId<HTMLInputElement>("tt-opt-res-enable");
    const widthInput = byId<HTMLInputElement>("tt-opt-res-w");
    const heightInput = byId<HTMLInputElement>("tt-opt-res-h");
    const noSoundInput = byId<HTMLInputElement>("tt-opt-nosound");
    const windowInput = byId<HTMLInputElement>("tt-opt-window");
    const reverseInput = byId<HTMLInputElement>("tt-opt-reverse");
    const startButton = byId<HTMLButtonElement>("tt-opt-start");

    const start = () => {
      options.useResolution = useResolutionInput.checked;
      options.resolutionWidth = clampInt(widthInput.value, 1, 7680, 640);
      options.resolutionHeight = clampInt(heightInput.value, 1, 4320, 480);
      options.noSound = noSoundInput.checked;
      options.windowMode = windowInput.checked;
      options.reverseButtons = reverseInput.checked;
      if (!options.windowMode) void tryEnterFullscreenAndLockOrientation();

      overlay.remove();
      resolve(buildBootArgs(options));
    };
    startButton.addEventListener("click", start);
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        start();
      }
    });
    startButton.focus();
  });
}

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

function buildBootArgs(options: LaunchOptions): string[] {
  const args: string[] = [];
  if (options.useResolution) args.push("-res", String(options.resolutionWidth), String(options.resolutionHeight));
  if (options.noSound) args.push("-nosound");
  if (options.windowMode) args.push("-window");
  if (options.reverseButtons) args.push("-reverse");
  return args;
}

// Browser entrypoint for Phase4 manual verification.
// Bundlers can use this module directly as the app root.
void (async () => {
  await setupRuntimeAssets();
  const launchArgs = await promptLaunchOptions();
  if (!launchArgs.includes("-window")) installMobileFullscreenHint();
  void boot(["tt-web", ...launchArgs]);
})();
