import type { RootContainer } from "../tree/root-container.ts";
import type { Container } from "../tree/container.ts";
import type { WindowAdapter } from "./adapter.ts";

export interface CommandContext {
  root: RootContainer;
  focused: Container | null;
  adapter: WindowAdapter;
  logger?: (message: string) => void;
}
