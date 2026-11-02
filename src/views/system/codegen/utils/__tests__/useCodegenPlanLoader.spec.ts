import { computed, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ modelFields: vi.fn() }));
vi.mock("@/api/system/codegen", () => ({
  systemCodeGenApi: {
    modelFields: (...args: unknown[]) => api.modelFields(...args)
  }
}));
vi.mock("@/utils/apiError", () => ({
  normalizeError: () => ({ detail: "network down" })
}));

import { defaultFormState } from "../payload";
import { useCodegenPlanLoader } from "../useCodegenPlanLoader";
import type { CodegenModelPlan } from "@/api/system/codegen";

function setup(pending = defaultFormState()) {
  const state = defaultFormState();
  const pendingPlanState = ref(pending);
  const result = useCodegenPlanLoader({
    t: (key: string) => key,
    state,
    planData: ref(null),
    planLoading: ref(false),
    planError: ref(""),
    artifacts: ref([]),
    hasPreviewed: ref(false),
    pendingPlanState,
    baselineSignature: ref(""),
    payloadSignature: computed(() => "signature"),
    canLoadFields: true,
    fieldTableRef: ref(undefined)
  });
  return { state, pendingPlanState, ...result };
}

beforeEach(() => {
  api.modelFields.mockReset();
});

describe("codegen 方案载入清理", () => {
  it("切换模型：旧模型的 pending 方案被丢弃", async () => {
    api.modelFields.mockResolvedValue({
      code: 1000,
      data: { fields: [], defaults: {} }
    });
    const pending = { ...defaultFormState(), model: "old.Model" };
    const ctx = setup(pending);

    await ctx.loadPlan("new.Model");

    expect(ctx.pendingPlanState.value).toBeNull();
  });

  it("字段计划业务失败：pending 方案被清理，不留给下一个模型", async () => {
    api.modelFields.mockResolvedValue({
      code: 1001,
      detail: "boom",
      data: null
    });
    const pending = { ...defaultFormState(), model: "demo.Book" };
    const ctx = setup(pending);

    await ctx.loadPlan("demo.Book");

    expect(ctx.pendingPlanState.value).toBeNull();
    expect(ctx.state.fields).toEqual([]);
  });

  it("成功载入：仅保留新模型仍存在的方案字段", async () => {
    api.modelFields.mockResolvedValue({
      code: 1000,
      data: {
        fields: [{ name: "name" }],
        defaults: {
          component: "Book",
          url_prefix: "demo",
          frontend_dir: "demo"
        }
      }
    });
    const pending = {
      ...defaultFormState(),
      model: "demo.Book",
      fields: [{ name: "name" }, { name: "removed" }]
    };
    const ctx = setup(pending);

    await ctx.loadPlan("demo.Book");

    expect(ctx.pendingPlanState.value).toBeNull();
    expect(ctx.state.fields).toEqual([{ name: "name" }]);
  });
});

describe("codegen 方案载入竞态", () => {
  it("快速切模型：旧响应不覆盖新模型的字段与命名默认值", async () => {
    const resolvers: Record<string, (value: unknown) => void> = {};
    api.modelFields.mockImplementation(
      (label: string) =>
        new Promise(resolve => {
          resolvers[label] = resolve;
        })
    );
    const planData = ref<CodegenModelPlan | null>(null);
    const state = defaultFormState();
    const { loadPlan } = useCodegenPlanLoader({
      t: (key: string) => key,
      state,
      planData,
      planLoading: ref(false),
      planError: ref(""),
      artifacts: ref([]),
      hasPreviewed: ref(false),
      pendingPlanState: ref(null),
      baselineSignature: ref(""),
      payloadSignature: computed(() => "signature"),
      canLoadFields: true,
      fieldTableRef: ref(undefined)
    });

    const slowA = loadPlan("A.Model");
    const fastB = loadPlan("B.Model");
    resolvers["B.Model"]({
      code: 1000,
      data: {
        fields: [{ name: "b_field" }],
        defaults: {
          component: "BModel",
          url_prefix: "b",
          frontend_dir: "b"
        }
      }
    });
    await fastB;
    resolvers["A.Model"]({
      code: 1000,
      data: {
        fields: [{ name: "a_field" }],
        defaults: { component: "AModel", url_prefix: "a", frontend_dir: "a" }
      }
    });
    await slowA;

    expect(planData.value?.defaults).toEqual({
      component: "BModel",
      url_prefix: "b",
      frontend_dir: "b"
    });
    expect(state.component).toBe("BModel");
  });
});
