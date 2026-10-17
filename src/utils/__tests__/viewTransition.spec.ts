import { describe, expect, it, vi } from "vitest";

/**
 * 圆形揭示动效的圆心与降级口径。
 *
 * 关键回归点：未发生指针交互时圆心必须落在**视口中心**，不能落在左上角
 * （历史实现用 0 作指针初值，`??` 兜底分支永不生效，导致打开页面即出现
 * 一整屏「从左上角向右下铺开」的动画）。
 */

const VIEWPORT = { width: 1024, height: 768 };

function stubViewport() {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: VIEWPORT.width
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: VIEWPORT.height
  });
}

function stubReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => state
  });
}

function installRevealApi() {
  const animate = vi.fn();
  const startViewTransition = vi.fn((callback: () => void) => {
    callback();
    return { ready: Promise.resolve() };
  });
  Object.defineProperty(document.documentElement, "animate", {
    configurable: true,
    writable: true,
    value: animate
  });
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    writable: true,
    value: startViewTransition
  });
  return { animate, startViewTransition };
}

function removeRevealApi() {
  delete (document as { startViewTransition?: unknown }).startViewTransition;
}

/** 每个用例重新加载模块，保证模块级的「最近指针位置」互不污染 */
async function loadReveal() {
  vi.resetModules();
  return import("@/utils/viewTransition");
}

function firstFrame(animate: ReturnType<typeof vi.fn>): string {
  const [frames] = animate.mock.calls[0] as [{ clipPath: [string, string] }];
  return frames.clipPath[0];
}

describe("withCircleReveal：圆心取点", () => {
  it("未发生指针交互时以视口中心为圆心", async () => {
    stubViewport();
    stubReadyState("complete");
    const { animate } = installRevealApi();
    const { withCircleReveal } = await loadReveal();

    withCircleReveal(() => undefined);

    await vi.waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
    expect(firstFrame(animate)).toBe(
      `circle(0px at ${VIEWPORT.width / 2}px ${VIEWPORT.height / 2}px)`
    );
  });

  it("交互后以最近一次指针落点为圆心", async () => {
    stubViewport();
    stubReadyState("complete");
    const { animate } = installRevealApi();
    const { withCircleReveal } = await loadReveal();

    withCircleReveal(() => undefined);
    window.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 300, clientY: 200 })
    );
    withCircleReveal(() => undefined);

    await vi.waitFor(() => expect(animate).toHaveBeenCalledTimes(2));
    const frames = animate.mock.calls.map(
      call => (call[0] as { clipPath: [string, string] }).clipPath[0]
    );
    expect(frames.at(-1)).toBe("circle(0px at 300px 200px)");
  });

  it("显式圆心优先于指针落点", async () => {
    stubViewport();
    stubReadyState("complete");
    const { animate } = installRevealApi();
    const { withCircleReveal } = await loadReveal();

    window.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 10, clientY: 10 })
    );
    withCircleReveal(() => undefined, { x: 500, y: 400 });

    await vi.waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
    expect(firstFrame(animate)).toBe("circle(0px at 500px 400px)");
  });
});

describe("withCircleReveal：降级口径", () => {
  it("回调一定会执行（动画前后快照切换不丢主题应用）", async () => {
    stubViewport();
    stubReadyState("complete");
    installRevealApi();
    const { withCircleReveal } = await loadReveal();
    const apply = vi.fn();

    withCircleReveal(apply);

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("浏览器不支持 View Transitions 时同步应用且不报错", async () => {
    stubViewport();
    stubReadyState("complete");
    removeRevealApi();
    const { withCircleReveal } = await loadReveal();
    const apply = vi.fn();

    expect(() => withCircleReveal(apply)).not.toThrow();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("文档尚未 complete 时同步应用（避免主题类被推迟到首次渲染之后）", async () => {
    stubViewport();
    stubReadyState("loading");
    const { startViewTransition } = installRevealApi();
    const { withCircleReveal } = await loadReveal();
    const apply = vi.fn();

    withCircleReveal(apply);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("开启「减弱动效」时同步应用", async () => {
    stubViewport();
    stubReadyState("complete");
    const { startViewTransition } = installRevealApi();
    vi.spyOn(window, "matchMedia").mockImplementation(
      query =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn()
        }) as unknown as MediaQueryList
    );
    const { withCircleReveal } = await loadReveal();
    const apply = vi.fn();

    withCircleReveal(apply);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });
});
