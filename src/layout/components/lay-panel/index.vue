<script lang="ts" setup>
import { emitter } from "@/utils/mitt";
import { Z_INDEX } from "@/utils/zIndex";
import { onClickOutside, useClipboard } from "@vueuse/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import {
  buildPreferenceDiff,
  buildPreferenceSnapshot,
  hasPreferenceDiff
} from "@/utils/preferenceDiff";
import { message } from "@/utils/message";
import { useConfigureStorage } from "../lay-setting/hooks/useConfigureStorage";
import CloseIcon from "~icons/ep/close";
import PinOffIcon from "~icons/ri/pushpin-2-fill";
import PinIcon from "~icons/ri/pushpin-2-line";
import { useI18n } from "vue-i18n";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";

const target = ref<HTMLElement | null>(null);
const show = ref<Boolean>(false);
const { t } = useI18n();
const {
  pkg: { version }
} = __APP_INFO__;

const { onReset } = useDataThemeChange();

const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();
const siteConfig = useSiteConfigStoreHook();

/** 面板页签导航吸顶（面板头部 Pin 切换） */
const stickyNav = computed({
  get: () => $storage?.configure?.preferencesStickyNav ?? true,
  set: value => storageConfigureChange("preferencesStickyNav", value)
});

/** 「复制偏好」按钮显隐 */
const copyPreferencesEnabled = computed(
  () => $storage?.configure?.enableCopyPreferences ?? true
);

/**
 * 偏好差异（「重置配置」脏标记）：当前值与同步完成基线比对，
 * 无差异时按钮禁用，有差异时可用并显示标记。
 */
const preferenceDirty = computed(() =>
  hasPreferenceDiff(
    buildPreferenceDiff(
      {
        locale: $storage?.locale,
        layout: $storage?.layout,
        configure: $storage?.configure
      },
      siteConfig.preferenceBaseline
    )
  )
);

// 复制偏好：一键导出当前完整界面偏好（语言 / 布局 / 主题 / 界面开关），反馈问题时一并贴出
const { copy } = useClipboard({ legacy: true });
const copyPreferences = async () => {
  await copy(JSON.stringify(buildPreferenceSnapshot(), null, 2));
  message(t("layout.copyPreferencesSuccess"), { type: "success" });
};

// 设置项已实时自动保存（layout/index.vue 的 watch + store.autoSaveSiteConfig），
// 面板不再提供「保存配置」按钮，仅保留重置与清缓存
const { resetSiteConfig } = useSiteConfigStoreHook();

/**
 * 点击遮罩关闭面板：遮罩铺满视口（z-index 低于面板），点击它即「点在面板之外」。
 * 不依赖 @vueuse 的 onClickOutside 状态机——它在「面板内 pointerdown 之后的首次
 * 外部点击」会被吞掉（需要点两次才关），这里直接挂在遮罩元素上，行为确定。
 */
function closeByMask() {
  show.value = false;
}

onClickOutside(target, event => {
  /**
   * Element Plus 弹层（确认框 / 下拉 / 取色器）挂在 body 上：其内部的点击
   * 不是「点面板之外」——否则面板内打开的任何弹窗一被点击就会连带关闭面板。
   */
  const inPopup = event
    .composedPath()
    .some(
      node =>
        node instanceof HTMLElement &&
        (node.classList.contains("el-overlay") ||
          node.classList.contains("el-popper") ||
          node.classList.contains("el-message-box"))
    );
  if (inPopup) return;
  if (event.clientX > (target.value?.offsetLeft ?? 0)) return;
  show.value = false;
});

onMounted(() => {
  emitter.on("openPanel", () => {
    // 基线兜底：站点配置同步尚未完成（或离线）时，以打开面板时的状态为比对基准
    siteConfig.ensurePreferenceBaseline();
    show.value = true;
  });
});

onBeforeUnmount(() => {
  // 解绑`openPanel`公共事件，防止多次触发
  emitter.off("openPanel");
});
</script>

<template>
  <div :class="{ show }" class="lay-panel">
    <div class="right-panel-background" @click="closeByMask" />
    <div ref="target" class="right-panel flex flex-col bg-bg-card">
      <!-- 头部：标题 + 版本 + 关闭 -->
      <header class="lay-panel__header">
        <div class="lay-panel__heading">
          <h4 class="lay-panel__title">{{ t("layout.settings") }}</h4>
          <span class="lay-panel__version">v{{ version }}</span>
        </div>
        <div class="lay-panel__actions">
          <button
            type="button"
            class="lay-panel__icon-btn"
            :class="{ 'is-active': stickyNav }"
            :title="
              stickyNav
                ? t('layout.preferencesStickyNavDisable')
                : t('layout.preferencesStickyNavEnable')
            "
            :aria-label="
              stickyNav
                ? t('layout.preferencesStickyNavDisable')
                : t('layout.preferencesStickyNavEnable')
            "
            :aria-pressed="stickyNav"
            @click="stickyNav = !stickyNav"
          >
            <IconifyIconOffline
              :icon="stickyNav ? PinOffIcon : PinIcon"
              height="15px"
              width="15px"
            />
          </button>
          <button
            type="button"
            class="lay-panel__icon-btn"
            :aria-label="t('buttons.close')"
            @click="show = !show"
          >
            <IconifyIconOffline :icon="CloseIcon" height="16px" width="16px" />
          </button>
        </div>
      </header>

      <!-- 内容区：面板按需挂载，`show` 透传给内容决定是否渲染 -->
      <el-scrollbar class="lay-panel__body">
        <slot :show="show" />
      </el-scrollbar>

      <!-- 底部操作：重置 / 清缓存 / 复制偏好 -->
      <footer class="lay-panel__footer">
        <el-button
          v-tippy="{
            content: t('layout.resetConfigTip'),
            placement: 'top-start',
            zIndex: Z_INDEX.tippy
          }"
          bg
          text
          type="primary"
          :disabled="!preferenceDirty"
          @click="resetSiteConfig"
        >
          <span
            v-if="preferenceDirty"
            class="lay-panel__dirty-dot"
            aria-hidden="true"
          />
          {{ t("layout.resetConfig") }}
        </el-button>
        <el-button
          v-tippy="{
            content: t('layout.cleanOut'),
            placement: 'top-start',
            zIndex: Z_INDEX.tippy
          }"
          bg
          text
          type="danger"
          @click="onReset"
        >
          {{ t("layout.clearCache") }}
        </el-button>
        <el-button
          v-if="copyPreferencesEnabled"
          v-tippy="{
            content: t('layout.copyPreferencesTip'),
            placement: 'top-start',
            zIndex: Z_INDEX.tippy
          }"
          bg
          text
          @click="copyPreferences"
        >
          {{ t("layout.copyPreferences") }}
        </el-button>
      </footer>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.lay-panel {
  height: 100%;
}

.right-panel-background {
  position: fixed;
  top: 0;
  left: 0;
  z-index: -1;
  background: hsl(var(--overlay-soft));
  opacity: 0;
  transition: opacity var(--duration-base) var(--ease-emphasized);
}

.right-panel {
  position: fixed;
  top: 0;
  right: 0;

  /* z-index 阶梯：面板必须低于 EP 弹层（2000 起），避免遮挡 dialog/confirm */
  z-index: var(--z-index-setting-panel);
  width: 100%;
  max-width: 440px;
  height: 100vh;
  height: 100dvh;
  box-shadow: var(--shadow-panel);
  transform: translate(100%);
  transition: all var(--duration-fast) var(--ease-emphasized);
}

/* 面板骨架：头/底固定，内容区独立滚动 */
.lay-panel__header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--divider);
}

.lay-panel__heading {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.lay-panel__title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.lay-panel__version {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--el-text-color-placeholder);
}

.lay-panel__actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.lay-panel__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  transition:
    color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);

  &:hover {
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
  }

  &.is-active {
    color: var(--el-color-primary);
  }
}

/* 「重置配置」脏标记：存在未重置的偏好差异时显示 */
.lay-panel__dirty-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 4px;
  vertical-align: 1px;
  background: var(--el-color-danger);
  border-radius: var(--radius-full);
}

.lay-panel__body {
  flex: 1;
  min-height: 0;
}

.lay-panel__footer {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid var(--divider);
}

.show {
  transition: all var(--duration-base) var(--ease-emphasized);

  .right-panel-background {
    z-index: var(--z-index-setting-mask);
    width: 100%;
    height: 100%;
    opacity: 1;
  }

  .right-panel {
    transform: translate(0);
  }
}
</style>
