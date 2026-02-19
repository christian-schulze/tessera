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
  primaryIndex?: number;
};

type Display = {
  get_n_monitors: () => number;
  get_monitor_workarea?: (index: number) => Rect;
};

type TopPanel = {
  height: number;
};

export const buildMonitorInfos = (
  layoutManager: LayoutManager,
  display: Display,
  topPanel?: TopPanel
): MonitorInfo[] => {
  let infos: MonitorInfo[];

  if (layoutManager.monitors.length > 0) {
    infos = layoutManager.monitors.map((_monitor, index) => ({
      index,
      workArea: layoutManager.getWorkAreaForMonitor(index),
    }));
  } else {
    const count = display.get_n_monitors();
    const getWorkArea = display.get_monitor_workarea
      ? display.get_monitor_workarea.bind(display)
      : layoutManager.getWorkAreaForMonitor.bind(layoutManager);

    infos = Array.from({ length: count }, (_, index) => ({
      index,
      workArea: getWorkArea(index),
    }));
  }

  // On Wayland, getWorkAreaForMonitor may return the full monitor rect (y=0)
  // because the GNOME panel does not register X11 struts. Correct the primary
  // monitor's work area using the actual panel height so tiles start below it.
  const panelHeight = topPanel ? Math.round(topPanel.height) : 0;
  if (panelHeight <= 0) return infos;

  const primaryIndex = layoutManager.primaryIndex ?? 0;
  return infos.map((info) => {
    if (info.index !== primaryIndex || info.workArea.y !== 0) return info;
    return {
      ...info,
      workArea: {
        x: info.workArea.x,
        y: panelHeight,
        width: info.workArea.width,
        height: info.workArea.height - panelHeight,
      },
    };
  });
};
