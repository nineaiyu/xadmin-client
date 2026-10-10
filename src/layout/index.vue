<script lang="ts" setup>
import "animate.css";
// 引入 src/components/ReIcon/src/offlineIcon.ts 文件中所有使用addIcon添加过的本地图标
import "@/components/ReIcon/src/offlineIcon";
import { setType } from "./types";
import { useI18n } from "vue-i18n";
import { emitter } from "@/utils/mitt";
import { useLayout } from "./hooks/useLayout";
import { useAppStoreHook } from "@/store/modules/app";
import { useSettingStoreHook } from "@/store/modules/settings";
import { useUserStoreHook } from "@/store/modules/user";
import {
  useDataThemeChange,
  useSystemThemeWatch
} from "@/layout/hooks/useDataThemeChange";
import { useHeaderAutoHide } from "@/layout/hooks/useHeaderAutoHide";
import { usePreferenceAttributes } from "@/layout/hooks/usePreferenceAttributes";
import { useLayoutShortcutKeys } from "@/layout/hooks/useLayoutShortcutKeys";
import { useLockScreen } from "@/layout/hooks/useLockScreen";
import {
  computed,
  defineComponent,
  h,
  onBeforeMount,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import {
  deviceDetection,
  useDark,
  useGlobal,
  useResizeObserver
} from "@pureadmin/utils";

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

const { t } = useI18n();
const appWrapperRef = ref();
const { isDark } = useDark();
const { layout } = useLayout();
const isMobile = deviceDetection();
const pureSetting = useSettingStoreHook();
const { $storage } = useGlobal<GlobalPropertiesApi>();

/** 固定顶栏（设置面板 →「布局」→「顶栏」）：关闭后走非固定头布局，顶栏随内容滚动；
 *  站点配置（`FixedHeader`）作为兜底默认值 */
const fixedHeader = computed(
  () => $storage?.configure?.headerFixed ?? pureSetting.fixedHeader
);

// 顶栏滚动自动隐藏：开关与「固定顶栏」同时成立才启用（非固定头布局下无固定头部可隐藏）
const { hidden: headerHidden } = useHeaderAutoHide(
  () => fixedHeader.value && ($storage?.configure?.headerAutoHide ?? false)
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
// （不再依赖面板里的「保存配置」按钮；首次挂载不触发）
watch(
  () => [$storage.layout, $storage.configure],
  () => {
    useSiteConfigStoreHook().autoSaveSiteConfig();
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
      hideSidebar: !set.sidebar.opened,
      openSidebar: set.sidebar.opened,
      withoutAnimation: set.sidebar.withoutAnimation,
      mobile: set.device === "mobile"
    };
  }),

  hideTabs: computed(() => {
    return $storage?.configure.hideTabs ?? false;
  })
});

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
          set.hideTabs && layout.value.includes("horizontal")
            ? isDark.value
              ? "box-shadow: 0 1px 4px #0d0d0d"
              : "box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08)"
            : ""
        ]
      },
      {
        default: () => [
          !pureSetting.hiddenSideBar &&
          (layout.value.includes("vertical") || layout.value.includes("mix"))
            ? h(LayNavbar)
            : null,
          !pureSetting.hiddenSideBar && layout.value.includes("horizontal")
            ? h(NavHorizontal)
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
  <div ref="appWrapperRef" :class="['app-wrapper', set.classes]">
    <div
      v-show="
        set.device === 'mobile' &&
        set.sidebar.opened &&
        layout.includes('vertical')
      "
      class="app-mask"
      @click="useAppStoreHook().toggleSideBar()"
    />
    <NavVertical
      v-show="
        !pureSetting.hiddenSideBar &&
        (layout.includes('vertical') || layout.includes('mix'))
      "
    />
    <div
      :class="[
        'main-container',
        pureSetting.hiddenSideBar ? 'main-hidden' : ''
      ]"
    >
      <div v-if="set.fixedHeader">
        <LayHeader />
        <!-- 主体内容 -->
        <LayContent
          :fixed-header="set.fixedHeader"
          :header-hidden="headerHidden"
        />
      </div>
      <el-scrollbar v-else>
        <el-backtop
          :title="t('layout.backTop')"
          target=".main-container .el-scrollbar__wrap"
        >
          <BackTopIcon />
        </el-backtop>
        <LayHeader />
        <!-- 主体内容 -->
        <LayContent
          :fixed-header="set.fixedHeader"
          :header-hidden="headerHidden"
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
  background: #000;
  opacity: 0.3;
}

.re-screen {
  margin-top: 12px;
}
</style>
