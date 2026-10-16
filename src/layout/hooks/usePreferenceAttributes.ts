import { watch } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { applyPreferenceAttributes } from "./preferenceAttributes";

/**
 * 偏好属性接线：常量、归一化与应用函数在 preferenceAttributes.ts，本文件只负责
 * 「挂载期同步 + 运行期跟随」——设置面板改动与服务端站点配置回填都会写入
 * `$storage.configure`，此处统一落到 `<html>` 属性/变量上（在 `layout/index.vue`
 * 调用一次）。实现经 barrel 再导出，既有消费端 import 路径不变。
 */
export * from "./preferenceAttributes";

export function usePreferenceAttributes() {
  const { $storage } = useGlobal<GlobalPropertiesApi>();

  applyPreferenceAttributes($storage?.configure);
  watch(
    () => [
      $storage?.configure?.radius,
      $storage?.configure?.fontScale,
      $storage?.configure?.fontScaleCustom,
      $storage?.configure?.themePreset,
      $storage?.configure?.navigationStyle,
      $storage?.configure?.tagsHeight,
      $storage?.configure?.headerMenuAlign,
      $storage?.configure?.sidebarCollapseWidth,
      $storage?.configure?.sidebarMixedWidth,
      $storage?.configure?.successColor,
      $storage?.configure?.warningColor,
      $storage?.configure?.dangerColor,
      $storage?.configure?.sidebarWidth,
      $storage?.configure?.grey,
      $storage?.configure?.weak,
      $storage?.configure?.semiDarkSidebar,
      $storage?.configure?.semiDarkHeader,
      $storage?.configure?.semiDarkSidebarSub
    ],
    () => applyPreferenceAttributes($storage?.configure)
  );
}
