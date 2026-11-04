import { onKeyStroke } from "@vueuse/core";
import type { Ref } from "vue";
import { isPaletteShortcut } from "./commandPaletteShortcut";
import { resolvePaletteToggle, whenPaletteOpen } from "./paletteGuard";

/**
 * 命令面板全局按键注册（自 useCommandPalette 抽出，控制其函数/文件行数门禁）。
 *
 * - Enter / ↑ / ↓ 仅面板可见时派发（关闭后任意输入框里按 Enter 不得命中
 *   「上次激活项」——守卫见 paletteGuard.whenPaletteOpen）；
 * - 唤起键位（Cmd/Ctrl+K，键位判定见 commandPaletteShortcut）是 toggle：
 *   已开 → 走 handleClose 关闭（与 Esc/遮罩同口径，清结果 + 还焦点），
 *   已关 → 清导航指针后打开；
 * - 返回解绑函数数组，调用方挂 onBeforeUnmount（onKeyStroke 依赖调用方
 *   所在的 effect scope，须在 setup 期间调用本函数）。
 */
export function registerPaletteKeys(handlers: {
  /** 面板可见性（可写 ref：toggle 打开侧） */
  show: Ref<boolean>;
  /** 唯一导航指针（打开时清空，复开不残留） */
  activeNav: Ref<string>;
  handleEnter: () => void;
  handleUp: () => void;
  handleDown: () => void;
  /** toggle 关闭口径（与 Esc / 遮罩一致：清结果 + 还焦点） */
  handleClose: () => void;
}): Array<() => void> {
  const { show, activeNav, handleEnter, handleUp, handleDown, handleClose } =
    handlers;
  const whenOpen = (handler: () => void) => whenPaletteOpen(show, handler);
  return [
    onKeyStroke("Enter", whenOpen(handleEnter)),
    onKeyStroke("ArrowUp", whenOpen(handleUp)),
    onKeyStroke("ArrowDown", whenOpen(handleDown)),
    // 快捷键总开关 / 全局搜索键位关闭后仍可从顶栏入口打开面板
    onKeyStroke(
      (event: KeyboardEvent) => isPaletteShortcut(event),
      (event: KeyboardEvent) => {
        event.preventDefault();
        if (resolvePaletteToggle(show.value) === "close") {
          handleClose();
          return;
        }
        activeNav.value = "";
        show.value = true;
      },
      { eventName: "keydown" }
    )
  ];
}
