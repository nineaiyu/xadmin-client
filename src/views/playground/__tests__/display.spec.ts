import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import ReJsonViewer from "@/components/ReJsonViewer";
import PlaygroundDisplay from "../display.vue";

describe("Playground 展示样例", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("示例 JSON 版本取构建期注入值，不硬编码版本号", () => {
    vi.stubGlobal("__APP_INFO__", { pkg: { version: "9.9.9" } });
    const wrapper = mount(PlaygroundDisplay, { shallow: true });
    const viewer = wrapper.findComponent(ReJsonViewer);

    expect((viewer.props("value") as { version: string }).version).toBe(
      "9.9.9"
    );
  });
});
