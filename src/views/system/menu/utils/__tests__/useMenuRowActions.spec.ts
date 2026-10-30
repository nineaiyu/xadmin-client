import { flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { useMenuRowActions } from "../useMenuRowActions";

function setup(choice: "save" | "discard" | "cancel" = "save") {
  const drawer = {
    isOpen: vi.fn(() => true),
    dirty: vi.fn(() => true),
    confirmSwitch: vi.fn(async () => choice),
    saveCurrent: vi.fn(async () => true),
    openRename: vi.fn(),
    openEdit: vi.fn()
  };
  const { onRowAction } = useMenuRowActions({
    data: {} as never,
    drawer: drawer as never,
    order: {} as never,
    currentRow: ref(null)
  });
  return { drawer, onRowAction };
}

describe("useMenuRowActions 快速重命名", () => {
  it("抽屉有未保存改动时先走守卫，保存后再重命名", async () => {
    const { drawer, onRowAction } = setup("save");
    onRowAction("rename", { pk: 1 } as never);
    await flushPromises();

    expect(drawer.confirmSwitch).toHaveBeenCalled();
    expect(drawer.saveCurrent).toHaveBeenCalled();
    expect(drawer.openRename).toHaveBeenCalled();
  });

  it("守卫取消时不打开重命名", async () => {
    const { drawer, onRowAction } = setup("cancel");
    onRowAction("rename", { pk: 1 } as never);
    await flushPromises();

    expect(drawer.confirmSwitch).toHaveBeenCalled();
    expect(drawer.openRename).not.toHaveBeenCalled();
  });
});
