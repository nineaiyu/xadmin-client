import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import PlaygroundIndex from "../index.vue";

const stubs = {
  "el-card": { template: '<div><slot name="header" /><slot /></div>' },
  "el-row": { template: "<div><slot /></div>" },
  "el-col": { template: "<div><slot /></div>" },
  "el-divider": { template: "<div><slot /></div>" },
  "el-radio-group": { template: "<div><slot /></div>" },
  "el-radio-button": { template: "<div><slot /></div>" },
  "el-input": { template: "<input />" },
  "el-tag": { template: "<span><slot /></span>" },
  ReEmpty: { template: "<div />" }
};

describe("Playground 索引 docs-only 卡片", () => {
  it("无活样例的卡片为默认光标，有样例的卡片可点击", () => {
    const wrapper = mount(PlaygroundIndex, { global: { stubs } });

    const docsOnly = wrapper.find('[data-testid="playground-card-RePage"]');
    expect(docsOnly.classes()).toContain("is-docs-only");
    expect(docsOnly.classes()).not.toContain("cursor-pointer");

    const withDemo = wrapper.find('[data-testid="playground-card-ReText"]');
    expect(withDemo.classes()).toContain("cursor-pointer");
  });
});
