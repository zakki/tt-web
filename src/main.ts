import { setupRuntimeAssets } from "./abagames/tt/assetbootstrap";
import { boot } from "./abagames/tt/boot";

function installMobileFullscreenHint(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const tryEnterFullscreen = async () => {
    cleanup();
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

// Browser entrypoint for Phase4 manual verification.
// Bundlers can use this module directly as the app root.
void (async () => {
  installMobileFullscreenHint();
  await setupRuntimeAssets();
  void boot(["tt-web"]);
})();
