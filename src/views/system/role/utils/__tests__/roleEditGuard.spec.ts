import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => ({
  auth: {} as Record<string, boolean>,
  denied: { value: false },
  error: { value: "" },
  tree: { value: [] as unknown[] }
}));

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, te: () => false })
  };
});

vi.mock("@/router/utils", () => ({
  hasAuth: () => true,
  usePageAuth: () => shared.auth
}));

vi.mock("@/api/identity/role", () => ({ roleApi: { list: vi.fn() } }));

// 组件库整体替换：只借真实的 defineListPage（其余导出本 spec 不消费）
vi.mock("@/components/RePlusPage", async () => {
  const { defineListPage } =
    await import("@/components/RePlusPage/src/utils/defineListPage");
  return { defineListPage };
});

vi.mock("../useRoleMenuTree", () => ({
  useRoleMenuTree: () => ({
    menuTreeData: shared.tree,
    menuDenied: shared.denied,
    menuError: shared.error
  })
}));
vi.mock("../useRoleFormOptions", () => ({
  useRoleFormOptions: () => ({ addOrEditOptions: {} })
}));
vi.mock("../useRoleButtons", () => ({
  useRoleButtons: () => ({
    tableBarButtonsProps: { value: {} },
    operationButtonsProps: { value: {} }
  })
}));
vi.mock("../rolePreview", () => ({ openRolePreview: vi.fn() }));

import { useRole } from "../hook";

beforeEach(() => {
  shared.denied.value = false;
  shared.error.value = "";
  for (const key of Object.keys(shared.auth)) delete shared.auth[key];
});

describe("缺 retrieve 时的编辑守卫", () => {
  it("有编辑权限但缺 retrieve：收回 update/partialUpdate 并给出警告文案", () => {
    Object.assign(shared.auth, {
      update: true,
      partialUpdate: true,
      retrieve: false
    });

    const { auth, menuAlert } = useRole();

    // 列表行的 menu 恒为空，缺回显能力打开编辑 = 空树保存，会清空该角色全部授权
    expect(auth.update).toBe(false);
    expect(auth.partialUpdate).toBe(false);
    expect(menuAlert.value).toBe("systemRole.editRetrieveDenied");
  });

  it("有 retrieve 时编辑能力保持不变（新增/编辑都走回显）", () => {
    Object.assign(shared.auth, {
      update: true,
      partialUpdate: true,
      retrieve: true
    });

    const { auth, menuAlert } = useRole();

    expect(auth.update).toBe(true);
    expect(auth.partialUpdate).toBe(true);
    expect(menuAlert.value).toBe("");
  });

  it("本来就没有编辑权限时不算「缺回显」，不弹警告", () => {
    Object.assign(shared.auth, {
      update: false,
      partialUpdate: false,
      retrieve: false
    });

    const { menuAlert } = useRole();

    expect(menuAlert.value).toBe("");
  });

  it("只给 update（无 partialUpdate）同样被收回，避免从 update 侧露出口子", () => {
    Object.assign(shared.auth, { update: true, retrieve: false });

    const { auth } = useRole();

    expect(auth.update).toBe(false);
    expect(auth.partialUpdate).toBe(false);
  });
});

describe("角色页授权树不可用的门控", () => {
  it("缺 list:SystemMenu（menuDenied）时连新增一并关闭", () => {
    Object.assign(shared.auth, { create: true, update: true, retrieve: true });
    shared.denied.value = true;

    const { auth, menuAlert } = useRole();

    expect(auth.create).toBe(false);
    expect(auth.update).toBe(false);
    expect(menuAlert.value).toBe("systemRole.menuTreeDenied");
  });

  it("菜单列表加载失败（menuError）同样关闭新增/编辑并提示重试", () => {
    Object.assign(shared.auth, { create: true, update: true, retrieve: true });
    shared.error.value = "boom";

    const { auth, menuAlert } = useRole();

    expect(auth.create).toBe(false);
    expect(auth.update).toBe(false);
    expect(menuAlert.value).toBe("systemRole.menuTreeLoadFailed");
  });
});
