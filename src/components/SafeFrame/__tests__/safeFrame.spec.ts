import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SafeFrame from "../index.vue";

describe("SafeFrame 受控 iframe", () => {
  it("默认带 sandbox 与 strict-origin Referer 策略", () => {
    const wrapper = mount(SafeFrame, {
      props: { src: "https://example.com/embed" },
      attrs: { class: "frame-x", "data-testid": "safe-frame" }
    });
    const frame = wrapper.find("iframe");
    expect(frame.attributes("src")).toBe("https://example.com/embed");
    expect(frame.attributes("sandbox")).toContain("allow-scripts");
    expect(frame.attributes("sandbox")).not.toContain("allow-same-origin");
    expect(frame.attributes("referrerpolicy")).toBe(
      "strict-origin-when-cross-origin"
    );
    // 透传 class/testid 到 iframe 本体（三处迁移的样式与 E2E 选择器不受影响）
    expect(frame.classes()).toContain("frame-x");
    expect(frame.attributes("data-testid")).toBe("safe-frame");
  });

  it("调用方可按入口收紧 sandbox / Referer", () => {
    const wrapper = mount(SafeFrame, {
      props: {
        src: "blob:https://example.com/1",
        sandbox: "allow-same-origin",
        referrerpolicy: "no-referrer",
        title: "file-preview"
      }
    });
    const frame = wrapper.find("iframe");
    expect(frame.attributes("sandbox")).toBe("allow-same-origin");
    expect(frame.attributes("referrerpolicy")).toBe("no-referrer");
    expect(frame.attributes("title")).toBe("file-preview");
  });
});
