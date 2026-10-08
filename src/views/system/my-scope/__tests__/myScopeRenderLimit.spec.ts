import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import MyScope from "../index.vue";

/**
 * 我的管辖页大渲染收敛单测。
 *
 * 核心回归：卡片视图按 RENDER_STEP（200）分批渲染——超量部门先只渲上限、
 * 「加载更多」按剩余量提示并逐批放量；关键字变化重置渲染上限。
 * 层级视图的虚拟树交互（过滤/展开键）由 E2E 承担，这里不挂载断言。
 */

const state = vi.hoisted(() => ({
  managedMock: vi.fn()
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params && "count" in params ? `${key}:${params.count}` : key
  })
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/router/utils", () => ({ hasAuth: () => true }));
vi.mock("@/api/system/dept", () => ({
  deptApi: { managed: state.managedMock }
}));
vi.mock("@/components/ReCountTo", () => ({
  ReNormalCountTo: { name: "ReNormalCountTo", template: "<span />" }
}));
vi.mock("@/components/ReSegmented", () => ({
  default: { name: "Segmented", template: "<div />" }
}));
vi.mock("@/components/ReIcon/src/hooks", () => ({
  useRenderIcon: () => ""
}));
vi.mock("@/views/system/my-scope/components/MemberDrawer.vue", () => ({
  default: { name: "MemberDrawer", template: "<div />" }
}));

const makeDepts = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    pk: `d${index + 1}`,
    name: `Dept ${index + 1}`,
    code: `D${index + 1}`,
    parent_id: null,
    user_count: index + 1,
    is_direct: index < 3,
    leader: null,
    managers: []
  }));

const mountPage = () =>
  mount(MyScope, {
    global: {
      stubs: {
        "el-card": { template: "<div><slot /></div>" },
        "el-input": true,
        "el-icon": true,
        "el-tag": true,
        "el-divider": true,
        "el-link": { template: "<a><slot /></a>" },
        "el-button": { template: "<button type='button'><slot /></button>" },
        "el-tree-v2": true,
        "el-empty": { template: "<div><slot /></div>" }
      }
    }
  });

const deptCards = (wrapper: ReturnType<typeof mountPage>) =>
  wrapper.findAll('[data-testid="my-scope-dept"]');

const loadMoreButton = (wrapper: ReturnType<typeof mountPage>) =>
  wrapper
    .findAll("button")
    .find(node => node.text().includes("systemMyScope.loadMore"));

/** script setup 内部绑定经 vm 代理读写（组件无 defineExpose）：Reflect 反射桥接，避免双重断言 */
const setupOf = (wrapper: ReturnType<typeof mountPage>) => ({
  get keyword(): string {
    return Reflect.get(wrapper.vm, "keyword") as string;
  },
  set keyword(value: string) {
    Reflect.set(wrapper.vm, "keyword", value);
  },
  get renderLimit(): number {
    return Reflect.get(wrapper.vm, "renderLimit") as number;
  }
});

describe("MyScope 卡片渲染上限", () => {
  it("超量部门只渲染 RENDER_STEP 上限，「加载更多」提示剩余量", async () => {
    state.managedMock.mockResolvedValue({
      code: 1000,
      detail: "ok",
      data: { depts: makeDepts(205), dept_count: 205, user_count: 205 }
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(deptCards(wrapper)).toHaveLength(200);
    const button = loadMoreButton(wrapper);
    expect(button, "超上限时应出现加载更多入口").toBeTruthy();
    expect(button!.text()).toContain("systemMyScope.loadMore:5");
  });

  it("点击加载更多按 RENDER_STEP 递增，剩余为零后入口消失", async () => {
    state.managedMock.mockResolvedValue({
      code: 1000,
      detail: "ok",
      data: { depts: makeDepts(205), dept_count: 205, user_count: 205 }
    });
    const wrapper = mountPage();
    await flushPromises();

    await loadMoreButton(wrapper)!.trigger("click");
    await flushPromises();

    expect(deptCards(wrapper)).toHaveLength(205);
    expect(setupOf(wrapper).renderLimit).toBe(400);
    expect(loadMoreButton(wrapper)).toBeUndefined();
  });

  it("关键字变化重置渲染上限（过滤集不沿用旧余量）", async () => {
    state.managedMock.mockResolvedValue({
      code: 1000,
      detail: "ok",
      data: { depts: makeDepts(205), dept_count: 205, user_count: 205 }
    });
    const wrapper = mountPage();
    await flushPromises();

    await loadMoreButton(wrapper)!.trigger("click");
    setupOf(wrapper).keyword = "Dept 20";
    await flushPromises();

    expect(setupOf(wrapper).renderLimit).toBe(200);
    // "Dept 20" 命中 Dept 20 / 200 ~ 205 共 7 条（前缀包含语义）
    expect(deptCards(wrapper)).toHaveLength(7);
    expect(loadMoreButton(wrapper)).toBeUndefined();
  });

  it("部门数不超上限时不出现加载更多入口", async () => {
    state.managedMock.mockResolvedValue({
      code: 1000,
      detail: "ok",
      data: { depts: makeDepts(12), dept_count: 12, user_count: 12 }
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(deptCards(wrapper)).toHaveLength(12);
    expect(loadMoreButton(wrapper)).toBeUndefined();
  });
});
