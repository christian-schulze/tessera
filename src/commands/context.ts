import type { RootContainer } from "../tree/root-container.js";
import type { Container } from "../tree/container.js";
import type { WindowAdapter } from "./adapter.js";
import type { TesseraConfig } from "../config.js";

export interface CommandContext {
  root: RootContainer;
  focused: Container | null;
  adapter: WindowAdapter;
  config: TesseraConfig;
  reloadConfig?: () => void;
  switchMode?: (name: string) => boolean;
  logger?: (message: string) => void;
}
