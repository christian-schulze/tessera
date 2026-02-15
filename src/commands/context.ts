import type { RootContainer } from "../tree/root-container.js";
import type { Container } from "../tree/container.js";
import type { WindowAdapter } from "./adapter.js";

export interface CommandContext {
  root: RootContainer;
  focused: Container | null;
  adapter: WindowAdapter;
  logger?: (message: string) => void;
}
