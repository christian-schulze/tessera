type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MonitorInfo = {
  index: number;
  workArea: Rect;
};

type LayoutManager = {
  monitors: unknown[];
  getWorkAreaForMonitor: (index: number) => Rect;
};

type Display = {
  get_n_monitors: () => number;
  get_monitor_workarea?: (index: number) => Rect;
};

export const buildMonitorInfos = (
  layoutManager: LayoutManager,
  display: Display
): MonitorInfo[] => {
  if (layoutManager.monitors.length > 0) {
    return layoutManager.monitors.map((_monitor, index) => ({
      index,
      workArea: layoutManager.getWorkAreaForMonitor(index),
    }));
  }

  const count = display.get_n_monitors();
  const getWorkArea = display.get_monitor_workarea
    ? display.get_monitor_workarea.bind(display)
    : layoutManager.getWorkAreaForMonitor.bind(layoutManager);

  return Array.from({ length: count }, (_, index) => ({
    index,
    workArea: getWorkArea(index),
  }));
};
