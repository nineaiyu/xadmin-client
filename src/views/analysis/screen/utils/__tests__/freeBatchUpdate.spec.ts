import { describe, expect, it } from "vitest";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import { batchUpdateTargets } from "../freeBatchUpdate";

const pane = (pk: string, type: ScreenPaneType) =>
  ({ pk, type }) as ScreenLayoutPane;

describe("batchUpdateTargets 适用类型", () => {
  it("多选含 video/html 时批量 rotate/animation 生效", () => {
    const panes = [pane("v1", "video"), pane("h1", "html")];
    const result = batchUpdateTargets(panes, ["v1", "h1"], {
      rotate: 90,
      animation: "fade"
    } as Partial<ScreenLayoutPane>);

    expect(Object.keys(result)).toEqual(["v1", "h1"]);
    expect(result.v1.rotate).toBe(90);
    expect(result.h1.animation).toBe("fade");
  });

  it("视频支持批量 fit，HTML 不支持", () => {
    const panes = [pane("v1", "video"), pane("h1", "html")];
    const result = batchUpdateTargets(panes, ["v1", "h1"], {
      fit: "contain"
    } as Partial<ScreenLayoutPane>);

    expect(Object.keys(result)).toEqual(["v1"]);
    expect(result.v1.fit).toBe("contain");
  });
});
