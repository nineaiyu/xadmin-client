import { mount } from "@vue/test-utils";
import { ElButton } from "element-plus/es/components/button/index.mjs";
import { ElInput } from "element-plus/es/components/input/index.mjs";
import { ElPagination } from "element-plus/es/components/pagination/index.mjs";
import { ElPopover } from "element-plus/es/components/popover/index.mjs";
import { ElScrollbar } from "element-plus/es/components/scrollbar/index.mjs";
import { ElTabPane, ElTabs } from "element-plus/es/components/tabs/index.mjs";
import { createI18n } from "vue-i18n";
import { describe, expect, it, vi } from "vitest";

// 图标集懒加载在单测里不触达真实 chunk：本 spec 只验证结构化 a11y
vi.mock("../src/iconRegistry", () => ({
  ensureIconSet: vi.fn(() => Promise.resolve()),
  isIconSetLoaded: () => true,
  isIconAvailable: () => true,
  isIconSetSupported: () => true,
  iconPrefixOf: () => "ep",
  // 渲染入口（IconifyIconOffline）依赖它做名称归一
  normalizeIconName: (name: string) => name,
  supportedIconPrefixes: ["ep", "ri", "fa-solid"],
  markIconAvailable: vi.fn()
}));

import IconSelect from "../src/Select.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      buttons: {
        search: "搜索",
        selectIcon: "选择图标",
        unSelectAll: "取消选择"
      },
      layout: { noData: "暂无数据" }
    }
  }
});

function mountSelect() {
  return mount(IconSelect, {
    props: { modelValue: "" },
    global: {
      plugins: [i18n],
      components: {
        ElButton,
        ElInput,
        ElPagination,
        ElPopover,
        ElScrollbar,
        ElTabPane,
        ElTabs
      }
    }
  });
}

describe("IconSelect 可访问性", () => {
  it("触发器为原生 button 且带可访问名（键盘可聚焦，Enter / Space 可打开）", () => {
    const wrapper = mountSelect();
    const trigger = wrapper.find("button[aria-label]");
    expect(trigger.exists()).toBe(true);
    expect(trigger.attributes("type")).toBe("button");
    expect(trigger.attributes("aria-label")).toBe("选择图标");
  });
});
