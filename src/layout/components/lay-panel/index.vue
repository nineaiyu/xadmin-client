<script lang="ts" setup>
import { emitter } from "@/utils/mitt";
import { Z_INDEX } from "@/utils/zIndex";
import { onClickOutside, useClipboard } from "@vueuse/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import {
  buildPlatformConfigSnapshot,
  buildPreferenceDiff,
  hasPreferenceDiff
} from "@/utils/preferenceDiff";
import { message } from "@/utils/message";
import { useConfirm } from "@/hooks/useConfirm";
import { buildRestorePayload } from "@/utils/preferenceRestore";
import { ensureLocale } from "@/plugins/i18n";
import { useConfigureStorage } from "../lay-setting/hooks/useConfigureStorage";
import { useSiteWideEdit } from "../lay-setting/hooks/useSiteWideEdit";
import { buildSiteWideAppearanceDefaults } from "@/layout/hooks/siteWideAppearance";
import CloseIcon from "~icons/ep/close";
import ArrowDownIcon from "~icons/ri/arrow-down-s-line";
import PinOffIcon from "~icons/ri/pushpin-2-fill";
import PinIcon from "~icons/ri/pushpin-2-line";
import { useI18n } from "vue-i18n";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";

const target = ref<HTMLElement | null>(null);
const show = ref<Boolean>(false);
/**
 * 内容重挂载键（透传给面板内容）：批量回退（撤销本次调整 / 恢复站点默认）后
 * 让持有本地快照的设置组件（页签条 / 页脚 / 通用）重新按存储渲染，
 * 避免「存储已回退、面板控件仍显示旧值」。
 */
const contentKey = ref(0);
const { t, locale: i18nLocale } = useI18n();
const {
  pkg: { version }
} = __APP_INFO__;

const { onReset } = useDataThemeChange();

const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();
const { siteWideEditable } = useSiteWideEdit();
const confirm = useConfirm();
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
 * 偏好差异（「撤销本次调整」脏标记）：当前值与同步基线比对，
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

// 复制偏好：一键导出完整平台配置（含 Version / 存储命名空间等非偏好键），
// 可整文件覆盖 public/platform-config.json，或整段粘贴为「系统管理 → 系统配置」的 WEB_SITE_CONFIG 值
const { copy } = useClipboard({ legacy: true });
const copyPreferences = async () => {
  await copy(JSON.stringify(buildPlatformConfigSnapshot(), null, 2));
  message(t("layout.copyPreferencesSuccess"), { type: "success" });
};

// 设置项已实时自动保存（layout/index.vue 的 watch + store.autoSaveSiteConfig），
// 面板不提供「保存配置」按钮，页脚只保留三类「回退」动作与清缓存

/**
 * 撤销本次调整：把三命名空间回填到「打开面板时的同步基线」并立即落库。
 * 本地先即时生效再整包 PATCH（与逐项改动同一链路）；语言不在存储层自动生效，
 * 需一并切回 i18n（en 语料按需补齐）。
 *
 * 回填含站点级外观键（管理员本次会话改过的站点标题 / Logo 等一并撤销，写回系统配置）：
 * 这与「回到打开面板时的状态」的承诺一致，也保证脏标记能真正熄灭。
 */
function revertChanges() {
  const payload = buildRestorePayload(
    siteConfig.preferenceBaseline,
    $storage.layout
  );
  if (!payload) return;
  $storage.locale = payload.locale;
  $storage.layout = payload.layout;
  $storage.configure = payload.configure;
  // 必须与上面的存储写入处于同一同步块：persistPreferences 依赖此刻捕获的
  // 同步快照抑制布局层的防抖自动保存（见 store 内说明），跨 await 会重复 PATCH
  void siteConfig.persistPreferences(t("layout.revertChangesSuccess"));
  // 重挂载本地快照型设置组件，让面板控件同步显示回退后的值
  contentKey.value += 1;
  const target = payload.locale.locale ?? "zh";
  if (i18nLocale.value !== target) {
    void ensureLocale(target).then(() => {
      i18nLocale.value = target;
    });
  }
}

/** 恢复默认：清除个人偏好配置行，重载后回落站点生效值（管理员统一配置） */
async function resetConfig() {
  if (!(await confirm(t("layout.resetConfigConfirm"), { danger: true })))
    return;
  await siteConfig.resetSiteConfig();
}

/**
 * 恢复站点默认（仅管理员）：站点级外观键写回平台默认值（platform-config.json）。
 * 站点级键写系统配置、对全部账号与登录页生效，破坏性明确——二次确认 + 危险色。
 */
async function resetSiteWide() {
  if (!(await confirm(t("layout.resetSiteWideConfirm"), { danger: true }))) {
    return;
  }
  Object.entries(buildSiteWideAppearanceDefaults()).forEach(([key, value]) => {
    storageConfigureChange(key, value);
  });
  void siteConfig.persistPreferences(t("layout.resetSiteWideSuccess"));
  // 站点标题 / Logo 等由本地快照型组件承载，同样重挂载一次同步显示
  contentKey.value += 1;
}

/** 「更多」菜单命令分发：站点默认（管理员）/ 复制偏好 / 清空缓存并返回登录页 */
function onMoreCommand(command: string) {
  if (command === "resetSiteWide") {
    void resetSiteWide();
  } else if (command === "copyPreferences") {
    void copyPreferences();
  } else if (command === "clearCache") {
    onReset();
  }
}

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

      <!-- 内容区：面板按需挂载，`show` 透传给内容决定是否渲染；
           `content-key` 供内容重挂载本地快照型设置组件（批量回退后同步显示） -->
      <el-scrollbar class="lay-panel__body">
        <slot :show="show" :content-key="contentKey" />
      </el-scrollbar>

      <!-- 底部操作：常用回退动作常显（左对齐紧凑），低频与危险动作收进「更多」——
           面板宽度 440px，五个按钮在中文/英文下都会换行成参差两排，收进菜单可保持单行 -->
      <footer class="lay-panel__footer">
        <el-button
          v-tippy="{
            content: t('layout.revertChangesTip'),
            placement: 'top-start',
            zIndex: Z_INDEX.tippy
          }"
          bg
          text
          type="primary"
          :disabled="!preferenceDirty"
          @click="revertChanges"
        >
          <span
            v-if="preferenceDirty"
            class="lay-panel__dirty-dot"
            aria-hidden="true"
          />
          {{ t("layout.revertChanges") }}
        </el-button>
        <el-button
          v-tippy="{
            content: t('layout.resetConfigTip'),
            placement: 'top-start',
            zIndex: Z_INDEX.tippy
          }"
          bg
          text
          type="primary"
          @click="resetConfig"
        >
          {{ t("layout.resetConfig") }}
        </el-button>
        <el-dropdown
          trigger="click"
          placement="top-end"
          @command="onMoreCommand"
        >
          <el-button
            v-tippy="{
              content: t('layout.panelMoreTip'),
              placement: 'top-start',
              zIndex: Z_INDEX.tippy
            }"
            bg
            text
            class="lay-panel__footer-more"
            :aria-label="t('layout.panelMoreTip')"
          >
            {{ t("layout.more") }}
            <IconifyIconOffline
              :icon="ArrowDownIcon"
              height="12px"
              width="12px"
            />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="siteWideEditable" command="resetSiteWide">
                {{ t("layout.resetSiteWide") }}
              </el-dropdown-item>
              <el-dropdown-item
                v-if="copyPreferencesEnabled"
                command="copyPreferences"
              >
                {{ t("layout.copyPreferences") }}
              </el-dropdown-item>
              <el-dropdown-item
                command="clearCache"
                divided
                class="lay-panel__more-danger"
              >
                {{ t("layout.cleanOut") }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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

/* 「撤销本次调整」脏标记：本次会话改动过偏好时显示 */
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

/* 「更多」触发按钮：文案与下拉箭头同排居中，箭头降透明度不抢主操作的视线 */
.lay-panel__footer-more {
  display: inline-flex;
  gap: 2px;
  align-items: center;

  :deep(svg) {
    opacity: 0.6;
  }
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

<!--
  「更多」菜单项：清空缓存是终态操作（断会话并回登录页），用危险色与其它项区分。
  下拉菜单 teleport 到 body，scoped 样式命不中，只能写在非 scoped 块里；
  双类选择器（0-2-0）压过 EP 默认项样式（0-1-0）。
-->
<style lang="scss">
.lay-panel__more-danger.el-dropdown-menu__item {
  color: var(--el-color-danger);

  &:hover,
  &:focus {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }
}
</style>
