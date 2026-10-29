import { beforeEach, describe, expect, it, vi } from "vitest";

// 消息提示由 http 拦截器统一弹，单测断言本模块自身不重复弹
vi.mock("@/utils/message", () => ({ message: vi.fn() }));

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, te: () => false })
  };
});

// 权限面固定放行（显隐逻辑不在本 spec 断言范围）
vi.mock("@/router/utils", () => ({
  hasAuth: () => true,
  usePageAuth: () => ({ log: true })
}));

vi.mock("@/api/task/task", () => ({
  taskCenterApi: { cancel: vi.fn(), rerun: vi.fn() },
  taskExecutionApi: { stats: vi.fn() }
}));

const exportDownload = vi.fn();
const importDownload = vi.fn();
vi.mock("@/api/task/export", () => ({
  exportRecordApi: { download: (...args: unknown[]) => exportDownload(...args) }
}));
vi.mock("@/api/task/import", () => ({
  importRecordApi: { download: (...args: unknown[]) => importDownload(...args) }
}));

vi.mock("@/components/ReIcon/src/hooks", () => ({
  useRenderIcon: (icon: unknown) => icon
}));

vi.mock("@/components/ReTaskLogDialog/taskLogDialog", () => ({
  openTaskLogDialog: vi.fn()
}));

// 列格式化透传（本 spec 只关注操作按钮的下载链路）；组件库整体替换避免拖入 SFC 依赖链
vi.mock("@/components/RePlusPage", async () => {
  const { defineListPage } =
    await import("@/components/RePlusPage/src/utils/defineListPage");
  return {
    defineListPage,
    formatPageColumns: (cols: unknown) => cols
  };
});

vi.mock("@/utils/dict", () => ({
  statusTagProps: () => ({})
}));

import { useTaskExecution } from "../hook";

type Button = {
  code: string;
  onClick: (scope: { row: unknown }) => unknown;
  show?: boolean | ((row: unknown) => boolean);
  confirm?: { title?: string | ((row: unknown) => string) };
};

const getButton = (code: string): Button => {
  const { operationButtonsProps } = useTaskExecution();
  const buttons = (operationButtonsProps as { value: { buttons?: Button[] } })
    .value.buttons as Button[];
  const button = buttons.find(item => item.code === code);
  expect(button, `${code} 按钮应存在`).toBeTruthy();
  return button as Button;
};

const getDownloadButton = (): Button => {
  const { operationButtonsProps } = useTaskExecution();
  const buttons = (operationButtonsProps as { value: { buttons?: Button[] } })
    .value.buttons as Button[];
  const button = buttons.find(item => item.code === "download");
  expect(button, "下载按钮应存在").toBeTruthy();
  return button as Button;
};

beforeEach(() => {
  exportDownload.mockReset();
  importDownload.mockReset();
});

describe("useTaskExecution 产物下载", () => {
  it("导出产物走 exportRecordApi.download（http 层 blob 下载）", async () => {
    exportDownload.mockResolvedValue(undefined);
    const button = getDownloadButton();
    await button.onClick({ row: { pk: "e-1", product_type: "export" } });
    expect(exportDownload).toHaveBeenCalledWith("e-1");
    expect(importDownload).not.toHaveBeenCalled();
  });

  it("导入产物走 importRecordApi.download", async () => {
    importDownload.mockResolvedValue(undefined);
    const button = getDownloadButton();
    await button.onClick({ row: { pk: 7, product_type: "import" } });
    expect(importDownload).toHaveBeenCalledWith(7);
    expect(exportDownload).not.toHaveBeenCalled();
  });

  it("非产物任务缺省按导出记录端点处理且不再使用 window.open", async () => {
    exportDownload.mockResolvedValue(undefined);
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const button = getDownloadButton();
    await button.onClick({ row: { pk: "t-1" } });
    expect(exportDownload).toHaveBeenCalledWith("t-1");
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("下载失败被吞掉不产生 unhandled rejection（提示由拦截器负责）", async () => {
    exportDownload.mockRejectedValue(new Error("blob json"));
    const button = getDownloadButton();
    await expect(
      button.onClick({ row: { pk: "e-2", product_type: "export" } })
    ).resolves.toBeUndefined();
  });
});

describe("取消/重跑二次确认", () => {
  it("取消带确认文案（复用调度任务的取消口径），且按 can_cancel 显隐", () => {
    const button = getButton("cancel");
    expect(button.confirm?.title).toBe("taskCenter.cancelConfirm");
    // t 在单测里被替换为原样返回 key（含插值参数时仍是 key）
    expect(typeof button.show).toBe("function");
    const show = button.show as (row: unknown) => boolean;
    expect(show({ can_cancel: true })).toBe(true);
    expect(show({ can_cancel: false })).toBe(false);
  });

  it("重跑带确认文案，且按 can_rerun 能力位显隐", () => {
    const button = getButton("rerun");
    expect(button.confirm?.title).toBe("taskCenter.rerunConfirm");
    const show = button.show as (row: unknown) => boolean;
    expect(show({ can_rerun: true })).toBe(true);
    expect(show({ can_rerun: false })).toBe(false);
  });

  it("删除按钮同样保留确认（同页三条破坏性操作口径一致）", () => {
    const button = getButton("delete");
    expect(button.confirm?.title).toBe("systemTaskExecution.deleteConfirmLog");
  });
});
