import { storeToRefs } from "pinia";
import { getConfig } from "@/config";
import Avatar from "@/assets/avatar.png";
import { computed, type CSSProperties } from "vue";
import { useAppStoreHook } from "@/store/modules/app";
import { useUserStoreHook } from "@/store/modules/user";
import { isAllEmpty, useGlobal } from "@pureadmin/utils";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { resolveLayoutMode } from "./layoutModes";
import {
  createLocaleDropdownStyles,
  mixedExtraCollapsed
} from "./navPresentation";

/**
 * 顶栏状态（自 useNav.ts 抽出）：布局配置、用户信息兜底、国际化选中样式、
 * 侧栏折叠与设备形态、动态标题来源。展示派生（额外收起判定 / 国际化下拉样式）
 * 见 navPresentation.ts。
 */
export { mixedExtraCollapsed };

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

  /** 设置国际化选中后的样式（实现见 navPresentation.ts） */
  const { getDropdownItemStyle, getDropdownItemClass } =
    createLocaleDropdownStyles();

  const avatarsStyle = computed(() => {
    return username.value ? { marginRight: "10px" } : "";
  });

  const { $storage, $config } = useGlobal<GlobalPropertiesApi>();

  const device = computed(() => pureApp.getDevice);

  /**
   * 有效布局模式：移动端强制回落竖排（与外壳 `resolveLayoutMode` 同源）。
   * 组件层的形态判定（顶栏菜单 / 品牌区 / 菜单折叠标题等）必须使用有效模式——
   * 直接用持久化偏好会让「手机打开曾选过的混合布局」仍渲染顶栏菜单条，
   * 与外壳回落竖排的 DOM 结构错位。
   */
  const layout = computed((): string =>
    resolveLayoutMode($storage?.layout?.layout, device.value === "mobile")
  );

  /**
   * 侧栏折叠态：主折叠（sidebarStatus）或双列布局的「额外收起」偏好
   * （设置面板 →「布局」→「额外收起」，仅双列布局生效；语义见 mixedExtraCollapsed）。
   */
  const isCollapse = computed(() => {
    return (
      !pureApp.getSidebarStatus ||
      mixedExtraCollapsed(
        layout.value,
        $storage?.configure?.sidebarExtraCollapse
      )
    );
  });

  /** 站点标题：偏好（设置面板 / 站点配置同步）优先，回落 platform-config 的 Title */
  const title = computed(() => $storage?.configure?.title || $config.Title);

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
