import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import AiNlCard from "../AiNlCard.vue";
import type { NlInterpretResult } from "@/api/ai/ai";

const result = (overrides: Partial<NlInterpretResult> = {}) =>
  ({
    dsl: { dataset: "ds1", mode: "rows", filters: [], limit: 100 },
    dataset_name: "用户",
    preview_count: 200,
    mode: "rows",
    ...overrides
  }) as NlInterpretResult;

const mountCard = (item: NlInterpretResult) =>
  mount(AiNlCard, {
    props: { result: item, runnable: false },
    global: {
      stubs: {
        "el-tag": { template: "<span><slot /></span>" },
        "el-button": { template: "<button><slot /></button>" }
      }
    }
  });

describe("AiNlCard 预览计数", () => {
  it("preview_capped 时显示下限（≥N）", () => {
    expect(mountCard(result({ preview_capped: true })).text()).toContain(
      "≥200"
    );
  });

  it("未截断时显示精确值", () => {
    const text = mountCard(result({ preview_count: 37 })).text();
    expect(text).toContain("37");
    expect(text).not.toContain("≥");
  });
});
