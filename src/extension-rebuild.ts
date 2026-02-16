export const shouldRebuildTree = (outputs: number, monitors: number): boolean =>
  monitors > 0 && outputs === 0;

export const maybeRebuildTree = (
  outputs: number,
  monitors: number,
  rebuild: () => void
): boolean => {
  if (!shouldRebuildTree(outputs, monitors)) {
    return false;
  }

  rebuild();
  return true;
};

export const shouldContinuePolling = (
  attempts: number,
  maxAttempts: number,
  outputs: number
): boolean => {
  if (outputs > 0) {
    return false;
  }

  return attempts < maxAttempts;
};
