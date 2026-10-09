import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import MaskPreview from "../MaskPreview.vue";

/**
 * 脱敏预览弹窗角色视角单测。
 *
 * 核心回归：预览载荷必须携带「规则绑定角色」与「预览视角角色」（viewer_roles，
 * 模拟非超管查看者）；视角默认取行内规则绑定角色的 pk 集合；后端返回
 * applied=false 时顶部给出未命中警示且照常回显结果（原样 output）。
 */

const state = vi.hoisted(() => ({
  previewMock: vi.fn(),
  roleListMock: vi.fn(),
  messageMock: vi.fn()
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/api/system/mask", () => ({
  maskApi: { preview: state.previewMock }
}));
vi.mock("@/api/identity/role", () => ({
  roleApi: { list: state.roleListMock }
}));
vi.mock("@/api/base", () => ({
  listRows: (body: { data?: { results?: unknown[] } }) =>
    body?.data?.results ?? []
}));
vi.mock("@/utils/message", () => ({ message: state.messageMock }));

const SUCCESS_RESPONSE = {
  code: 1000,
  detail: "ok",
  data: {
    results: [
      { pk: "r1", name: "Admin" },
      { pk: "r2", name: "Ops" }
    ],
    total: 2
  }
};

const RULE_WITH_ROLES = {
  model: "system.SystemUser",
  field: "phone",
  mask_type: "phone",
  keep_head: 3,
  keep_tail: 2,
  mask_char: "*",
  // 列表行 roles 为 [{pk, name}] 形态
  roles: [
    { pk: "r1", name: "Admin" },
    { pk: "r2", name: "Ops" }
  ]
};

const mountPreview = (props: Record<string, unknown> = {}) =>
  mount(MaskPreview, {
    props,
    global: {
      stubs: {
        "el-form": { template: "<form><slot /></form>" },
        "el-form-item": { template: "<div><slot /></div>" },
        "el-alert": {
          props: ["title"],
          template:
            "<div class='stub-alert'>{{ title }}<slot name='default' /></div>"
        },
        "el-input": true,
        "el-input-number": true,
        "el-select": { template: "<div><slot /></div>" },
        "el-option": true,
        "el-text": true,
        "el-button": { template: "<button type='button'><slot /></button>" }
      }
    }
  });

const previewButtonOf = (wrapper: ReturnType<typeof mountPreview>) => {
  const button = wrapper
    .findAll("button")
    .find(node => node.text().includes("mask.previewBtn"));
  expect(button, "预览按钮应渲染").toBeTruthy();
  return button!;
};

/** script setup 内部绑定经 vm 代理读写（组件无 defineExpose）：Reflect 反射桥接，避免双重断言 */
const setupOf = (wrapper: ReturnType<typeof mountPreview>) => ({
  get viewerRoles(): Array<string | number> {
    return Reflect.get(wrapper.vm, "viewerRoles") as Array<string | number>;
  },
  get roleOptions(): Array<{ pk: string | number; name: string }> {
    return Reflect.get(wrapper.vm, "roleOptions") as Array<{
      pk: string | number;
      name: string;
    }>;
  },
  get applied(): boolean {
    return Reflect.get(wrapper.vm, "applied") as boolean;
  },
  get results(): Array<{ input: string; output: string }> {
    return Reflect.get(wrapper.vm, "results") as Array<{
      input: string;
      output: string;
    }>;
  },
  get form(): { value: string } {
    return Reflect.get(wrapper.vm, "form") as { value: string };
  }
});

describe("MaskPreview 视角角色", () => {
  it("默认视角 = 行内规则绑定角色的 pk 集合，载荷携带 roles 与 viewer_roles", async () => {
    state.roleListMock.mockResolvedValue(SUCCESS_RESPONSE);
    state.previewMock.mockResolvedValue({
      code: 1000,
      detail: "ok",
      data: { results: [{ input: "13800000000", output: "138****0000" }] }
    });
    const wrapper = mountPreview({ rule: RULE_WITH_ROLES });
    await flushPromises();

    expect(setupOf(wrapper).viewerRoles).toEqual(["r1", "r2"]);
    // 角色选项懒加载自角色全量列表
    expect(setupOf(wrapper).roleOptions).toEqual([
      { pk: "r1", name: "Admin" },
      { pk: "r2", name: "Ops" }
    ]);

    setupOf(wrapper).form.value = "13800000000";
    await previewButtonOf(wrapper).trigger("click");
    await flushPromises();

    expect(state.previewMock).toHaveBeenCalledWith({
      values: ["13800000000"],
      rule: expect.objectContaining({ roles: ["r1", "r2"] }),
      viewer_roles: ["r1", "r2"]
    });
  });

  it("新建表单入口无规则：视角默认空，roles 空数组随载荷提交", async () => {
    state.roleListMock.mockResolvedValue(SUCCESS_RESPONSE);
    state.previewMock.mockResolvedValue({
      code: 1000,
      detail: "ok",
      data: { results: [{ input: "a", output: "a" }] }
    });
    const wrapper = mountPreview();
    await flushPromises();

    expect(setupOf(wrapper).viewerRoles).toEqual([]);
    setupOf(wrapper).form.value = "a";
    await previewButtonOf(wrapper).trigger("click");
    await flushPromises();

    expect(state.previewMock).toHaveBeenCalledWith({
      values: ["a"],
      rule: expect.objectContaining({ roles: [] }),
      viewer_roles: []
    });
  });

  it("applied=false：顶部提示未命中警示，结果照常回显（原样 output）", async () => {
    state.roleListMock.mockResolvedValue(SUCCESS_RESPONSE);
    state.previewMock.mockResolvedValue({
      code: 1000,
      detail: "ok",
      data: {
        results: [{ input: "13800000000", output: "13800000000" }],
        applied: false
      }
    });
    const wrapper = mountPreview({ rule: RULE_WITH_ROLES });
    await flushPromises();

    setupOf(wrapper).form.value = "13800000000";
    await previewButtonOf(wrapper).trigger("click");
    await flushPromises();

    expect(setupOf(wrapper).applied).toBe(false);
    expect(wrapper.html()).toContain("mask.previewNotApplied");
    // 未命中时 output 原样回显，不再走脱敏结果
    expect(setupOf(wrapper).results).toEqual([
      { input: "13800000000", output: "13800000000" }
    ]);
  });

  it("applied 非 false：维持既有成功展示，不出现未命中警示", async () => {
    state.roleListMock.mockResolvedValue(SUCCESS_RESPONSE);
    state.previewMock.mockResolvedValue({
      code: 1000,
      detail: "ok",
      data: { results: [{ input: "13800000000", output: "138****0000" }] }
    });
    const wrapper = mountPreview({ rule: RULE_WITH_ROLES });
    await flushPromises();

    setupOf(wrapper).form.value = "13800000000";
    await previewButtonOf(wrapper).trigger("click");
    await flushPromises();

    expect(setupOf(wrapper).applied).toBe(true);
    expect(wrapper.html()).not.toContain("mask.previewNotApplied");
  });

  it("角色选项拉取失败：一次性 warning 并保留空选项", async () => {
    state.roleListMock.mockRejectedValue(new Error("network down"));
    const wrapper = mountPreview();
    await flushPromises();

    expect(state.messageMock).toHaveBeenCalledWith(
      "mask.previewRolesLoadFailed",
      { type: "warning" }
    );
    expect(setupOf(wrapper).roleOptions).toEqual([]);
  });
});
