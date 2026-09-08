import { describe, expect, it, vi } from "vitest";

import { injectResponsiveStorage } from "../responsive";

/**
 * 响应式存储注入测试：界面配置项必须有默认值注入，
 * 否则设置面板开关读不到初始状态、刷新后行为不确定。
 */

function createAppStub() {
  const use = vi.fn();
  return { use };
}

function inject(config: PlatformConfigs = {}) {
  const app = createAppStub();
  injectResponsiveStorage(app as never, config);
  const [, options] = app.use.mock.calls[0] as [
    unknown,
    { memory: { configure: Record<string, unknown> } }
  ];
  return options.memory.configure;
}

describe("injectResponsiveStorage", () => {
  it("既有配置项默认值不回归（灰度/色弱/隐藏标签页/Logo）", () => {
    const configure = inject();
    expect(configure.grey).toBe(false);
    expect(configure.weak).toBe(false);
    expect(configure.hideTabs).toBe(false);
    expect(configure.showLogo).toBe(true);
  });

  it("平台配置可覆盖默认值", () => {
    const configure = inject({ Grey: true, HideTabs: true });
    expect(configure.grey).toBe(true);
    expect(configure.hideTabs).toBe(true);
  });
});
