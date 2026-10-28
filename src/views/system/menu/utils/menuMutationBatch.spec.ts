import { beforeEach, describe, expect, it, vi } from "vitest";

import type { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { MenuChoices } from "@/views/system/constants";
import { normalizeMenuRow } from "./normalize";
import {
  collectActiveCascadePks,
  setMenuRowsActive
} from "./menuMutationBatch";
import type { MenuMutationApi } from "./menuMutationTypes";
import type { MenuRow } from "./types";

vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("./menuActions", () => ({
  confirmMenuDelete: vi.fn(),
  confirmBatchActive: vi.fn().mockResolvedValue(true)
}));

import { message } from "@/utils/message";
import { confirmBatchActive } from "./menuActions";

type TFunction = ReturnType<typeof useI18n>["t"];

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as TFunction;

function row(
  pk: number | string,
  menuType: number,
  children: MenuRow[] = []
): MenuRow {
  const base = normalizeMenuRow({
    pk,
    name: `menu-${pk}`,
    path: `/menu/${pk}`,
    menu_type: menuType,
    parent: null,
    is_active: true,
    meta: { title: `菜单${pk}` }
  });
  return { ...base, children };
}

function api(): MenuMutationApi {
  return {
    baseApi: "/api/system/menu",
    request: vi.fn(),
    create: vi.fn(),
    partialUpdate: vi.fn(),
    destroy: vi.fn(),
    batchDestroy: vi.fn(),
    rank: vi.fn(),
    batchUpdate: vi.fn().mockResolvedValue({
      code: SUCCESS_CODE,
      data: { success: [], failures: [] }
    })
  } as unknown as MenuMutationApi;
}

beforeEach(() => {
  vi.mocked(message).mockClear();
  vi.mocked(confirmBatchActive).mockClear();
  vi.mocked(confirmBatchActive).mockResolvedValue(true);
});

describe("collectActiveCascadePks", () => {
  it("目录级联页面但排除权限点", () => {
    const permission = row("p1", MenuChoices.PERMISSION);
    const page = row("m1", MenuChoices.MENU, [permission]);
    const directory = row("d1", MenuChoices.DIRECTORY, [page]);

    expect(collectActiveCascadePks(directory)).toEqual(["m1"]);
  });

  it("页面与权限点自身不展开后代", () => {
    const permission = row("p1", MenuChoices.PERMISSION);
    const page = row("m1", MenuChoices.MENU, [permission]);

    expect(collectActiveCascadePks(page)).toEqual([]);
    expect(collectActiveCascadePks(permission)).toEqual([]);
  });
});

describe("setMenuRowsActive", () => {
  it("停用目录只提交目录与页面，权限点保持启用", async () => {
    const permission = row("p1", MenuChoices.PERMISSION);
    const page = row("m1", MenuChoices.MENU, [permission]);
    const directory = row("d1", MenuChoices.DIRECTORY, [page]);
    const patchRows = vi.fn();
    const menuApi = api();

    await setMenuRowsActive({
      api: menuApi,
      t,
      rows: [directory],
      isActive: false,
      patchRows
    });

    expect(menuApi.batchUpdate).toHaveBeenCalledWith(["d1", "m1"], {
      is_active: false
    });
    // 确认框拿到真实级联数量（1 = 仅页面）
    expect(confirmBatchActive).toHaveBeenCalledWith([directory], false, t, 1);
  });

  it("权限点与菜单混选直接拒绝且不发请求", async () => {
    const menuApi = api();
    const result = await setMenuRowsActive({
      api: menuApi,
      t,
      rows: [row("m1", MenuChoices.MENU), row("p1", MenuChoices.PERMISSION)],
      isActive: false,
      patchRows: vi.fn()
    });

    expect(result).toBe(false);
    expect(menuApi.batchUpdate).not.toHaveBeenCalled();
    // 跨类型混选由「同类型」校验拦下（权限点与菜单不同类）
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "systemMenu.result.batchMixedTypes",
      { type: "error" }
    );
  });

  it("权限点之间可批量启停", async () => {
    const menuApi = api();
    await setMenuRowsActive({
      api: menuApi,
      t,
      rows: [
        row("p1", MenuChoices.PERMISSION),
        row("p2", MenuChoices.PERMISSION)
      ],
      isActive: true,
      patchRows: vi.fn()
    });

    expect(menuApi.batchUpdate).toHaveBeenCalledWith(["p1", "p2"], {
      is_active: true
    });
  });
});
