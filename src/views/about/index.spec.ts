import { flushPromises, mount } from "@vue/test-utils";
import {
  ElCard,
  ElDescriptions,
  ElDescriptionsItem,
  ElIcon,
  ElLink,
  ElScrollbar,
  ElTag
} from "element-plus";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, te: () => true })
}));
// 页头标题取自路由 meta（与页签/面包屑同源），测试态注入等价 meta
vi.mock("vue-router", () => ({
  useRoute: () => ({ meta: { title: "aboutTitle" } })
}));

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
        ElIcon,
        ElLink,
        ElScrollbar,
        ElTag,
        PlusDescriptions
      }
    }
  });
  await flushPromises();
  return wrapper;
};

/**
 * 平台信息卡排版守护：版本行用 descriptions（键值对），仓库 / 文档 / 演示
 * 等外链单独成行——回归到 descriptions 里会让 label 与链接文案重复
 * （「前端代码地址 | 前端代码地址」）。
 */
describe("About 平台信息卡排版", () => {
  it("首张卡为「关于」卡（与平台信息同构）并展示技术栈徽章", async () => {
    const wrapper = await mountAbout();

    const firstCard = wrapper.findAll(".el-card")[0];
    expect(firstCard.find(".card-header").exists()).toBe(true);
    // 页头标题来自路由 meta（测试桩为 aboutTitle），版本徽章与之同行
    expect(firstCard.text()).toContain("aboutTitle");
    expect(firstCard.findAll(".about-chip").length).toBe(6);
  });

  it("版本行四项 + 相关链接行四个外链（新窗口打开）", async () => {
    const wrapper = await mountAbout();

    // 平台信息卡（按卡片标题定位，不依赖卡片顺序）：版本行 4 项，
    // label 只出现一次（不再与链接文案重复）
    const platformCard = wrapper
      .findAll(".el-card")
      .find(card => card.text().includes("about.platformInfo"))!;
    const labels = platformCard
      .findAll(".el-descriptions__label")
      .map(node => node.text());
    expect(labels).toEqual([
      "about.version",
      "about.buildTime",
      "about.nodeVersion",
      "about.pnpmVersion"
    ]);

    const links = platformCard.findAll(".about-links a");
    expect(links.length).toBe(4);
    links.forEach(link => {
      expect(link.attributes("target")).toBe("_blank");
      expect(link.attributes("href")).toBeTruthy();
    });
  });
});

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
