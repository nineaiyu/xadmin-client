import { storeToRefs } from "pinia";
import { getConfig } from "@/config";
import Avatar from "@/assets/avatar.png";
import { computed, type CSSProperties } from "vue";
import { useAppStoreHook } from "@/store/modules/app";
import { useUserStoreHook } from "@/store/modules/user";
import { isAllEmpty, useGlobal } from "@pureadmin/utils";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import { usePermissionStoreHook } from "@/store/modules/permission";

/**
 * 顶栏状态（自 useNav.ts 抽出）：布局配置、用户信息兜底、国际化选中样式、
 * 侧栏折叠与设备形态、动态标题来源。
 */
export function useNavState() {
  const pureApp = useAppStoreHook();
  const { wholeMenus } = storeToRefs(usePermissionStoreHook());
  /** 平台`layout`中所有`el-tooltip`的`effect`配置，默认`light` */
  const tooltipEffect = getConfig()?.TooltipEffect ?? "light";

  const getDivStyle = computed((): CSSProperties => {
    return {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      overflow: "hidden"
    };
  });

  /** 头像（如果头像为空则使用 src/assets/user.jpg ） */
  const userAvatar = computed(() => {
    return isAllEmpty(useUserStoreHook()?.avatar)
      ? Avatar
      : useUserStoreHook()?.avatar;
  });

  /** 昵称（如果昵称为空则显示用户名） */
  const username = computed(() => {
    return isAllEmpty(useUserStoreHook()?.nickname)
      ? useUserStoreHook()?.username
      : useUserStoreHook()?.nickname;
  });

  /** 设置国际化选中后的样式 */
  const getDropdownItemStyle = computed(() => {
    return (locale: string, t: string) => {
      return {
        background: locale === t ? useEpThemeStoreHook().epThemeColor : "",
        color: locale === t ? "#f4f4f5" : "#000"
      };
    };
  });

  const getDropdownItemClass = computed(() => {
    return (locale: string, t: string) => {
      return locale === t ? "" : "dark:hover:text-primary!";
    };
  });

  const avatarsStyle = computed(() => {
    return username.value ? { marginRight: "10px" } : "";
  });

  const isCollapse = computed(() => {
    return !pureApp.getSidebarStatus;
  });

  const device = computed(() => {
    return pureApp.getDevice;
  });

  const { $storage, $config } = useGlobal<GlobalPropertiesApi>();
  const layout = computed((): string => {
    return $storage?.layout?.layout ?? "vertical";
  });

  const title = computed(() => {
    return $config.Title;
  });

  return {
    pureApp,
    wholeMenus,
    tooltipEffect,
    getDivStyle,
    userAvatar,
    username,
    getDropdownItemStyle,
    getDropdownItemClass,
    avatarsStyle,
    isCollapse,
    device,
    $storage,
    layout,
    title
  };
}
