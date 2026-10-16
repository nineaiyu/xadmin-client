import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import { usePermissionPreview } from "../src/hook";

/** 用最小宿主组件承载 composable（onMounted 需要组件上下文） */
async function setup<T>(
  fetcher: (pk: string) => Promise<T | null>,
  row: string
) {
  const { createApp, defineComponent, h } = await import("vue");
  const bag: { api?: ReturnType<typeof usePermissionPreview> } = {};
  const host = defineComponent({
    setup(_, { expose }) {
      const api = usePermissionPreview(fetcher, () => row);
      bag.api = api;
      expose(api);
      return () => h("div");
    }
  });
  const root = document.createElement("div");
  const app = createApp(host);
  app.mount(root);
  await nextTick();
  const api = bag.api!;
  app.unmount();
  return api;
}

describe("usePermissionPreview", () => {
  it("加载成功：onMounted 自动加载，data 写入、loading 复位", async () => {
    const fetcher = vi.fn(async () => ({ ok: true }));
    const { data, loading, load } = await setup(fetcher, "1");
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledWith("1"));
    await vi.waitFor(() => expect(data.value).toEqual({ ok: true }));
    expect(loading.value).toBe(false);
    // 显式再加载
    await load("2");
    expect(fetcher).toHaveBeenLastCalledWith("2");
  });

  it("加载失败：loading 仍复位，data 保持 null（预览失败不残留旧数据）", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("boom");
    });
    const { data, loading, load } = await setup(fetcher, "1");
    await vi.waitFor(() => expect(loading.value).toBe(false));
    expect(data.value).toBeNull();
    await expect(load("2")).rejects.toThrow("boom");
    await nextTick();
    expect(loading.value).toBe(false);
  });
});
