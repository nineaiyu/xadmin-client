import { readConfigurePreferences } from "@/utils/preferences";
import {
  matchShortcut,
  parseShortcut,
  resolveShortcutKeys
} from "@/utils/shortcutKeys";

/**
 * 命令面板唤起键位判定（自 useCommandPalette.ts 抽出）：快捷键总开关
 * 或「全局搜索」键位关闭后不响应（顶栏搜索入口不受影响）。
 */
export function isPaletteShortcut(event: KeyboardEvent): boolean {
  const prefs = readConfigurePreferences();
  if (prefs.shortcutEnable === false) return false;
  const value = resolveShortcutKeys(
    prefs.shortcutSearchKeys,
    prefs.shortcutSearch,
    "mod+k"
  );
  return matchShortcut(event, parseShortcut(value));
}
