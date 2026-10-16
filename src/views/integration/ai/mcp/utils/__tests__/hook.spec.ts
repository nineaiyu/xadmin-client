import { flushPromises } from "@vue/test-utils";
import { reactive, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import type {
  ButtonsCallBackParams,
  OperationButtonsRow
} from "@/components/RePlusPage/src/components/ButtonOperation/src/types";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn(() => true),
  usePageAuth: vi.fn(() => reactive<Record<string, boolean>>({})),
  sync: vi.fn(),
  message: vi.fn(),
  addDialog: vi.fn(),
  addDrawer: vi.fn(),
  useRenderIcon: vi.fn(() => null),
  formatPageColumns: vi.fn((columns: unknown) => columns)
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({
  hasAuth: mocks.hasAuth,
  usePageAuth: mocks.usePageAuth
}));
vi.mock("@/api/ai/mcp", () => ({
  mcpServerApi: {
    sync: mocks.sync,
    create: vi.fn(),
    partialUpdate: vi.fn()
  }
}));
vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/components/ReDialog", () => ({ addDialog: mocks.addDialog }));
vi.mock("@/components/ReDialog/size", () => ({
  dialogSize: () => "500px"
}));
vi.mock("@/components/ReDrawer", () => ({ addDrawer: mocks.addDrawer }));
vi.mock("@/components/ReIcon/src/hooks", () => ({
  useRenderIcon: mocks.useRenderIcon
}));
vi.mock("@/components/RePlusPage", () => ({
  formatPageColumns: mocks.formatPageColumns
}));

import { useMcpServers } from "../hook";

const SUCCESS_CODE = 1000;

/** 从装配结果取行内「同步」按钮及其 loading 占位（与框架 OperationButton 传参同构） */
const setup = () => {
  const handleGetData = vi.fn();
  const tableRef = ref({ handleGetData });
  const ctx = useMcpServers(tableRef);
  const buttons = ctx.operationButtonsProps.value.buttons ?? [];
  const syncButton = buttons.find(
    button => button.code === "sync"
  ) as OperationButtonsRow;
  const click = (loading: { value: boolean }) =>
    syncButton.onClick?.({
      e: new MouseEvent("click"),
      row: { pk: "42", name: "docs-server" },
      loading,
      buttonRow: syncButton
    } satisfies ButtonsCallBackParams);
  return { click, handleGetData };
};

describe("useMcpServers 行内同步按钮", () => {
  it("同步进行中该行按钮进入 loading，重复点击不并发触发", () => {
    // 永不 resolve，模拟同步请求悬挂在途
    mocks.sync.mockReturnValue(new Promise(() => undefined));
    const { click } = setup();
    const loading = { value: false };

    click(loading);
    expect(loading.value).toBe(true);
    expect(mocks.sync).toHaveBeenCalledTimes(1);

    // loading 期间再次点击（防御）：不再发起第二次同步
    click(loading);
    expect(mocks.sync).toHaveBeenCalledTimes(1);
  });

  it("同步成功后复位 loading、提示结果并刷新列表", async () => {
    mocks.sync.mockResolvedValue({ code: SUCCESS_CODE, data: { count: 3 } });
    const { click, handleGetData } = setup();
    const loading = { value: false };

    click(loading);
    expect(loading.value).toBe(true);
    await flushPromises();

    expect(loading.value).toBe(false);
    expect(mocks.message).toHaveBeenCalledWith("mcp.syncDone", {
      type: "success"
    });
    expect(handleGetData).toHaveBeenCalledTimes(1);
  });

  it("同步失败后复位 loading 并提示原因", async () => {
    mocks.sync.mockResolvedValue({ code: 1001, detail: "upstream timeout" });
    const { click } = setup();
    const loading = { value: false };

    click(loading);
    await flushPromises();

    expect(loading.value).toBe(false);
    expect(mocks.message).toHaveBeenCalledWith("upstream timeout", {
      type: "warning"
    });
  });
});
