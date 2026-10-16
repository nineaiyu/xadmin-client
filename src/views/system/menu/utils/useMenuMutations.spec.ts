import { beforeEach, describe, expect, it, vi } from "vitest";

import type { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { normalizeMenuRow } from "./normalize";
import { useMenuMutations } from "./useMenuMutations";
import type { MenuRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

// useMenuMutations 仅用 t 做文案拼装，单测等价透传
vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
  })
}));

// 标题翻译在单测中等价透传（displayTitle 经 useMenuFilter → plugins/i18n）
vi.mock("@/plugins/i18n", () => ({
  transformI18n: (value: string) => value
}));

// 消息提示与危险动作确认对话框由调用方断言，确认结果按用例注入
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("./menuActions", () => ({
  confirmMenuDelete: vi.fn(),
  confirmBatchActive: vi.fn()
}));

import { message } from "@/utils/message";
import { confirmBatchActive, confirmMenuDelete } from "./menuActions";

function fakeApi(
  overrides: Record<string, unknown> = {}
): Parameters<typeof useMenuMutations>[0]["api"] {
  return {
    baseApi: "/api/system/menu",
    request: vi.fn(),
    create: vi.fn(),
    partialUpdate: vi.fn(),
    destroy: vi.fn(),
    batchDestroy: vi.fn(),
    batchUpdate: vi.fn(),
    rank: vi.fn(),
    ...overrides
  };
}

// 真实 t 为 vue-i18n ComposerTranslation（含 plural 重载）；单测用透传实现等价替换
const passthroughT = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as TFunction;

function makeDeps(api = fakeApi()) {
  return {
    api,
    t: passthroughT,
    setBusy: vi.fn(),
    patchRows: vi.fn(),
    upsertRow: vi.fn(),
    dropRows: vi.fn()
  };
}

function makeRow(overrides: Partial<MenuRow> = {}): MenuRow {
  // 走生产同款 normalizeMenuRow 装配（避免部分对象直接断言成 MenuRow）
  const base = normalizeMenuRow({
    pk: 1,
    name: "SystemMenu",
    path: "/system/menu",
    component: "system/menu/index",
    menu_type: 1,
    parent: null,
    is_active: true,
    rank: 1,
    meta: { title: "菜单管理" }
  });
  return { ...base, ...overrides };
}

const OK = { code: SUCCESS_CODE, data: {} as unknown };

beforeEach(() => {
  vi.mocked(message).mockClear();
  vi.mocked(confirmMenuDelete).mockReset();
  vi.mocked(confirmBatchActive).mockReset();
});

describe("useMenuMutations", () => {
  describe("saveNode", () => {
    it("新增走 create 并用返回行局部更新", async () => {
      const deps = makeDeps(
        fakeApi({
          create: vi
            .fn()
            .mockResolvedValue({ code: SUCCESS_CODE, data: { pk: 9 } })
        })
      );
      const mutations = useMenuMutations(deps);
      await mutations.saveNode(
        { pk: null, name: "new", menuType: 1, meta: {} } as never,
        true
      );
      expect(deps.api.create).toHaveBeenCalledTimes(1);
      expect(deps.api.partialUpdate).not.toHaveBeenCalled();
      expect(deps.upsertRow).toHaveBeenCalledWith({ pk: 9 });
    });

    it("编辑走 partialUpdate（主键 + payload）", async () => {
      const deps = makeDeps(
        fakeApi({ partialUpdate: vi.fn().mockResolvedValue(OK) })
      );
      const mutations = useMenuMutations(deps);
      await mutations.saveNode(
        { pk: 3, name: "edit", menuType: 1, meta: {} } as never,
        false
      );
      expect(deps.api.partialUpdate).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ name: "edit" })
      );
      expect(deps.upsertRow).toHaveBeenCalled();
    });
  });

  describe("renameNode", () => {
    it("只提交 meta.title，成功后局部更新", async () => {
      const deps = makeDeps(
        fakeApi({
          partialUpdate: vi
            .fn()
            .mockResolvedValue({ code: SUCCESS_CODE, data: { pk: 3 } })
        })
      );
      const mutations = useMenuMutations(deps);
      await mutations.renameNode(makeRow({ pk: 3 }), "新标题");
      expect(deps.api.partialUpdate).toHaveBeenCalledWith(3, {
        meta: { title: "新标题" }
      });
      expect(deps.upsertRow).toHaveBeenCalledWith({ pk: 3 });
    });
  });

  describe("toggleActive", () => {
    it("成功：乐观补丁 + busy 标记收放", async () => {
      const deps = makeDeps(
        fakeApi({ partialUpdate: vi.fn().mockResolvedValue(OK) })
      );
      const mutations = useMenuMutations(deps);
      const row = makeRow({ pk: 5, isActive: false });
      const ok = await mutations.toggleActive(row, true);
      expect(ok).toBe(true);
      expect(deps.patchRows).toHaveBeenNthCalledWith(
        1,
        new Map([["5", { is_active: true }]])
      );
      expect(deps.setBusy).toHaveBeenCalledWith(5, true);
      expect(deps.setBusy).toHaveBeenLastCalledWith(5, false);
    });

    it("失败：按原值回滚并提示", async () => {
      const deps = makeDeps(
        fakeApi({
          partialUpdate: vi
            .fn()
            .mockResolvedValue({ code: 1001, detail: "denied" })
        })
      );
      const mutations = useMenuMutations(deps);
      const row = makeRow({ pk: 5, isActive: false });
      const ok = await mutations.toggleActive(row, true);
      expect(ok).toBe(false);
      // 第二次补丁 = 回滚到 previous（is_active: false）
      expect(deps.patchRows).toHaveBeenNthCalledWith(
        2,
        new Map([["5", { is_active: false }]])
      );
      expect(message).toHaveBeenCalled();
    });

    it("异常：同样回滚（网络断开等）", async () => {
      const deps = makeDeps(
        fakeApi({
          partialUpdate: vi.fn().mockRejectedValue(new Error("network down"))
        })
      );
      const mutations = useMenuMutations(deps);
      const ok = await mutations.toggleActive(
        makeRow({ pk: 7, isActive: true }),
        false
      );
      expect(ok).toBe(false);
      expect(deps.patchRows).toHaveBeenNthCalledWith(
        2,
        new Map([["7", { is_active: true }]])
      );
    });
  });

  describe("removeRows", () => {
    it("确认后单行走 destroy，并连同后代一并剔除", async () => {
      vi.mocked(confirmMenuDelete).mockResolvedValue(true);
      const deps = makeDeps(
        fakeApi({ destroy: vi.fn().mockResolvedValue(OK) })
      );
      const mutations = useMenuMutations(deps);
      const parent = makeRow({
        pk: 1,
        children: [makeRow({ pk: "2", children: [] })]
      });
      const ok = await mutations.removeRows([parent]);
      expect(ok).toBe(true);
      expect(deps.api.destroy).toHaveBeenCalledWith(1, {
        impact_confirmed: true
      });
      expect(deps.dropRows).toHaveBeenCalledWith(["1", "2"]);
    });

    it("多行走 batchDestroy", async () => {
      vi.mocked(confirmMenuDelete).mockResolvedValue(true);
      const deps = makeDeps(
        fakeApi({ batchDestroy: vi.fn().mockResolvedValue(OK) })
      );
      const mutations = useMenuMutations(deps);
      await mutations.removeRows([makeRow({ pk: 1 }), makeRow({ pk: 2 })]);
      expect(deps.api.batchDestroy).toHaveBeenCalledWith([1, 2], {
        impact_confirmed: true
      });
    });

    it("确认拒绝：不调接口直接返回 false", async () => {
      vi.mocked(confirmMenuDelete).mockResolvedValue(false);
      const deps = makeDeps();
      const mutations = useMenuMutations(deps);
      const ok = await mutations.removeRows([makeRow({ pk: 1 })]);
      expect(ok).toBe(false);
      expect(deps.api.destroy).not.toHaveBeenCalled();
      expect(deps.dropRows).not.toHaveBeenCalled();
    });
  });

  describe("setRowsActive", () => {
    it("批量启停：目标行 + 后代去重后提交，并本地打补丁", async () => {
      vi.mocked(confirmBatchActive).mockResolvedValue(true);
      const deps = makeDeps(
        fakeApi({ batchUpdate: vi.fn().mockResolvedValue(OK) })
      );
      const mutations = useMenuMutations(deps);
      const parent = makeRow({
        pk: 1,
        children: [
          makeRow({ pk: "2", children: [makeRow({ pk: "3", children: [] })] })
        ]
      });
      const ok = await mutations.setRowsActive(
        [parent, makeRow({ pk: "2" })],
        false
      );
      expect(ok).toBe(true);
      expect(deps.api.batchUpdate).toHaveBeenCalledWith(["1", "2", "3"], {
        is_active: false
      });
      expect(deps.patchRows).toHaveBeenCalledWith(
        new Map([
          ["1", { is_active: false }],
          ["2", { is_active: false }],
          ["3", { is_active: false }]
        ])
      );
    });

    it("确认拒绝：不调接口", async () => {
      vi.mocked(confirmBatchActive).mockResolvedValue(false);
      const deps = makeDeps();
      const mutations = useMenuMutations(deps);
      expect(await mutations.setRowsActive([makeRow({ pk: 1 })], true)).toBe(
        false
      );
      expect(deps.api.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe("submitRank", () => {
    it("成功返回 true；失败提示并返回 false", async () => {
      const okDeps = makeDeps(fakeApi({ rank: vi.fn().mockResolvedValue(OK) }));
      expect(await useMenuMutations(okDeps).submitRank([1, 2])).toBe(true);

      const badDeps = makeDeps(
        fakeApi({
          rank: vi.fn().mockResolvedValue({ code: 1001, detail: "conflict" })
        })
      );
      expect(await useMenuMutations(badDeps).submitRank([1, 2])).toBe(false);
      expect(message).toHaveBeenCalled();
    });
  });
});
