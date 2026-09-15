<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import LayFrame from "../lay-frame/index.vue";
import LayFooter from "../lay-footer/index.vue";
import { useTags } from "@/layout/hooks/useTag";
import { isNumber, useGlobal } from "@pureadmin/utils";
import BackTopIcon from "@/assets/svg/back_top.svg?component";
import { computed, defineComponent, h, Transition } from "vue";
import { usePermissionStoreHook } from "@/store/modules/permission";

const props = defineProps({
  fixedHeader: Boolean
});

const { t } = useI18n();
const { tagsStyle } = useTags();
const { $storage, $config } = useGlobal<GlobalPropertiesApi>();

const isKeepAlive = computed(() => {
  return $config?.KeepAlive;
});

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

const getSectionStyle = computed(() => {
  return [
    hideTabs.value && layout ? "padding-top: 48px;" : "",
    !hideTabs.value && layout
      ? tagsStyle.value == "chrome"
        ? "padding-top: 85px;"
        : "padding-top: 81px;"
      : "",
    hideTabs.value && !layout.value ? "padding-top: 48px;" : "",
    !hideTabs.value && !layout.value
      ? tagsStyle.value == "chrome"
        ? "padding-top: 85px;"
        : "padding-top: 81px;"
      : "",
    props.fixedHeader
      ? ""
      : `padding-top: 0;${
          hideTabs.value
            ? "min-height: calc(100vh - 48px);"
            : "min-height: calc(100vh - 86px);"
        }`
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
      type: undefined,
      required: true
    }
  },
  render() {
    const transition = transitions.value(
      this.route as unknown as { meta: { transition?: RouteTransition } }
    );
    const transitionName = transition?.name || "fade-transform";
    const enterTransition = transition?.enterTransition;
    const leaveTransition = transition?.leaveTransition;
    return h(
      Transition,
      {
        name: enterTransition ? "pure-classes-transition" : transitionName,
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
    :class="[fixedHeader ? 'app-main' : 'app-main-nofixed-header']"
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
                transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
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
  border-radius: 0 0 6px 6px;
  transition: top 0.2s ease-in-out;
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
  /* 页面外边距单点提供（T1）：页面通过覆盖 --main-content-margin 调整，
     不再各自 !important 互搏；缺省 24px 与原行为一致 */
  margin: var(--main-content-margin, 24px);
}
</style>
