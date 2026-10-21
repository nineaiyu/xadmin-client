import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  watch
} from "vue";
import type { InjectionKey, Ref } from "vue";
import { useDark } from "@pureadmin/utils";
import { choiceValue } from "@/utils/dict";
import { hexToHslTriplet } from "@/utils/color";
import { withAlpha } from "@/utils/chartTheme";
import type { ScreenChoiceValue } from "@/api/dataset/analysis";

/**
 * 大屏主题（深色 / 浅色 / 跟随站点）的解析与应用——设计器与投屏页共用的单一事实源。
 *
 * 深色是设计基线（`--screen-*` 令牌的缺省值），浅色由 `.screen-root--light`
 * 在**投屏根节点**上成对覆写令牌，不触碰站点主题（`html.dark` / `data-theme`
 * 仍是站点维度）。主题色只覆写根节点的 `--primary` 与 `--el-color-primary`：
 * 后者在 `:root` 已按站点主色完成 `var()` 代换后向下继承，只改 `--primary`
 * 不会影响后代读到的 EP 主色（色条 / 图表取色读的都是它）。
 */

export type ScreenTheme = "dark" | "light" | "auto";

/** 浅色主题的根类名（深色为缺省态，不挂类） */
export const SCREEN_LIGHT_CLASS = "screen-root--light";

/** 生效明暗的注入键：画布窗格按它决定图表配色（设计器与投屏共同祖先提供） */
export const SCREEN_DARK_KEY: InjectionKey<Ref<boolean>> = Symbol("screenDark");

/**
 * 大屏主题 → 实际明暗。
 *
 * `auto` 跟随站点（`isDark` = `html.dark`，由站点主题驱动）；未设置或缺省
 * `dark` 恒深色（存量大屏零观感变化）。
 */
export function resolveScreenTheme(
  theme: ScreenTheme | undefined,
  isDark: boolean
): boolean {
  if (theme === "light") return false;
  if (theme === "auto") return Boolean(isDark);
  return true;
}

/** 配置值 → 主题标量（服务端 labeled choice 为 `{value,label}`；空值回落深色） */
export function normalizeScreenTheme(
  value: ScreenChoiceValue | undefined | null
): ScreenTheme {
  return (choiceValue(value) as ScreenTheme) || "dark";
}

/** 把大屏主题应用到根元素：浅色类 + 可选主题色覆写（空 = 跟随站点主色） */
export function applyScreenTheme(
  root: HTMLElement | null | undefined,
  dark: boolean,
  themeColor?: string | null
): void {
  if (!root) return;
  root.classList.toggle(SCREEN_LIGHT_CLASS, !dark);
  const triplet = themeColor ? hexToHslTriplet(themeColor) : "";
  if (!triplet) {
    resetScreenAccent(root);
    return;
  }
  root.style.setProperty("--primary", triplet);
  // 用 var(--primary) 引用而非拼死值：取值随上行令牌（同元素上的 --primary）联动
  root.style.setProperty("--el-color-primary", "hsl(var(--primary))");
  // 氛围底光晕随主色走：深色画布用主色的低透明度，浅色画布同一支更淡
  root.style.setProperty(
    "--screen-glow-primary",
    withAlpha(themeColor ?? "", dark ? 0.16 : 0.1)
  );
}

/** 撤除主题色覆写（恢复站点主色与默认光晕） */
export function resetScreenAccent(root: HTMLElement | null | undefined): void {
  if (!root) return;
  root.style.removeProperty("--primary");
  root.style.removeProperty("--el-color-primary");
  root.style.removeProperty("--screen-glow-primary");
}

/**
 * 把大屏主题接到组件根节点（`root` 绑定根元素，模板 `ref="root"`）。
 *
 * `screen` 可以是详情响应或设计器里的本地草稿：主题改变即时重应用（所见即所得）；
 * `auto` 随站点明暗实时跟随（`isDark` 由 `html.dark` 的 MutationObserver 驱动）。
 * 同时向子树 provide 生效明暗，画布窗格据此决定图表配色（不逐层透传 prop）。
 */
export function useScreenTheme(options: {
  screen: Ref<
    | { theme?: ScreenChoiceValue; theme_color?: string | null }
    | null
    | undefined
  >;
  root: Ref<HTMLElement | undefined>;
  /**
   * 本机覆盖（投屏页的临时切换）：`undefined` = 跟随大屏配置；
   * 取值为空串 = 显式「跟随站点主色」（需要盖住配置里的主题色）。
   */
  override?: {
    theme?: Ref<ScreenTheme | undefined>;
    color?: Ref<string | undefined>;
  };
}) {
  const { isDark } = useDark();
  const theme = computed<ScreenTheme>(
    () =>
      options.override?.theme?.value ??
      normalizeScreenTheme(options.screen.value?.theme)
  );
  const screenDark = computed(() =>
    resolveScreenTheme(theme.value, isDark.value)
  );
  const themeColor = computed(
    () =>
      options.override?.color?.value ?? options.screen.value?.theme_color ?? ""
  );

  provide(SCREEN_DARK_KEY, screenDark);

  const apply = () => {
    applyScreenTheme(options.root.value, screenDark.value, themeColor.value);
  };

  watch([screenDark, themeColor, options.root], apply, { flush: "post" });
  onMounted(apply);
  onBeforeUnmount(() => {
    resetScreenAccent(options.root.value);
    options.root.value?.classList.remove(SCREEN_LIGHT_CLASS);
  });

  return { screenDark, applyScreenTheme: apply };
}

/** 画布窗格取生效明暗（无提供者时按深色——存量恒深色语义） */
export function injectScreenDark(): Ref<boolean> {
  return inject(
    SCREEN_DARK_KEY,
    computed(() => true)
  );
}
