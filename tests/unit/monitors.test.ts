import { buildMonitorInfos } from "../../src/monitors.ts";

describe("buildMonitorInfos", () => {
  it("uses layout manager monitors when available", () => {
    const layoutManager = {
      monitors: [{}, {}],
      getWorkAreaForMonitor: (index: number) => ({
        x: index * 10,
        y: 0,
        width: 100,
        height: 50,
      }),
    };
    const display = {
      get_n_monitors: () => 1,
      get_monitor_workarea: () => ({ x: 0, y: 0, width: 1, height: 1 }),
    };

    const result = buildMonitorInfos(layoutManager, display);

    expect(result).toEqual([
      { index: 0, workArea: { x: 0, y: 0, width: 100, height: 50 } },
      { index: 1, workArea: { x: 10, y: 0, width: 100, height: 50 } },
    ]);
  });

  it("falls back to display monitors when layout manager is empty", () => {
    const layoutManager = {
      monitors: [],
      getWorkAreaForMonitor: () => ({ x: 0, y: 0, width: 1, height: 1 }),
    };
    const display = {
      get_n_monitors: () => 2,
      get_monitor_workarea: (index: number) => ({
        x: 0,
        y: index * 20,
        width: 300,
        height: 200,
      }),
    };

    const result = buildMonitorInfos(layoutManager, display);

    expect(result).toEqual([
      { index: 0, workArea: { x: 0, y: 0, width: 300, height: 200 } },
      { index: 1, workArea: { x: 0, y: 20, width: 300, height: 200 } },
    ]);
  });
});
