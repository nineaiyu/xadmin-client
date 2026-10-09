import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { useConfirm } from "./useConfirm";

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }));

vi.mock("element-plus/es/components/message-box/index.mjs", () => ({
  ElMessageBox: { confirm: mocks.confirm }
}));

// useConfirm 走 i18n.global 取词（无组件上下文），测试桩直接返回 key 形态
vi.mock("@/plugins/i18n", () => ({
  i18n: { global: { t: (key: string) => `«${key}»` } }
}));

/** 挂到组件实例上调用（与生产调用形态一致：setup 内取一次，事件里多次用） */
function setupHook() {
  let confirm: ReturnType<typeof useConfirm> | null = null;
  const Comp = defineComponent({
    setup() {
      confirm = useConfirm();
      return () => h("div");
    }
  });
  createApp(Comp).mount(document.createElement("div"));
  return confirm!;
}

beforeEach(() => {
  mocks.confirm.mockReset();
});

afterEach(() => {
  document.querySelector(".el-message-box")?.remove();
});

describe("useConfirm", () => {
  it("确认返回 true，默认口径为 warning + 提示标题 + 确定/取消按钮", async () => {
    mocks.confirm.mockResolvedValue("confirm");
    const confirm = setupHook();
    await expect(confirm("确定删除？")).resolves.toBe(true);
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(
      "确定删除？",
      "«buttons.tips»",
      {
        type: "warning",
        confirmButtonText: "«buttons.sure»",
        cancelButtonText: "«buttons.cancel»"
      }
    );
  });

  it("取消/关闭不抛错，归一为 false", async () => {
    mocks.confirm.mockRejectedValue("cancel");
    const confirm = setupHook();
    await expect(confirm("危险操作")).resolves.toBe(false);
    mocks.confirm.mockRejectedValue("close");
    await expect(confirm("危险操作")).resolves.toBe(false);
  });

  it("自定义 options 覆盖默认项，其余透传 ElMessageBox", async () => {
    mocks.confirm.mockResolvedValue("confirm");
    const confirm = setupHook();
    await confirm("轮换密钥？", {
      title: "轮换",
      type: "info",
      confirmButtonText: "轮换",
      confirmButtonClass: "el-button--danger",
      draggable: true
    });
    expect(mocks.confirm.mock.calls[0][1]).toBe("轮换");
    const [, , options] = mocks.confirm.mock.calls[0];
    expect(options).toEqual({
      type: "info",
      confirmButtonText: "轮换",
      cancelButtonText: "«buttons.cancel»",
      confirmButtonClass: "el-button--danger",
      draggable: true
    });
  });

  it("VNode 消息体原样透传", async () => {
    mocks.confirm.mockResolvedValue("confirm");
    const confirm = setupHook();
    const vnode = h("div", "批量启停说明");
    await confirm(vnode);
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(
      vnode,
      "«buttons.tips»",
      expect.objectContaining({ type: "warning" })
    );
  });
});
