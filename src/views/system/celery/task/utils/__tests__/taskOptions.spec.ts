import { describe, expect, it } from "vitest";

import { runnableTaskOptions, toRegisteredTaskOption } from "../taskOptions";

describe("toRegisteredTaskOption", () => {
  it("composes label as verbose_name (path)", () => {
    expect(
      toRegisteredTaskOption({
        name: "app.tasks.sync",
        verbose_name: "同步库存"
      })
    ).toEqual({
      label: "同步库存 (app.tasks.sync)",
      value: "app.tasks.sync"
    });
  });

  it("falls back to the task path when verbose_name is missing", () => {
    expect(
      toRegisteredTaskOption({ name: "app.tasks.sync", verbose_name: "" })
    ).toEqual({ label: "app.tasks.sync", value: "app.tasks.sync" });
  });
});

describe("runnableTaskOptions", () => {
  it("keeps only whitelisted (runnable) tasks", () => {
    const options = [
      {
        name: "demo.tasks.auto_off_shelf_books",
        verbose_name: "演示",
        runnable: true
      },
      { name: "system.tasks.cleanup", verbose_name: "清理", runnable: false }
    ];
    expect(runnableTaskOptions(options)).toEqual([options[0]]);
  });

  it("drops tasks without the runnable flag (fail-closed)", () => {
    expect(
      runnableTaskOptions([{ name: "app.tasks.legacy", verbose_name: "" }])
    ).toEqual([]);
  });
});
