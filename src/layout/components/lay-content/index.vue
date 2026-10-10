<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import LayFrame from "../lay-frame/index.vue";
import LayFooter from "../lay-footer/index.vue";
import { useTags } from "@/layout/hooks/useTag";
import { useRouteLoading } from "@/utils/routeLoading";
import { isNumber, useGlobal } from "@pureadmin/utils";
import BackTopIcon from "@/assets/svg/back_top.svg?component";
import { computed, defineComponent, h, Transition, type PropType } from "vue";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { useUserStoreHook } from "@/store/modules/user";

const props = defineProps({
  fixedHeader: Boolean,
  /** 顶栏滚动自动隐藏（useHeaderAutoHide）：隐藏时内容区不再让位固定头部 */
  headerHidden: Boolean
});

const { t } = useI18n();
const { tagsStyle } = useTags();
const { $storage, $config } = useGlobal<GlobalPropertiesApi>();

const isKeepAlive = computed(() => {
  return $config?.KeepAlive;
});

/** 内容区紧凑模式（项目设置 →「通用」）：留白收紧一档并居中限宽 */
const compactMode = computed(() => Boolean($storage?.configure?.compactMode));

/** 页面切换动画预设（项目设置 →「通用」→「切换动画」） */
const globalTransition = computed(
  () => $storage?.configure?.pageTransition ?? "fade-transform"
);

/** 路由切换期间的内容区 loading（同区块「内容区 loading」，默认关） */
const { routeLoading } = useRouteLoading();
const contentLoading = computed(
  () => Boolean($storage?.configure?.transitionLoading) && routeLoading.value
);

/** 路由过渡配置：pure-admin 的 meta.transition 为对象（name/enterTransition/leaveTransition） */
interface RouteTransition {
  name?: string;
  enterTransition?: string;
  leaveTransition?: string;
}

const transitions = computed(() => {
  return (route: { meta: { transition?: RouteTransition } }) => {
    return route.meta.transition;
  };
});

const hideTabs = computed(() => {
  return $storage?.configure.hideTabs;
});

const hideFooter = computed(() => {
  return $storage?.configure.hideFooter;
});

const stretch = computed(() => {
  return $storage?.configure.stretch;
});

/** 用户模拟横幅高度（fixed-header 时内容区 padding 需同步让位，与横幅 CSS 保持一致） */
const IMPERSONATION_BANNER_HEIGHT = 32;
const impersonationExtra = computed(() => {
  return useUserStoreHook().impersonator ? IMPERSONATION_BANNER_HEIGHT : 0;
});

const layout = computed(() => {
  return $storage?.layout.layout === "vertical";
});

const getMainWidth = computed(() => {
  return isNumber(stretch.value)
    ? stretch.value + "px"
    : stretch.value
      ? "1440px"
      : "100%";
});

/** 当前固定头部总高（CSS 令牌引用，数值见 tokens/primitives.scss）：
 *  隐藏页签 = 顶栏；显示页签按风格取「顶栏 + 页签条」总高 */
const chromeHeight = computed(() =>
  hideTabs.value
    ? "var(--layout-header-h)"
    : tagsStyle.value === "chrome"
      ? "var(--layout-tags-chrome-h)"
      : "var(--layout-tags-compact-h)"
);

const getSectionStyle = computed(() => {
  // 顶栏自动隐藏态：固定头部整体移出视口，内容区不再让位（剩余算式同口径取 0px）
  const chrome = props.headerHidden ? "0px" : chromeHeight.value;
  // impersonationExtra > 0 时各项 padding-top 同步让位横幅高度（非 fixed-header
  // 模式由末项整体重置 padding，不受影响）
  const pad = (base: string) =>
    `padding-top: calc(${base} + ${impersonationExtra.value}px);`;
  return [
    layout.value ? (props.headerHidden ? "padding-top: 0;" : pad(chrome)) : "",
    // 非 fixed-header：不预留 padding，改为最小高度兜底（dvh 兼顾移动端浏览器工具栏）
    props.fixedHeader
      ? ""
      : `padding-top: 0;min-height: calc(100dvh - ${chrome});`
  ];
});

/** 跳转主内容（R5）：编程聚焦 + tabindex=-1（非交互容器可聚焦）；
 *  不用锚点默认跳转——hash 路由下会把 location.hash 改写成 #main-content 造成路由错乱 */
const focusMainContent = () => {
  const main = document.getElementById("main-content");
  if (!main) return;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.focus();
  main.scrollIntoView({ block: "start" });
};

const transitionMain = defineComponent({
  props: {
    route: {
      // 声明为过渡配置消费面：render 内可直接读取 meta.transition（无需断言）
      type: Object as PropType<{ meta: { transition?: RouteTransition } }>,
      required: true
    }
  },
  render() {
    const transition = transitions.value(this.route);
    // 预设优先级：路由 meta.transition > 设置面板「切换动画」> 缺省 fade-transform；
    // none = 关闭全局过渡（css:false 直接切换，不生成过渡类）
    const preset = transition?.name || globalTransition.value;
    const enableTransition = preset !== "none";
    const enterTransition = transition?.enterTransition;
    const leaveTransition = transition?.leaveTransition;
    return h(
      Transition,
      {
        css: enableTransition,
        name: enterTransition ? "pure-classes-transition" : preset,
        enterActiveClass: enterTransition
          ? `animate__animated animate__${enterTransition}`
          : undefined,
        leaveActiveClass: leaveTransition
          ? `animate__animated animate__${leaveTransition}`
          : undefined,
        mode: "out-in",
        appear: true
      },
      {
        default: () => [this.$slots.default?.()]
      }
    );
  }
});
</script>

<template>
  <section
    v-loading="contentLoading"
    element-loading-background="var(--el-mask-color-extra-light)"
    :class="[
      fixedHeader ? 'app-main' : 'app-main-nofixed-header',
      { compact: compactMode }
    ]"
    :style="getSectionStyle"
  >
    <!-- 跳转主内容（R5）：仅键盘聚焦时可见；@click.prevent 避免 hash 路由被锚点改写 -->
    <a class="skip-link" href="#main-content" @click.prevent="focusMainContent">
      {{ t("layout.skipToContent") }}
    </a>
    <router-view>
      <template #default="{ Component, route }">
        <LayFrame :currComp="Component" :currRoute="route">
          <template #default="{ Comp, fullPath, frameInfo }">
            <el-scrollbar
              v-if="fixedHeader"
              :always="false"
              :view-style="{
                display: 'flex',
                flex: 'auto',
                overflow: 'hidden',
                'flex-direction': 'column'
              }"
              :wrap-style="{
                display: 'flex',
                'flex-wrap': 'wrap',
                'max-width': getMainWidth,
                margin: '0 auto',
                transition: 'all var(--duration-base) var(--ease-standard)'
              }"
            >
              <el-backtop
                :title="t('layout.backTop')"
                target=".app-main .el-scrollbar__wrap"
              >
                <BackTopIcon />
              </el-backtop>
              <div id="main-content" class="grow" role="main">
                <transitionMain :route="route">
                  <keep-alive
                    v-if="isKeepAlive"
                    :include="usePermissionStoreHook().cachePageList"
                  >
                    <component
                      :is="Comp"
                      :key="fullPath"
                      :frameInfo="frameInfo"
                      class="main-content"
                    />
                  </keep-alive>
                  <component
                    :is="Comp"
                    v-else
                    :key="fullPath"
                    :frameInfo="frameInfo"
                    class="main-content"
                  />
                </transitionMain>
              </div>
              <LayFooter v-if="!hideFooter" />
            </el-scrollbar>
            <div v-else id="main-content" class="grow" role="main">
              <transitionMain :route="route">
                <keep-alive
                  v-if="isKeepAlive"
                  :include="usePermissionStoreHook().cachePageList"
                >
                  <component
                    :is="Comp"
                    :key="fullPath"
                    :frameInfo="frameInfo"
                    class="main-content"
                  />
                </keep-alive>
                <component
                  :is="Comp"
                  v-else
                  :key="fullPath"
                  :frameInfo="frameInfo"
                  class="main-content"
                />
              </transitionMain>
            </div>
          </template>
        </LayFrame>
      </template>
    </router-view>

    <!-- 页脚 -->
    <LayFooter v-if="!hideFooter && !fixedHeader" />

    <!-- 读屏播报区（R5）：异步操作结果经 utils/announcer 写入此处 -->
    <div
      id="a11y-live"
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    />
  </section>
</template>

<style scoped>
.app-main {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow-x: hidden;
}

.skip-link {
  position: fixed;
  top: -100px;
  left: 12px;
  z-index: var(--pure-z-index-layout);
  padding: 8px 14px;
  font-size: 14px;
  color: #fff;
  background-color: var(--el-color-primary);
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  transition: top var(--duration-fast) var(--ease-standard);
}

/* 仅键盘聚焦时滑入可视区（display/visibility 隐藏会导致不可聚焦） */
.skip-link:focus,
.skip-link:focus-visible {
  top: 0;
}

.app-main-nofixed-header {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.main-content {
  /* 页面外边距单点提供（密度令牌 --content-gap）：底边不留白，内容区与页脚贴合；
     窄屏收紧值见 style/index.scss 的媒体查询；贴边页面（iframe / 满幅页）在自身
     根节点加 content-flush 类显式声明，不再逐页覆写外边距变量 */
  margin: var(--content-gap) var(--content-gap) 0;
}

.main-content.content-flush {
  margin: 0;
}

/* 紧凑模式：留白收紧一档（24 → 16；窄屏同样以此为准），内容居中限宽避免超宽屏铺满 */
.app-main.compact,
.app-main-nofixed-header.compact {
  --content-gap: var(--space-4);
}

.compact .main-content {
  width: calc(100% - var(--content-gap) * 2);
  max-width: 1600px;
  margin-right: auto;
  margin-left: auto;
}

.compact .main-content.content-flush {
  width: 100%;
  max-width: none;
}
</style>
