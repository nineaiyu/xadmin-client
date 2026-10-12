import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SidebarBadge from "../SidebarBadge.vue";

function mountBadge(props: { badge?: string | null; type?: string | null }) {
  return mount(SidebarBadge, { props });
}

describe("SidebarBadge", () => {
  it("无徽标内容时不渲染", () => {
    expect(mountBadge({}).find(".sidebar-menu-badge").exists()).toBe(false);
    expect(
      mountBadge({ badge: "   " }).find(".sidebar-menu-badge").exists()
    ).toBe(false);
    expect(
      mountBadge({ badge: null }).find(".sidebar-menu-badge").exists()
    ).toBe(false);
  });

  it("文本徽标原样渲染", () => {
    expect(mountBadge({ badge: "new" }).text()).toBe("new");
  });

  it("纯数字大于 99 截断为 99+", () => {
    expect(mountBadge({ badge: "150" }).text()).toBe("99+");
  });

  it("99 及以下不截断", () => {
    expect(mountBadge({ badge: "99" }).text()).toBe("99");
  });

  it("非纯数字徽标不做数字截断", () => {
    expect(mountBadge({ badge: "v150" }).text()).toBe("v150");
  });

  it("dot 形态：无文本且带 is-dot 类", () => {
    const badge = mountBadge({ badge: "3", type: "dot" }).find(
      ".sidebar-menu-badge"
    );
    expect(badge.exists()).toBe(true);
    expect(badge.classes()).toContain("is-dot");
    expect(badge.text()).toBe("");
  });
});
