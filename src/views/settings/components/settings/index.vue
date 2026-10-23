<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useMediaQuery } from "@vueuse/core";
import LocalIcon from "@/components/ReIcon/src/localIcon";
import { BREAKPOINTS } from "@/utils/breakpoints";
import { resolveInitialPane, syncTabQuery } from "@/utils/tabQuery";
import SettingItem from "./SettingItem.vue";
import type { settingsPane } from "./types";

defineOptions({
  name: "Setting"
});

/**
 * 系统设置页骨架：左侧分组导航 + 右侧「内容纸」。
 *
 * - 导航与面板均按 `panes` 渲染；自定义面板（列表 / 实时预览等复合内容）
 *   由页面以具名插槽 `#<key>` 提供，表单型面板给 `item`；
 * - 保留 tablist / tab / tabpanel 语义（role + aria-selected / aria-controls，
 *   方向键与 Home / End 键盘导航），可访问性与 E2E 的 role 定位口径不变；
 * - 单页签页面（如 LDAP）不渲染导航，内容纸铺满，避免孤立导航项；
 * - 窄屏（<md）导航收为顶部横向滚动胶囊，内容纸下移；
 * - 面板懒挂载（首次激活才渲染）且切回不重建：表单状态与详情请求不重放；
 * - 当前面板同步 `?tab=<key>`（`history.replaceState`，不触发路由导航）：
 *   刷新 / 复制链接可回到所在面板，非法 key 回落首个可用面板。
 */
const props = withDefaults(
  defineProps<{
    /** 面板清单（顺序即导航顺序） */
    panes?: settingsPane[];
  }>(),
  { panes: () => [] }
);

const { t } = useI18n();
const route = useRoute();

/** 当前面板键：可受控（v-model:active），缺省内部管理并落在首个面板 */
const active = defineModel<string>("active", { default: "" });

/**
 * 可见面板：表单型面板缺 `retrieve` 权限时不进导航（否则渲染一张空白表单，用户
 * 以为「配置是空的」）；自定义插槽面板没有 item，是否可见由页面自行判断。
 */
const paneList = computed(() =>
  (props.panes ?? []).filter(
    // 表单型面板显式判定为无 retrieve 时不进导航（未配置 auth 的自定义面板保持可见）
    pane => !pane.item?.auth || pane.item.auth.retrieve !== false
  )
);
const hasPanes = computed(() => paneList.value.length > 0);
/** 当前键必须仍存在于 paneList：动态渠道收缩时回落到首项，避免空白内容区 */
const currentKey = computed(() => {
  const keys = paneList.value.map(pane => pane.key);
  return keys.includes(active.value) ? active.value : (keys[0] ?? "");
});
const multiPane = computed(() => paneList.value.length > 1);
const isNarrow = useMediaQuery(`(width <= ${BREAKPOINTS.md}px)`);

/**
 * 面板清单可能异步到达（短信渠道、权限门过滤结果）：到达 / 变化时按 `?tab=`
 * 对齐一次——命中可用 panel 才切换，非法值保持当前（回落首个）不落到空白面板。
 */
watch(
  paneList,
  list => {
    const wanted = resolveInitialPane(list, route.query.tab, "");
    if (wanted) active.value = wanted;
  },
  { deep: true, immediate: true }
);

/** 已挂载面板集合（首次激活才挂载；切换仅显隐，不销毁） */
const visited = ref<Set<string>>(new Set());
watch(
  currentKey,
  key => {
    if (key) visited.value.add(key);
  },
  { immediate: true }
);

/** 导航与面板标题：显式 label 优先，其次按 item 的 localeName/title 推导 */
function paneLabel(pane: settingsPane) {
  if (pane.label) return pane.label;
  if (pane.item?.label) return pane.item.label;
  if (pane.item?.localeName) {
    return t(`${pane.item.localeName}.${pane.item.title ?? "title"}`);
  }
  return pane.key;
}

function select(key: string) {
  active.value = key;
  // 地址栏同步（replaceState，不触发路由导航与在途请求取消）
  syncTabQuery(key);
}

/** 方向键 / Home / End 导航（tablist 标准键盘交互，焦点跟随激活项） */
function onKeydown(event: KeyboardEvent, key: string) {
  const keys = paneList.value.map(pane => pane.key);
  const index = keys.indexOf(key);
  if (index < 0) return;
  let next: number;
  switch (event.key) {
    case "ArrowDown":
    case "ArrowRight":
      next = (index + 1) % keys.length;
      break;
    case "ArrowUp":
    case "ArrowLeft":
      next = (index - 1 + keys.length) % keys.length;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = keys.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  select(keys[next]);
  nextTick(() => {
    document.getElementById(`settings-tab-${keys[next]}`)?.focus();
  });
}
</script>

<template>
  <div class="setting-page" :class="{ 'setting-page--single': !multiPane }">
    <nav
      v-if="multiPane"
      class="setting-page__nav"
      role="tablist"
      :aria-orientation="isNarrow ? 'horizontal' : 'vertical'"
    >
      <button
        v-for="pane in paneList"
        :id="`settings-tab-${pane.key}`"
        :key="pane.key"
        type="button"
        role="tab"
        class="setting-page__tab"
        :class="{ 'is-active': pane.key === currentKey }"
        :aria-selected="pane.key === currentKey"
        :aria-controls="
          visited.has(pane.key) ? `settings-pane-${pane.key}` : undefined
        "
        :tabindex="pane.key === currentKey ? 0 : -1"
        @click="select(pane.key)"
        @keydown="onKeydown($event, pane.key)"
      >
        <LocalIcon
          v-if="pane.icon"
          :icon="pane.icon"
          class="setting-page__tab-icon"
        />
        <span class="setting-page__tab-text">{{ paneLabel(pane) }}</span>
      </button>
    </nav>
    <div class="setting-page__body">
      <!-- 无任何可查看面板：明确说明缺少权限，而不是给一片空白 -->
      <el-empty
        v-if="!hasPanes"
        data-testid="setting-no-permission"
        :description="t('setting.noPermission')"
      />
      <template v-for="pane in paneList" :key="pane.key">
        <section
          v-if="visited.has(pane.key)"
          v-show="pane.key === currentKey"
          :id="`settings-pane-${pane.key}`"
          role="tabpanel"
          :aria-labelledby="multiPane ? `settings-tab-${pane.key}` : undefined"
          :aria-label="multiPane ? undefined : paneLabel(pane)"
          class="setting-page__panel"
          tabindex="0"
        >
          <header
            v-if="multiPane || pane.label || pane.item?.label || pane.desc"
            class="setting-page__panel-head"
          >
            <h3 class="setting-page__panel-title">{{ paneLabel(pane) }}</h3>
            <p v-if="pane.desc" class="setting-page__panel-desc">
              {{ pane.desc }}
            </p>
          </header>
          <SettingItem v-if="pane.item" v-bind="pane.item" />
          <slot v-else :name="pane.key" />
        </section>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/style/tokens/breakpoints" as bp;

.setting-page {
  box-sizing: border-box;
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

/* 单页签：无导航，内容纸独占一行 */
.setting-page--single {
  display: block;
}

/* 左导航卡片：与内容纸同源（同一套圆角 / 描边 / 阴影） */
.setting-page__nav {
  position: sticky;
  top: 0;
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 2px;
  width: 200px;
  padding: var(--space-2);
  background-color: var(--el-bg-color);
  border: var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.setting-page__tab {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  height: 40px;
  padding: 0 var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  background-color: transparent;
  border: none;
  border-radius: var(--radius-md);
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);

  &:hover {
    background-color: var(--el-fill-color-lighter);
  }

  &.is-active {
    font-weight: 500;
    color: var(--el-color-primary);
    background-color: var(--el-fill-color-light);
  }
}

.setting-page__tab-icon {
  flex: none;
  width: 16px;
  height: 16px;
}

.setting-page__tab-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-page__body {
  flex: 1;
  min-width: 0;
}

/* 内容纸：留白取面板变量（桌面 20×24、窄屏 16×12），与账户设置面板同一来源 */
.setting-page__panel {
  padding: var(--panel-pad-y) var(--panel-pad-x);
  background-color: var(--el-bg-color);
  border: var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.setting-page__panel-head {
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--divider);
}

.setting-page__panel-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.setting-page__panel-desc {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  line-height: 20px;
  color: var(--el-text-color-secondary);
}

@include bp.below("md") {
  /* 窄屏：导航收为顶部横向滚动胶囊 */
  .setting-page {
    flex-direction: column;
    gap: var(--space-3);
  }

  .setting-page__nav {
    position: static;
    flex-direction: row;
    gap: var(--space-1);
    width: 100%;
    padding: var(--space-1);
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .setting-page__tab {
    flex: none;
    height: 36px;
  }

  /* 窄屏面板标题收紧一档，避免与导航抢占首屏 */
  .setting-page__panel-title {
    font-size: var(--font-size-base);
  }
}
</style>
