import { computed } from "vue";
import { useDark } from "@pureadmin/utils";

/**
 * 状态色（启用 / 禁用）统一取 EP 语义色：跟随「语义色自定义」与暗色主题，
 * `-light-*` 档在暗色下由 Element Plus 重定义为深色适配值。
 */
const STATUS_TONES = {
  on: {
    "--el-tag-text-color": "var(--el-color-success)",
    "--el-tag-bg-color": "var(--el-color-success-light-9)",
    "--el-tag-border-color": "var(--el-color-success-light-8)"
  },
  off: {
    "--el-tag-text-color": "var(--el-color-danger)",
    "--el-tag-bg-color": "var(--el-color-danger-light-9)",
    "--el-tag-border-color": "var(--el-color-danger-light-8)"
  }
} as const;

export const usePublicHooks = () => {
  const { isDark } = useDark();

  const switchStyle = computed(() => {
    return {
      "--el-switch-on-color": "var(--el-color-success)",
      "--el-switch-off-color": "var(--el-color-danger)"
    };
  });

  const tagStyle = computed(() => {
    return (status: boolean) => STATUS_TONES[status ? "on" : "off"];
  });

  return {
    /** 当前网页是否为`dark`模式 */
    isDark,
    /** 表现更鲜明的`el-switch`组件  */
    switchStyle,
    /** 表现更鲜明的`el-tag`组件  */
    tagStyle
  };
};
