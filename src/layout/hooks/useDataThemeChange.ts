import { computed, ref } from "vue";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import { useGlobal } from "@pureadmin/utils";
import {
  createThemeColorScheme,
  themeColors,
  toggleClass
} from "./themeColorScheme";
import { createAppReset } from "./appReset";
import { normalizeThemeMode } from "./themeMode";
import { withCircleReveal } from "@/utils/viewTransition";

/**
 * 布局存储引用缓存：useGlobal 依赖 getCurrentInstance，而本 hook 也会在
 * matchMedia 回调 / 命令面板回调里被调用——事件期没有组件实例，getCurrentInstance
 * 返回 null，$storage 变 undefined 后读 layout 直接抛 TypeError
 * （表现为挂载时首次同步生效，之后系统明暗切换与命令面板「切换主题」静默失效）。
 * 首次调用必发生在布局 setup 内，缓存后事件回调复用同一引用。
 */
let cachedStorage: GlobalPropertiesApi["$storage"] | null = null;

function resolveStorage() {
  if (cachedStorage) return cachedStorage;
  const { $storage } = useGlobal<GlobalPropertiesApi>();
  if ($storage) cachedStorage = $storage;
  return $storage;
}

/**
 * 深浅色与主题色切换：主题色方案见 themeColorScheme.ts，重置流程见 appReset.ts，
 * 明暗切换的圆形揭示动效见 utils/viewTransition.ts。
 */
export function useDataThemeChange() {
  // 事件回调期首次调用时（极端情况）storage 仍可能为空：仅用于读取默认值，
  // 写入路径发生在布局内的调用点，storage 必然已初始化
  const $storage = resolveStorage() as GlobalPropertiesApi["$storage"];
  const layoutTheme = computed(
    () => $storage?.layout ?? ({} as typeof $storage.layout)
  );
  const layout = computed(() => $storage?.layout?.layout ?? "vertical");
  const dataTheme = ref<boolean>($storage?.layout?.darkMode ?? false);
  const themeMode = ref<string>($storage?.layout?.themeMode ?? "");
  const body = document.documentElement as HTMLElement;

  const {
    setEpThemeColor,
    setLayoutThemeColor,
    setCustomThemeColor,
    applyThemePreset
  } = createThemeColorScheme({
    layoutTheme,
    layout,
    dataTheme,
    themeMode,
    storage: $storage
  });

  /**
   * 浅色、深色整体风格切换。
   *
   * 状态与持久化（`$storage.layout`、EP 主题色）**同步完成**；只有暗色 class
   * 这一视觉动作放进圆形揭示动效（见 utils/viewTransition.ts）——View Transition
   * 的回调会被推迟到下一次渲染，若把存储写入放进去，站点配置自动保存会读到旧值
   * （实测表现为「切深色后刷新回浅色」）。
   *
   * `options.animate = false`：**初始化 / 外部同步**（布局与账户页挂载、站点配置到达、
   * 系统明暗变化）直接应用暗色 class，不播圆形揭示。揭示动效只为「用户主动切换」
   * 服务——初始化时播放会表现为打开页面即全屏从左上角铺开的无意义动画。
   */
  function dataThemeChange(overall?: string, options?: { animate?: boolean }) {
    themeMode.value = normalizeThemeMode(overall);
    if (useEpThemeStoreHook().epTheme === "light" && dataTheme.value) {
      setLayoutThemeColor("default", false);
    } else {
      setLayoutThemeColor(useEpThemeStoreHook().epTheme, false);
    }
    if (!dataTheme.value && $storage?.layout?.themeColor === "light") {
      setLayoutThemeColor("light", false);
    }

    const applyDarkClass = () => {
      document.documentElement.classList.toggle("dark", dataTheme.value);
    };
    if (options?.animate === false) {
      applyDarkClass();
      return;
    }
    withCircleReveal(applyDarkClass);
  }

  const onReset = createAppReset({ setEpThemeColor });

  return {
    body,
    dataTheme,
    themeMode,
    layoutTheme,
    themeColors,
    onReset,
    toggleClass,
    dataThemeChange,
    setEpThemeColor,
    setLayoutThemeColor,
    setCustomThemeColor,
    applyThemePreset
  };
}
