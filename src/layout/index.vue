<script lang="ts" setup>
import "@/style/animate-subset.css";
// 引入 src/components/ReIcon/src/offlineIcon.ts 文件中所有使用addIcon添加过的本地图标
import "@/components/ReIcon/src/offlineIcon";
import { setType } from "./types";
import { useI18n } from "vue-i18n";
import { emitter } from "@/utils/mitt";
import { useAppStoreHook } from "@/store/modules/app";
import { useSettingStoreHook } from "@/store/modules/settings";
import { useUserStoreHook } from "@/store/modules/user";
import {
  useDataThemeChange,
  useSystemThemeWatch
} from "@/layout/hooks/useDataThemeChange";
import { useHeaderAutoHide } from "@/layout/hooks/useHeaderAutoHide";
import { usePreferenceAttributes } from "@/layout/hooks/usePreferenceAttributes";
import { useSplitSidebar } from "@/layout/hooks/useSplitSidebar";
import { createTagsPreferences } from "@/layout/hooks/tagViewsConfig";
import { mixedExtraCollapsed } from "@/layout/hooks/useNavState";
import { useLayoutShortcutKeys } from "@/layout/hooks/useLayoutShortcutKeys";
import { useLockScreen } from "@/layout/hooks/useLockScreen";
import {
  hasSidebar,
  headerModeToAutoHide,
  headerModeToFixed,
  isFullContent,
  resolveHeaderMode,
  resolveLayoutMode
} from "@/layout/hooks/layoutModes";
import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onBeforeMount,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import {
  deviceDetection,
  useGlobal,
  useResizeObserver
} from "@pureadmin/utils";
import { isEqual } from "lodash-es";

import { useRoute } from "vue-router";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { BREAKPOINTS } from "@/utils/breakpoints";
import { prefetchRoutesTo } from "@/utils/routePrefetch";
import LayTag from "./components/lay-tag/index.vue";
import LayNavbar from "./components/lay-navbar/index.vue";
import LayContent from "./components/lay-content/index.vue";
import LaySetting from "./components/lay-setting/index.vue";
import LayLock from "./components/lay-lock/index.vue";
import LayImpersonation from "./components/lay-impersonation/index.vue";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";
import NavVertical from "./components/lay-sidebar/NavVertical.vue";
import NavHorizontal from "./components/lay-sidebar/NavHorizontal.vue";
import BackTopIcon from "@/assets/svg/back_top.svg?component";
import ReBackTop from "@/components/ReBackTop";
import { setupTippy } from "./tippy";

// vue-tippy 全局注册下移到布局层（消费点全在布局树内；入口注册会把
// tippy 引擎与主题样式拖进首屏闭包，详见 ./tippy 的说明）
setupTippy(getCurrentInstance()!.appContext.app);

const { t } = useI18n();
const appWrapperRef = ref();
const isMobile = deviceDetection();
const pureSetting = useSettingStoreHook();

/** 侧栏隐藏（内容区最大化）：页签右键「内容全屏」的内存态，或设置面板 →「隐藏侧栏」的持久化开关 */
const sidebarHidden = computed(
  () =>
    pureSetting.hiddenSideBar || ($storage?.configure?.sidebarHidden ?? false)
);

/** 混合布局的「额外收起」：第二列侧栏单独收起（与主折叠共同决定 hideSidebar） */
const extraCollapsed = computed(() =>
  mixedExtraCollapsed(
    $storage?.layout?.layout,
    $storage?.configure?.sidebarExtraCollapse
  )
);
const { $storage } = useGlobal<GlobalPropertiesApi>();

/** 固定顶栏（设置面板 →「布局」→「顶栏」）：顶栏模式由 `headerMode` 归一（空值回落
 *  历史 headerFixed / headerAutoHide 布尔键），站点配置作为兜底默认值 */
const headerMode = computed(() =>
  resolveHeaderMode(
    $storage?.configure?.headerMode,
    $storage?.configure?.headerFixed ?? pureSetting.fixedHeader,
    $storage?.configure?.headerAutoHide
  )
);
const fixedHeader = computed(() => headerModeToFixed(headerMode.value));

/** CSS 级隐藏顶栏（区别于「非固定」）：隐藏后顶栏整块不渲染，页签条保留 */
const headerHiddenByConfig = computed(
  () => $storage?.configure?.headerHidden ?? false
);

/** 布局语义模式：移动端强制回落竖排（顶栏与双列侧栏在窄屏下不可用） */
const layoutMode = computed(() =>
  resolveLayoutMode(
    $storage?.layout?.layout,
    useAppStoreHook().device === "mobile"
  )
);
/** 切割形态的侧栏可见性（口径见 useSplitSidebar） */
const { hiddenByEmptySplit } = useSplitSidebar();

/**
 * 是否渲染侧栏：水平布局与全屏内容不渲染；「顶栏承担一级导航」的混合系布局
 * 在当前一级没有子菜单时也不渲染（无子菜单即隐藏侧栏，否则
 * 顶栏下方会留一条空白侧栏）。
 */
const sidebarVisible = computed(
  () => hasSidebar(layoutMode.value) && !hiddenByEmptySplit.value
);

/**
 * 全屏内容模式：不渲染侧栏 / 顶栏 / 页签条 / 页脚，
 * 只显示内容主体；设置入口由设置面板的悬浮球兜底（见 lay-setting）。
 */
const fullContent = computed(() => isFullContent(layoutMode.value));

/**
 * 固定头部总高（顶栏 + 页签条）：「内容区让位」（lay-content）与「侧栏排在
 * 顶栏下方」的偏移（混合 / 侧边导航，见 style/sidebar）共用同一口径，落到
 * `--layout-chrome-h` 变量上。
 * - 隐藏页签：只剩顶栏；隐藏顶栏（CSS 级）：只剩页签条；全屏内容：0。
 */
const { tagsStyle } = createTagsPreferences();
const chromeHeight = computed(() => {
  if (fullContent.value) return "0px";
  if ($storage?.configure?.hideTabs) {
    return headerHiddenByConfig.value ? "0px" : "var(--layout-header-h)";
  }
  const tags =
    tagsStyle.value === "chrome"
      ? "var(--layout-tags-chrome-h)"
      : "var(--layout-tags-compact-h)";
  return headerHiddenByConfig.value
    ? `calc(${tags} - var(--layout-header-h))`
    : tags;
});

// 顶栏滚动自动隐藏：开关与「固定顶栏」同时成立才启用（非固定头布局与全屏内容下无固定头部可隐藏）
const { hidden: headerHidden } = useHeaderAutoHide(
  () =>
    fixedHeader.value &&
    headerModeToAutoHide(headerMode.value) &&
    !fullContent.value
);

// 圆角 / 字号 / 侧栏宽度 / 灰度色弱 / 半暗侧栏同步到 <html>，随设置面板改动实时生效；
// 「跟随系统」的常驻监听同样挂在布局层（设置面板按需挂载，不承载常驻副作用）
usePreferenceAttributes();

// 布局级快捷键：锁屏 / 折叠侧栏 / 打开偏好面板 / 退出登录，
// 键位与总开关见设置面板「快捷键」页签（键位录制即改即生效）
const { lock } = useLockScreen();
useLayoutShortcutKeys({
  lock,
  toggleSidebar: () => useAppStoreHook().toggleSideBar(),
  openPreferences: () => emitter.emit("openPanel" as never),
  logout: () => useUserStoreHook().logOut()
});
useSystemThemeWatch();

// 项目设置实时生效：layout/configure 任意设置项变更即防抖自动 PATCH
// （不再依赖面板里的「保存配置」按钮；首次挂载不触发）。
// 两类无意义写入必须挡掉，否则每次页面加载都会整包 PATCH 一次站点配置：
// - 启动静默窗口：首屏会把站点配置回写本地存储（主题色大小写归一、菜单布局、
//   侧栏状态等初始化动作），窗口内的变化只重设同步基线，不发保存；
// - 幂等跳过：窗口外的写入若与最近一次服务端同步快照深比较无差异也不发保存。
const STARTUP_QUIET_MS = 700;
const startupQuietUntil = Date.now() + STARTUP_QUIET_MS;
watch(
  () => [$storage.layout, $storage.configure],
  () => {
    const siteConfigStore = useSiteConfigStoreHook();
    if (Date.now() < startupQuietUntil || !siteConfigStore.syncedSnapshot) {
      siteConfigStore.captureSyncedSnapshot();
      // 偏好比对基线（「撤销本次调整」的比对基准与回填值）同步重捕：启动期这些
      // 回写同样不是用户改动（如站点配置下发 `#006BE6`、运行时归一为 `#006be6`），
      // 不重捕会让面板一打开就带红点
      siteConfigStore.capturePreferenceBaseline();
      return;
    }
    if (
      isEqual(
        { layout: $storage.layout, configure: $storage.configure },
        siteConfigStore.syncedSnapshot
      )
    ) {
      return;
    }
    siteConfigStore.autoSaveSiteConfig();
  },
  { deep: true }
);

const set: setType = reactive({
  // 各字段为 computed ref，reactive 解包后与 setType 对齐
  sidebar: computed(() => {
    return useAppStoreHook().sidebar;
  }),

  device: computed(() => {
    return useAppStoreHook().device;
  }),

  fixedHeader: computed(() => {
    return fixedHeader.value;
  }),

  classes: computed(() => {
    return {
      hideSidebar: !set.sidebar.opened || extraCollapsed.value,
      openSidebar: set.sidebar.opened,
      withoutAnimation: set.sidebar.withoutAnimation,
      mobile: set.device === "mobile"
    };
  }),

  hideTabs: computed(() => {
    return $storage?.configure.hideTabs ?? false;
  })
});

/**
 * 侧栏不可见时（隐藏侧栏 / 移动端抽屉关闭）用 `inert` 移出 Tab 键序与无障碍树：
 * 移动端关闭态是 `transform` 移出画布（元素仍在 DOM、链接仍可聚焦），
 * 键盘用户会 Tab 到看不见的菜单项上。
 */
const sidebarInert = computed(
  () => sidebarHidden.value || (set.device === "mobile" && !set.sidebar.opened)
);

function setTheme(menuLayout: string) {
  window.document.body.setAttribute("layout", menuLayout);
  $storage.layout = {
    layout: `${menuLayout}`,
    theme: $storage.layout?.theme,
    darkMode: $storage.layout?.darkMode,
    sidebarStatus: $storage.layout?.sidebarStatus,
    epThemeColor: $storage.layout?.epThemeColor,
    themeColor: $storage.layout?.themeColor,
    themeMode: $storage.layout?.themeMode
  };
}

function toggle(device: string, bool: boolean) {
  useAppStoreHook().toggleDevice(device);
  useAppStoreHook().toggleSideBar(bool, "resize");
}

// 判断是否可自动关闭菜单栏
let isAutoCloseSidebar = true;

useResizeObserver(appWrapperRef, entries => {
  if (isMobile) return;
  const entry = entries[0];
  const [{ inlineSize: width, blockSize: height }] = entry.borderBoxSize;
  useAppStoreHook().setViewportSize({ width, height });
  width <= BREAKPOINTS.md
    ? setTheme("vertical")
    : setTheme(useAppStoreHook().layout);
  /** width app-wrapper类容器宽度（断点见 src/utils/breakpoints.ts，与 SCSS 侧同源）
   * 0 < width <= md(768) 隐藏侧边栏
   * md(768) < width <= lg(1024) 折叠侧边栏
   * width > lg(1024) 展开侧边栏
   */
  if (width > 0 && width <= BREAKPOINTS.md) {
    toggle("mobile", false);
    isAutoCloseSidebar = true;
  } else if (width > BREAKPOINTS.md && width <= BREAKPOINTS.lg) {
    if (isAutoCloseSidebar) {
      toggle("desktop", false);
      isAutoCloseSidebar = false;
    }
  } else if (width > BREAKPOINTS.lg && !set.sidebar.isClickCollapse) {
    toggle("desktop", true);
    isAutoCloseSidebar = true;
  } else {
    toggle("desktop", false);
    isAutoCloseSidebar = false;
  }
});

onMounted(() => {
  if (isMobile) {
    toggle("mobile", false);
  }
  // 空闲时段预取高频页面 chunk（菜单顺序近似常用度）：缩短二次导航等待，
  // 上限 4 个、跳过当前页、失败静默，见 utils/routePrefetch.ts
  const route = useRoute();
  const paths = usePermissionStoreHook()
    .flatteningRoutes.filter(item => item.path && !item.meta?.frameSrc)
    .map(item => item.path);
  prefetchRoutesTo(paths, { limit: 4, current: route.path });
});

onBeforeMount(() => {
  useDataThemeChange().dataThemeChange($storage.layout?.themeMode);
});

/** 顶栏（含设置入口）的隐藏只跟随「内容全屏」内存态：设置面板的「隐藏侧栏」只隐藏侧栏 */
const headerHiddenByStore = computed(() => pureSetting.hiddenSideBar);

const LayHeader = defineComponent({
  name: "LayHeader",
  render() {
    return h(
      "div",
      {
        class: {
          "fixed-header": set.fixedHeader,
          "header-hidden": headerHidden.value
        },
        style: [
          set.hideTabs && layoutMode.value === "horizontal"
            ? "box-shadow: var(--shadow-navbar)"
            : ""
        ]
      },
      {
        default: () => [
          !headerHiddenByStore.value && !headerHiddenByConfig.value
            ? layoutMode.value === "horizontal"
              ? h(NavHorizontal)
              : h(LayNavbar)
            : null,
          // 用户模拟横幅：模拟态全局常驻（置于导航栏与页签之间，三种布局均可见）
          h(LayImpersonation),
          h(LayTag)
        ]
      }
    );
  }
});
</script>

<template>
  <div
    ref="appWrapperRef"
    :class="[
      'app-wrapper',
      set.classes,
      { 'header-off': headerHiddenByConfig, 'no-sidebar': !sidebarVisible }
    ]"
    :style="{ '--layout-chrome-h': chromeHeight }"
  >
    <div
      v-show="set.device === 'mobile' && set.sidebar.opened && sidebarVisible"
      class="app-mask"
      @click="useAppStoreHook().toggleSideBar()"
    />
    <NavVertical
      v-show="!sidebarHidden && sidebarVisible"
      :inert="sidebarInert"
    />
    <div :class="['main-container', sidebarHidden ? 'main-hidden' : '']">
      <div v-if="set.fixedHeader">
        <!-- 全屏内容模式不渲染顶栏（含页签条）；用户模拟横幅保持常驻（安全提示） -->
        <LayHeader v-if="!fullContent" />
        <LayImpersonation v-else />
        <!-- 主体内容 -->
        <LayContent
          :fixed-header="set.fixedHeader"
          :header-hidden="headerHidden"
          :chrome-height="chromeHeight"
        />
      </div>
      <el-scrollbar v-else>
        <ReBackTop
          :title="t('layout.backTop')"
          target=".main-container .el-scrollbar__wrap"
        >
          <BackTopIcon />
        </ReBackTop>
        <LayHeader v-if="!fullContent" />
        <LayImpersonation v-else />
        <!-- 主体内容 -->
        <LayContent
          :fixed-header="set.fixedHeader"
          :header-hidden="headerHidden"
          :chrome-height="chromeHeight"
        />
      </el-scrollbar>
    </div>
    <!-- 系统设置 -->
    <LaySetting />
    <!-- 锁屏遮罩：覆盖整个应用外壳（含设置面板与已打开的弹窗） -->
    <LayLock />
  </div>
</template>

<style lang="scss" scoped>
.app-wrapper {
  position: relative;
  width: 100%;
  height: 100%;

  /* 外壳不参与文档滚动：布局内的滚动一律由内容区/侧栏自己的 el-scrollbar 承担。
     任何一处溢出（菜单展开、卡片高度误差）都会被计入 html/body 的 scrollHeight，
     从而给每个页面加上一条常驻纵向滚动条；这里裁剪溢出可一次性消除该类问题。
     注：overflow: clip 不裁剪 fixed 定位后代（设置面板/顶栏等 teleport 或 fixed 层不受影响） */
  overflow: clip;

  &::after {
    clear: both;
    display: table;
    content: "";
  }

  &.mobile.openSidebar {
    position: fixed;
    top: 0;
  }
}

.app-mask {
  position: absolute;
  top: 0;
  z-index: 2001;
  width: 100%;
  height: 100%;
  background: hsl(var(--overlay-soft));
}

.re-screen {
  margin-top: 12px;
}
</style>
