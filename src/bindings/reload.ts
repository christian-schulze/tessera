import type { BindingManager } from "./manager.js";
import type { BindingMode } from "./mode.js";
import { buildDefaultBindingModes } from "./defaults.js";
import type { TesseraConfig } from "../config.js";

export const reloadBindings = (
  manager: BindingManager,
  config: TesseraConfig
): void => {
  const wasEnabled = manager.getActiveMode() !== null;
  manager.disable();
  manager.clearModes();

  const modes: BindingMode[] = config.modes ?? buildDefaultBindingModes();
  for (const mode of modes) {
    manager.addMode(mode);
  }

  manager.switchMode("default");
  if (wasEnabled) {
    manager.enable();
  }
};
