export const scheduleFocusBorderSync = (
  sync: () => void,
  scheduleDelayedSync: (delayMs: number, callback: () => void) => void,
  delayMs = 100
): void => {
  sync();
  scheduleDelayedSync(delayMs, sync);
};
