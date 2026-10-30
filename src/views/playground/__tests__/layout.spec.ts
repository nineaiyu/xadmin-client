import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import PlaygroundLayout from "../layout.vue";

const stubs = {
  ReSplitPane: {
    name: "ReSplitPane",
    props: ["percent", "splitSet"],
    emits: ["update:percent"],
    template:
      '<div><div data-testid="pane-l"><slot name="paneL" /></div><div data-testid="pane-r"><slot name="paneR" /></div></div>'
  },
  ReResize: true,
  ReCollapseParams: true,
  ReCol: { template: "<div><slot /></div>" },
  "el-card": { template: '<div><slot name="header" /><slot /></div>' },
  "el-row": { template: "<div><slot /></div>" },
  "el-col": { template: "<div><slot /></div>" }
};

describe("Playground 布局示例", () => {
  it("ReSplitPane 使用 paneL / paneR 插槽渲染左右栏", () => {
    const wrapper = mount(PlaygroundLayout, { global: { stubs } });

    expect(wrapper.find('[data-testid="pane-l"]').text()).toContain(
      "playground.paneLeft"
    );
    expect(wrapper.find('[data-testid="pane-r"]').text()).toContain(
      "playground.paneRight"
    );
  });
});
