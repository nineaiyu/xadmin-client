import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/dataset/analysis", () => ({
  rollbackScreen: vi.fn()
}));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));

import { rollbackScreen, type ScreenItem } from "@/api/dataset/analysis";
import { message } from "@/utils/message";
import { createScreenVersionActions } from "../screenVersions";

const screen = (): ScreenItem => ({
  pk: "s1",
  name: "大屏",
  dashboards: [],
  interval: 15,
  refresh: 60,
  visibility: "personal",
  layout_version: 2,
  layout: [{ pk: "p2", type: "clock", x: 0, y: 0, w: 3, h: 2 }]
});

describe("createScreenVersionActions：回滚", () => {
  it("成功后同步主表并返回最新大屏", async () => {
    const target = ref<ScreenItem | null>(screen());
    const { rollbackTo } = createScreenVersionActions({
      t: key => key,
      screen: target,
      saving: ref(false),
      readonly: ref(false),
      preview: ref(false)
    });
    vi.mocked(rollbackScreen).mockResolvedValue({
      code: 1000,
      detail: "",
      data: {
        ...screen(),
        layout_version: 3,
        layout_mode: "grid",
        layout: [{ pk: "p1", type: "text", x: 0, y: 0, w: 6, h: 2 }]
      }
    });
    const updated = await rollbackTo(1);
    expect(updated?.layout_version).toBe(3);
    expect(target.value?.layout?.[0].pk).toBe("p1");
    expect(target.value?.layout_version).toBe(3);
  });

  it("失败保留当前大屏并提示原因", async () => {
    const target = ref<ScreenItem | null>(screen());
    const { rollbackTo } = createScreenVersionActions({
      t: key => key,
      screen: target,
      saving: ref(false),
      readonly: ref(false),
      preview: ref(false)
    });
    vi.mocked(rollbackScreen).mockResolvedValue({
      code: 1001,
      detail: "Screen version not found",
      data: null as never
    });
    expect(await rollbackTo(99)).toBeNull();
    expect(target.value?.layout_version).toBe(2);
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "Screen version not found",
      expect.anything()
    );
  });

  it("预览/只读态直接拒绝", async () => {
    const { rollbackTo } = createScreenVersionActions({
      t: key => key,
      screen: ref(screen()),
      saving: ref(false),
      readonly: ref(true),
      preview: ref(false)
    });
    expect(await rollbackTo(1)).toBeNull();
    expect(vi.mocked(rollbackScreen)).not.toHaveBeenCalled();
  });
});
