import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  route: {} as {
    meta?: Record<string, unknown>;
    fullPath?: string;
    name?: string;
  }
}));

vi.mock("vue-router", () => ({ useRoute: () => state.route }));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

import LayFrame from "../frame.vue";
import { resolveFrameSandbox } from "../frameSandbox";

const ORIGIN = "https://xadmin.example.com";

function sandboxTokens(sandbox: string | undefined): string[] {
  return (sandbox ?? "").split(/\s+/).filter(Boolean);
}

describe("resolveFrameSandbox 沙箱令牌解析", () => {
  it("跨源 frameSrc 保留 allow-same-origin 的完整能力组合", () => {
    const tokens = sandboxTokens(
      resolveFrameSandbox("https://other.example.com/embed", ORIGIN)
    );
    expect(tokens).toContain("allow-same-origin");
    expect(tokens).toContain("allow-scripts");
    expect(tokens).toContain("allow-forms");
    expect(tokens).toContain("allow-popups");
    expect(tokens).toContain("allow-modals");
    expect(tokens).toContain("allow-downloads");
  });

  it("同源绝对地址去掉 allow-same-origin，其余令牌不变", () => {
    const tokens = sandboxTokens(
      resolveFrameSandbox(`${ORIGIN}/inner-page?t=1`, ORIGIN)
    );
    expect(tokens).not.toContain("allow-same-origin");
    expect(tokens).toContain("allow-scripts");
    expect(tokens).toContain("allow-forms");
    expect(tokens).toContain("allow-popups");
    expect(tokens).toContain("allow-modals");
    expect(tokens).toContain("allow-downloads");
  });

  it("相对路径与空串按同源处理（初始态 fail-closed）", () => {
    for (const src of ["/system/users", "", `blob:${ORIGIN}/uuid`]) {
      const tokens = sandboxTokens(resolveFrameSandbox(src, ORIGIN));
      expect(tokens).not.toContain("allow-same-origin");
      expect(tokens).toContain("allow-scripts");
    }
  });

  it("无法解析的 src 按同源兜底", () => {
    // jsdom 下 new URL 对畸形输入抛 TypeError 即可触发兜底分支
    const tokens = sandboxTokens(resolveFrameSandbox("https://", ORIGIN));
    expect(tokens).not.toContain("allow-same-origin");
    expect(tokens).toContain("allow-scripts");
  });
});

describe("LayFrame 布局 iframe 沙箱（组件层）", () => {
  beforeEach(() => {
    state.route = { meta: {}, fullPath: "/frame", name: "Frame" };
  });

  function mountFrame(frameSrc: string) {
    state.route = { meta: { frameSrc }, fullPath: "/frame", name: "Frame" };
    return mount(LayFrame, {
      global: { directives: { loading: {} } }
    });
  }

  it("跨源 frameSrc：sandbox 含 allow-same-origin 完整组合", () => {
    const wrapper = mountFrame("https://other.example.com/embed");
    const frame = wrapper.find("iframe");
    const tokens = sandboxTokens(frame.attributes("sandbox"));
    expect(tokens).toContain("allow-same-origin");
    expect(tokens).toContain("allow-scripts");
    wrapper.unmount();
  });

  it("同源 frameSrc：sandbox 不含 allow-same-origin", () => {
    // 以运行环境（jsdom）真实 origin 构造同源地址，避免测试环境耦合
    const wrapper = mountFrame(`${window.location.origin}/inner-page`);
    const frame = wrapper.find("iframe");
    const tokens = sandboxTokens(frame.attributes("sandbox"));
    expect(tokens).not.toContain("allow-same-origin");
    expect(tokens).toContain("allow-scripts");
    expect(tokens).toContain("allow-forms");
    wrapper.unmount();
  });
});
