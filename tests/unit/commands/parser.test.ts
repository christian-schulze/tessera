import { parseCommandString } from "../../../src/commands/parser.ts";

describe("Command parser", () => {
  it("parses a basic command", () => {
    const commands = parseCommandString("focus left");

    expect(commands).toEqual([
      {
        raw: "focus left",
        action: "focus",
        args: ["left"],
        criteria: [],
      },
    ]);
  });

  it("parses criteria blocks", () => {
    const commands = parseCommandString('[app_id="firefox" title="Docs"] focus');

    expect(commands).toEqual([
      {
        raw: '[app_id="firefox" title="Docs"] focus',
        action: "focus",
        args: [],
        criteria: [
          {
            key: "app_id",
            operator: "=",
            value: "firefox",
          },
          {
            key: "title",
            operator: "=",
            value: "Docs",
          },
        ],
      },
    ]);
  });

  it("parses chained commands", () => {
    const commands = parseCommandString("splitv; focus right");

    expect(commands).toEqual([
      {
        raw: "splitv",
        action: "splitv",
        args: [],
        criteria: [],
      },
      {
        raw: "focus right",
        action: "focus",
        args: ["right"],
        criteria: [],
      },
    ]);
  });
});
