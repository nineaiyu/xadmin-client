import { flushPromises, mount } from "@vue/test-utils";
import {
  ElCard,
  ElDescriptions,
  ElDescriptionsItem,
  ElScrollbar,
  ElTag
} from "element-plus";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

// SFC 与平台信息列直接读取构建期注入的 __APP_INFO__，测试态注入等价形态
vi.stubGlobal("__APP_INFO__", {
  pkg: {
    dependencies: { vue: "^3.5.0", axios: "^1.0.0" },
    devDependencies: { eslint: "^9.0.0" },
    engines: { node: "^20.0.0", pnpm: "^9.0.0" }
  },
  lastBuildTime: "2026-10-07 00:00:00"
});

const { PlusDescriptions } = await import("plus-pro-components");
const About = (await import("./index.vue")).default;

const mountAbout = async () => {
  const wrapper = mount(About, {
    global: {
      components: {
        ElCard,
        ElDescriptions,
        ElDescriptionsItem,
        ElScrollbar,
        ElTag,
        PlusDescriptions
      }
    }
  });
  await flushPromises();
  return wrapper;
};

describe("About 主依赖高亮派生自 package.json", () => {
  it("生产依赖全部命中高亮类名，开发依赖不高亮", async () => {
    const wrapper = await mountAbout();

    const labeled = wrapper.findAll(".main-label").map(node => node.text());
    // 生产依赖条目：label 单元格（包名）与版本 span（版本号）各命中一次
    expect(labeled).toEqual(["vue", "^3.5.0", "axios", "^1.0.0"]);
    expect(labeled).not.toContain("eslint");
  });

  it("依赖卡条目数量与 package.json 键集一致", async () => {
    const wrapper = await mountAbout();

    expect(wrapper.findAll(".pure-version").length).toBe(3);
  });
});
