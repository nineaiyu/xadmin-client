import type { Ref } from "vue";

/**
 * 命令面板的按键守卫（自 useCommandPalette 抽出，纯函数便于单测直测）。
 *
 * Enter / ↑ / ↓ 是**全局**键盘监听：面板关闭时若仍执行动作，任意输入框里按
 * Enter 都会命中「上次激活项」——表现为意外跳路由或切换主题。因此所有导航键
 * 都必须先判面板可见性。
 */
export function whenPaletteOpen(
  show: Ref<boolean>,
  handler: () => void
): () => void {
  return () => {
    if (show.value) handler();
  };
}

/**
 * 面板关闭时清空激活项（复开不残留上次高亮）。
 * 以「关闭事件」为触发条件，打开时不动激活项（快速键开关面板仍保留导航位置）。
 */
export function resetActiveWhenClosed(
  activeNav: Ref<string>
): (visible: boolean) => void {
  return (visible: boolean) => {
    if (!visible) activeNav.value = "";
  };
}
