import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { resetActiveWhenClosed, whenPaletteOpen } from "../paletteGuard";

describe("whenPaletteOpen（FE-UI-P1-04 全局按键守卫）", () => {
  it("面板关闭时 Enter/↑↓ 处理器不执行（避免在输入框里意外跳路由）", () => {
    const show = ref(false);
    const handler = vi.fn();
    const guarded = whenPaletteOpen(show, handler);

    guarded();
    expect(handler).not.toHaveBeenCalled();
  });

  it("面板打开时正常派发到导航处理器", () => {
    const show = ref(true);
    const handler = vi.fn();
    const guarded = whenPaletteOpen(show, handler);

    guarded();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("可见性按调用时读取：关闭后同一守卫立即失效", () => {
    const show = ref(true);
    const handler = vi.fn();
    const guarded = whenPaletteOpen(show, handler);

    guarded();
    show.value = false;
    guarded();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("resetActiveWhenClosed（关闭即清激活项）", () => {
  it("关闭时清空激活项，复开不残留上次高亮", () => {
    const activeNav = ref("global:1");
    const reset = resetActiveWhenClosed(activeNav);

    reset(false);
    expect(activeNav.value).toBe("");
  });

  it("打开时不动激活项（快捷键快速开关仍保留导航位置）", () => {
    const activeNav = ref("command:2");
    const reset = resetActiveWhenClosed(activeNav);

    reset(true);
    expect(activeNav.value).toBe("command:2");
  });
});
