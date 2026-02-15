import { Container } from "./container.js";

const clearFocus = (container: Container): void => {
  container.focused = false;
  for (const child of container.children) {
    clearFocus(child);
  }
};

export const setFocusedContainer = (
  root: Container,
  target: Container | null
): void => {
  clearFocus(root);

  if (target) {
    target.focused = true;
  }
};
