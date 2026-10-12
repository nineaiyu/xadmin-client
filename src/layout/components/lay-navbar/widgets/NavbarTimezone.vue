<script setup lang="ts">
// 顶栏「时区」（设置面板 →「布局」→「顶栏组件」可显隐并参与排序）：
// 图标入口 + 弹层内选择展示时区并显示该时区的当前时间。
//
// 与日期格式化链路的关系：本项目时间列口径为「浏览器本地时区」（utils/format.ts），
// 本项只影响此处时钟展示与后续按需接入的展示层，不改写全站时间列语义。
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useConfigureStorage } from "../../lay-setting/hooks/useConfigureStorage";
import { resolveTimezoneOptions } from "@/layout/hooks/timezoneOptions";
import WorldClockIcon from "~icons/fluent-mdl2/world-clock";

const { t } = useNav();
const { locale } = useI18n();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 展示时区（空串 = 跟随浏览器本地时区） */
const timezone = computed({
  get: () => String($storage?.configure?.timezone ?? ""),
  set: value => storageConfigureChange("timezone", value)
});

const options = computed(() => resolveTimezoneOptions());

/** 弹层内时钟：仅弹层打开时按秒刷新，关闭即停（不常驻定时器） */
const open = ref(false);
const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | null = null;

function startClock() {
  open.value = true;
  now.value = new Date();
  stopClock();
  timer = setInterval(() => (now.value = new Date()), 1000);
}
function stopClock() {
  if (timer) clearInterval(timer);
  timer = null;
}
onBeforeUnmount(stopClock);

/** 当前时间文案（按所选时区渲染；无时区偏好时用浏览器本地时区） */
const clockText = computed(() => {
  const zone = timezone.value;
  const options = {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...(zone ? { timeZone: zone } : {})
  } as Intl.DateTimeFormatOptions;
  try {
    return new Intl.DateTimeFormat(
      locale.value === "en" ? "en-US" : "zh-CN",
      options
    ).format(now.value);
  } catch {
    // 时区名失效（浏览器升级删除 / 手改偏好）：回落浏览器本地时区展示
    return new Intl.DateTimeFormat(locale.value === "en" ? "en-US" : "zh-CN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(now.value);
  }
});

/** 当前时区的 UTC 偏移文案（如 UTC+08:00） */
const offsetText = computed(() => {
  const zone = timezone.value;
  const target = new Date(
    now.value.toLocaleString("en-US", zone ? { timeZone: zone } : {})
  );
  const local = new Date(now.value.toLocaleString("en-US"));
  const minutes = Math.round((target.getTime() - local.getTime()) / 60000);
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(
    abs % 60
  ).padStart(2, "0")}`;
});
</script>

<template>
  <el-popover
    :width="260"
    trigger="click"
    placement="bottom"
    popper-class="timezone-popover"
    @show="startClock"
    @hide="stopClock"
  >
    <template #reference>
      <span
        id="header-timezone"
        class="navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
        role="button"
        tabindex="0"
        :title="t('layout.timezone')"
        :aria-label="t('layout.timezone')"
      >
        <IconifyIconOffline :icon="WorldClockIcon" />
      </span>
    </template>
    <div class="timezone-panel">
      <div class="timezone-panel__clock">{{ clockText }}</div>
      <div class="timezone-panel__offset">{{ offsetText }}</div>
      <el-select
        v-model="timezone"
        size="small"
        style="width: 100%"
        filterable
        :placeholder="t('layout.timezoneFollowBrowser')"
      >
        <el-option :label="t('layout.timezoneFollowBrowser')" value="" />
        <el-option
          v-for="item in options"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </div>
  </el-popover>
</template>

<style lang="scss" scoped>
.timezone-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__clock {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-base);
    color: var(--el-text-color-primary);
  }

  &__offset {
    font-size: var(--font-size-xs);
    color: var(--el-text-color-secondary);
  }
}
</style>
