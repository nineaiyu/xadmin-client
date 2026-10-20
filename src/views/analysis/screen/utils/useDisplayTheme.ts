import { computed, ref } from "vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { hasAuth } from "@/router/utils";
import { screenApi, type ScreenItem } from "@/api/dataset/analysis";
import {
  normalizeScreenTheme,
  useScreenTheme,
  type ScreenTheme
} from "./screenTheme";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 投屏页的主题控制：**本机预览优先**，可一键固化为大屏默认。
 *
 * 投屏端多为共享展示账号，现场切深浅不该直接改别人的大屏配置，所以切换先落在
 * 本机覆盖（`themeOverride` / `colorOverride`，不落库、刷新即还原）；需要固化时
 * 点「保存为默认」走一次 `partialUpdate`（仅创建者且有编辑权限时可见）。
 * 覆盖优先级与设计器一致：大屏配置 < 本机覆盖，主题色空串 = 跟随站点主色。
 */
export function useDisplayTheme(options: {
  t: TFunction;
  screen: Ref<ScreenItem | null>;
  root: Ref<HTMLElement | undefined>;
}) {
  const { t, screen } = options;
  const themeOverride = ref<ScreenTheme>();
  const colorOverride = ref<string>();

  const { screenDark } = useScreenTheme({
    screen,
    root: options.root,
    override: { theme: themeOverride, color: colorOverride }
  });

  /** 生效主题（本机覆盖优先，回落到大屏配置；缺省深色） */
  const theme = computed<ScreenTheme>(
    () => themeOverride.value ?? normalizeScreenTheme(screen.value?.theme)
  );
  const themeColor = computed(
    () => colorOverride.value ?? screen.value?.theme_color ?? ""
  );
  /** 是否存在本机覆盖（决定「恢复配置」入口） */
  const overridden = computed(
    () => themeOverride.value !== undefined || colorOverride.value !== undefined
  );

  const saving = ref(false);
  /** 固化入口：创建者本人且有编辑权限（其余只做本机预览，避免 1003） */
  const canSave = computed(
    () =>
      hasAuth("partialUpdate:DataScreen") && screen.value?.is_owner !== false
  );

  const onChange = (patch: { theme?: ScreenTheme; theme_color?: string }) => {
    if (patch.theme !== undefined) themeOverride.value = patch.theme;
    if (patch.theme_color !== undefined)
      colorOverride.value = patch.theme_color;
  };

  const reset = () => {
    themeOverride.value = undefined;
    colorOverride.value = undefined;
  };

  /** 把当前生效主题写成大屏默认（写成功即撤本机覆盖，回落到配置值） */
  async function save() {
    const current = screen.value;
    if (!current || saving.value) return;
    const nextTheme = theme.value;
    const nextColor = themeColor.value;
    saving.value = true;
    try {
      const res = await screenApi
        .partialUpdate(current.pk, { theme: nextTheme, theme_color: nextColor })
        .catch(normalizeError);
      if (!isSuccess(res)) {
        if (res.detail) message(String(res.detail), { type: "warning" });
        return;
      }
      reset();
      screen.value = { ...current, theme: nextTheme, theme_color: nextColor };
      message(t("dataScreen.themeSaved"), { type: "success" });
    } finally {
      saving.value = false;
    }
  }

  return {
    screenDark,
    theme,
    themeColor,
    overridden,
    saving,
    canSave,
    onChange,
    reset,
    save
  };
}
