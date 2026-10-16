import { mount } from "@vue/test-utils";
import { addIcon } from "@iconify/vue/dist/offline";
import { afterEach, describe, expect, it, vi } from "vitest";

import LocalIcon from "../src/localIcon";
import {
  iconPrefixOf,
  isIconAvailable,
  markIconAvailable,
  normalizeIconName
} from "../src/iconRegistry";

const ICON_DATA = {
  body: '<path d="M0 0h24v24H0z"/>',
  width: 24,
  height: 24
};

/**
 * 图标名归一：代码内用斜杠名（`useRenderIcon("ep/box")`），服务端菜单元数据与图标
 * 选择器用冒号名（`"ep:refrigerator"` / `ep:` 页签）。两者必须指向同一份注册数据，
 * 否则「布局外全屏页」（登录 / 账户设置 / 邀请激活等不套布局、拿不到随包注册，
 * 只能靠图标集懒加载）会判定未内置并渲染空白。
 */
describe("iconRegistry 图标名归一", () => {
  it("斜杠名与冒号名等价，非图标名（URL）原样返回", () => {
    expect(normalizeIconName("ep/box")).toBe("ep:box");
    expect(normalizeIconName("ri/search-line")).toBe("ri:search-line");
    expect(normalizeIconName("ep:box")).toBe("ep:box");
    expect(normalizeIconName("pure-icon")).toBe("pure-icon");
    expect(normalizeIconName("https://example.com/a.svg")).toBe(
      "https://example.com/a.svg"
    );
  });

  it("前缀解析同时接受斜杠与冒号形态（决定是否触发图标集懒加载）", () => {
    expect(iconPrefixOf("ep:refrigerator")).toBe("ep");
    expect(iconPrefixOf("ep/box")).toBe("ep");
    expect(iconPrefixOf("fa-solid/tag")).toBe("fa-solid");
    expect(iconPrefixOf("pure-icon")).toBe("");
  });

  it("可用性判定按归一后的名字互通（懒加载登记冒号名，代码用斜杠名查）", () => {
    markIconAvailable("ep:normalize-probe");
    expect(isIconAvailable("ep:normalize-probe")).toBe(true);
    expect(isIconAvailable("ep/normalize-probe")).toBe(true);

    markIconAvailable("ep/slash-probe");
    expect(isIconAvailable("ep:slash-probe")).toBe(true);
  });
});

describe("LocalIcon 离线渲染", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("图标集登记（冒号名）后，斜杠名可渲染出 svg", () => {
    // 懒加载走 addCollection，存储键是 `prefix:name`；此处模拟其登记结果
    addIcon("ep:lazy-probe", ICON_DATA as never);
    markIconAvailable("ep:lazy-probe");

    const wrapper = mount(LocalIcon, {
      props: { icon: "ep/lazy-probe" }
    });
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("前缀未内置：渲染空白并告警，不发起在线请求", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const wrapper = mount(LocalIcon, {
      props: { icon: "unknown-set/unknown-icon" }
    });
    expect(wrapper.find("svg").exists()).toBe(false);
    expect(
      warn.mock.calls.some(call => String(call[0]).includes("未随包内置"))
    ).toBe(true);
  });
});
