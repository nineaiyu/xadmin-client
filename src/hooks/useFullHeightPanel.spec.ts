import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import {
  PANEL_BOTTOM_GAP,
  PANEL_MIN_HEIGHT,
  useFullHeightPanel
} from "./useFullHeightPanel";

/** 在真实组件实例内挂载 hook（onMounted/onActivated 生命周期需要组件上下文）；
 *  根元素绑定 pageRef，measure 才有实测目标（jsdom 下 top 恒为 0） */
function mountHook(options?: Parameters<typeof useFullHeightPanel>[0]) {
  let api: ReturnType<typeof useFullHeightPanel> | null = null;
  const Comp = defineComponent({
    setup() {
      api = useFullHeightPanel(options);
      return () => h("div", { ref: api!.pageRef });
    }
  });
  const app = createApp(Comp);
  app.mount(document.createElement("div"));
  return { api: api!, unmount: () => app.unmount() };
}

function stubViewport(width: number, height: number) {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
}

const fireResize = () => window.dispatchEvent(new Event("resize"));

/** 页脚扣减依赖 .layout-footer 的 offsetHeight，jsdom 无布局需显式桩定 */
function stubFooter(height: number) {
  const footer = document.createElement("div");
  footer.className = "layout-footer";
  Object.defineProperty(footer, "offsetHeight", { value: height });
  document.body.appendChild(footer);
  return footer;
}

beforeEach(() => {
  stubViewport(1024, 768);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelector(".layout-footer")?.remove();
});

describe("useFullHeightPanel", () => {
  it("挂载即首测：面板高度 = 视口高 - 顶部距离 - 底部留白 - 页脚高度", () => {
    const footer = stubFooter(40);
    const { api } = mountHook();
    // jsdom 中 getBoundingClientRect 恒为 0，即面板顶部贴视口顶
    const expected = 768 - PANEL_BOTTOM_GAP - footer.offsetHeight;
    expect(api.panelHeight.value).toBe(expected);
    expect(api.isNarrow.value).toBe(false);
  });

  it("高度下限兜底：视口过矮时不低于 minHeight", () => {
    stubViewport(1024, 300);
    const { api } = mountHook();
    expect(api.panelHeight.value).toBe(PANEL_MIN_HEIGHT);
  });

  it("minHeight / bottomGap 可参数化", () => {
    stubViewport(1024, 500);
    const { api } = mountHook({ minHeight: 200, bottomGap: 10 });
    expect(api.panelHeight.value).toBe(490);
    expect(api.panelMinHeight).toBe(200);
  });

  it("窄屏断点：视口宽 < narrowBreakpoint 时 isNarrow 置 true", () => {
    stubViewport(600, 768);
    const { api } = mountHook({ narrowBreakpoint: 768 });
    expect(api.isNarrow.value).toBe(true);
  });

  it("resize 触发重测：窄屏切换与高度跟随视口", () => {
    const { api } = mountHook();
    expect(api.isNarrow.value).toBe(false);
    stubViewport(500, 600);
    fireResize();
    expect(api.isNarrow.value).toBe(true);
    expect(api.panelHeight.value).toBe(600 - PANEL_BOTTOM_GAP);
  });

  it("measure 可按需手动重测（keep-alive 激活等场景）", () => {
    const { api } = mountHook();
    stubViewport(1024, 900);
    api.measure();
    expect(api.panelHeight.value).toBe(900 - PANEL_BOTTOM_GAP);
  });

  it("页脚元素缺失时按 0 处理，不阻断测量", () => {
    const { api } = mountHook();
    expect(api.panelHeight.value).toBe(768 - PANEL_BOTTOM_GAP);
  });

  it("卸载后移除 resize 监听", () => {
    const { api, unmount } = mountHook();
    unmount();
    stubViewport(500, 600);
    fireResize();
    expect(api.isNarrow.value).toBe(false);
  });
});
