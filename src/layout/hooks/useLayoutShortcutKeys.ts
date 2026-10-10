import { onUnmounted } from "vue";
import { useGlobal } from "@pureadmin/utils";
import {
  isEditableTarget,
  matchShortcut,
  parseShortcut,
  resolveShortcutKeys
} from "@/utils/shortcutKeys";

/**
 * 布局级快捷键（设置面板 →「快捷键」页签），键位支持自定义：
 *
 * - 锁屏（默认 `Alt + L`）；折叠 / 展开侧栏（默认 `Alt + S`）
 * - 打开项目配置面板（默认 `⌘/Ctrl + ,`）；退出登录（默认未启用，空键位）
 *
 * 键位串从响应式存储实时读取（面板改动即时生效）；`shortcutEnable === false`
 * 总开关关闭时全部断开。历史存储里只有布尔开关（shortcutLock 等）、没有键位串，
 * 读取时以布尔开关作兼容输入（false = 该动作未启用）；命令面板（⌘K）由
 * useCommandPalette 消费 shortcutSearchKeys，同一口径。
 *
 * 输入态（input / textarea / select / contenteditable）不响应，避免在表单里打字
 * 误触发；键位录制控件通过 stopPropagation 独占键盘，录制期间不会触发动作。
 */
export function useLayoutShortcutKeys(handlers: {
  lock: () => void;
  toggleSidebar: () => void;
  openPreferences: () => void;
  logout: () => void;
}) {
  const { $storage } = useGlobal<GlobalPropertiesApi>();

  type ShortcutAction = {
    keysKey:
      | "shortcutLockKeys"
      | "shortcutSidebarKeys"
      | "shortcutPreferencesKeys"
      | "shortcutLogoutKeys";
    /** 兼容用历史布尔开关：键位串缺失时以它为据（false = 不启用） */
    legacyKey: "shortcutLock" | "shortcutSidebar" | "";
    fallback: string;
    run: () => void;
  };

  const actions: ShortcutAction[] = [
    {
      keysKey: "shortcutLockKeys",
      legacyKey: "shortcutLock",
      fallback: "alt+l",
      run: handlers.lock
    },
    {
      keysKey: "shortcutSidebarKeys",
      legacyKey: "shortcutSidebar",
      fallback: "alt+s",
      run: handlers.toggleSidebar
    },
    {
      keysKey: "shortcutPreferencesKeys",
      legacyKey: "",
      fallback: "mod+,",
      run: handlers.openPreferences
    },
    {
      keysKey: "shortcutLogoutKeys",
      legacyKey: "",
      fallback: "",
      run: handlers.logout
    }
  ];

  /** 读取动作键位串：显式键位优先，缺失时由旧布尔开关推导 */
  const keysOf = (action: ShortcutAction) =>
    resolveShortcutKeys(
      $storage?.configure?.[action.keysKey],
      action.legacyKey ? $storage?.configure?.[action.legacyKey] : undefined,
      action.fallback
    );

  const onKeydown = (event: KeyboardEvent) => {
    if ($storage?.configure?.shortcutEnable === false) return;
    if (isEditableTarget(event)) return;

    for (const action of actions) {
      // 设置入口关闭后：「打开偏好面板」动作同步失效（避免打开无入口可关闭的面板）
      if (
        action.keysKey === "shortcutPreferencesKeys" &&
        $storage?.configure?.enablePreferences === false
      ) {
        continue;
      }
      const value = keysOf(action);
      if (!value) continue;
      if (!matchShortcut(event, parseShortcut(value))) continue;
      event.preventDefault();
      action.run();
      return;
    }
  };

  window.addEventListener("keydown", onKeydown);
  onUnmounted(() => window.removeEventListener("keydown", onKeydown));
}
