import { describe, expect, it } from "vitest";

import { toRegisteredTaskOption } from "../taskOptions";

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
