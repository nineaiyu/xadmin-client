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

  it("顶栏 / 页签 / 侧栏新增偏好默认值（未配置时与迁移前行为一致）", () => {
    const configure = inject();
    expect(configure.sidebarWidth).toBe(210);
    expect(configure.headerFixed).toBe(true);
    expect(configure.breadcrumbVisible).toBe(true);
    expect(configure.maxTagsCount).toBe(0);
    expect(configure.navbarSearch).toBe(true);
    expect(configure.navbarLanguage).toBe(true);
    expect(configure.navbarFullscreen).toBe(true);
    expect(configure.navbarNotice).toBe(true);
  });

  it("半暗顶栏 / 快捷键偏好默认值（浅色外观 + 快捷键默认开）", () => {
    const configure = inject();
    expect(configure.semiDarkSidebar).toBe(false);
    expect(configure.semiDarkHeader).toBe(false);
    expect(configure.shortcutSearch).toBe(true);
    expect(configure.shortcutLock).toBe(true);
    expect(configure.shortcutSidebar).toBe(true);
  });

  it("新增偏好可被平台配置覆盖", () => {
    const configure = inject({
      SidebarWidth: 260,
      HeaderFixed: false,
      BreadcrumbVisible: false,
      MaxTagsCount: 6,
      NavbarSearch: false,
      NavbarNotice: false
    });
    expect(configure.sidebarWidth).toBe(260);
    expect(configure.headerFixed).toBe(false);
    expect(configure.breadcrumbVisible).toBe(false);
    expect(configure.maxTagsCount).toBe(6);
    expect(configure.navbarSearch).toBe(false);
    expect(configure.navbarNotice).toBe(false);
  });
});
