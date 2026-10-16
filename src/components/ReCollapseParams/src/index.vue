<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";

import {
  applyParamDefaults,
  limitDisplay,
  pickAllowed,
  splitParams
} from "./paramsFold";
import type { CollapseParamValues, ReCollapseParamsProps } from "./types";

defineOptions({ name: "ReCollapseParams" });

/**
 * 参数折叠面板：以「名称 / 值 / 说明」三列编辑一组
 * 参数，默认只展示前若干行、其余折叠，点「展开 / 收起」切换。
 *
 * 控件用 Element Plus（`el-input` / `el-input-number` / `el-select`），未引 reka-ui；
 * 纯逻辑（拆分 / 补默认值 / 白名单过滤）见 `paramsFold.ts`。
 */
const props = withDefaults(defineProps<ReCollapseParamsProps>(), {
  visibleCount: 3,
  defaultOpen: false,
  maxHeight: undefined
});

const emit = defineEmits<{
  "update:value": [values: CollapseParamValues, key: string];
}>();

const { t } = useI18n();

const values = defineModel<CollapseParamValues>("value", {
  default: () => ({})
});

const open = ref(props.defaultOpen);

/** 折叠区 id：展开按钮以 aria-controls 关联（useId 保证同页多实例唯一） */
const bodyId = `re-collapse-params-body-${useId()}`;

const parts = computed(() => splitParams(props.params, props.visibleCount));
const rows = computed(() =>
  open.value
    ? [...parts.value.visible, ...parts.value.collapsible]
    : parts.value.visible
);
const hasCollapsible = computed(() => parts.value.collapsible.length > 0);

const bodyStyle = computed(() => {
  if (!open.value || props.maxHeight === undefined) return undefined;
  return {
    maxHeight:
      typeof props.maxHeight === "number"
        ? `${props.maxHeight}px`
        : props.maxHeight
  };
});

function init(force = false): void {
  values.value = applyParamDefaults(values.value, props.params, force);
}

function setValue(key: string, next: CollapseParamValues[string]): void {
  values.value = { ...values.value, [key]: next };
  emit("update:value", values.value, key);
}

function asText(value: CollapseParamValues[string]): string {
  return value === null || value === undefined ? "" : String(value);
}

function asNumber(value: CollapseParamValues[string]): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isNumberField(type: string | undefined): boolean {
  return type === "number" || type === "exponential";
}

/** 展开 / 收起折叠行 */
function toggleCollapsed(): void {
  open.value = !open.value;
}

/** 全部重置为 schema 默认值 */
function resetValues(): void {
  init(true);
}

/** 按 schema 白名单批量赋值（未知键忽略） */
function updateValues(next: CollapseParamValues): void {
  values.value = { ...values.value, ...pickAllowed(next, props.params) };
}

watch(
  () => props.params,
  () => init(),
  { immediate: true, deep: true }
);

defineExpose({ toggleCollapsed, resetValues, updateValues });
</script>

<template>
  <div class="re-collapse-params">
    <div class="re-collapse-params__header">
      <span class="re-collapse-params__cell re-collapse-params__cell--name">
        {{ t("collapseParams.name") }}
      </span>
      <span class="re-collapse-params__cell re-collapse-params__cell--value">
        {{ t("collapseParams.value") }}
      </span>
      <span class="re-collapse-params__cell re-collapse-params__cell--desc">
        {{ t("collapseParams.description") }}
      </span>
    </div>

    <div :id="bodyId" class="re-collapse-params__body" :style="bodyStyle">
      <div v-for="row in rows" :key="row.key" class="re-collapse-params__row">
        <span class="re-collapse-params__cell re-collapse-params__cell--name">
          {{ row.label ?? row.key }}
        </span>
        <span class="re-collapse-params__cell re-collapse-params__cell--value">
          <el-select
            v-if="row.option?.type === 'select'"
            :model-value="values[row.key]"
            class="re-collapse-params__field"
            @update:model-value="setValue(row.key, $event)"
          >
            <el-option
              v-for="item in row.option.options"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-input-number
            v-else-if="isNumberField(row.option?.type)"
            :model-value="asNumber(values[row.key])"
            :min="row.option?.min"
            :max="row.option?.max"
            :step="row.option?.step ?? 1"
            :precision="row.option?.precision"
            class="re-collapse-params__field"
            @update:model-value="setValue(row.key, $event)"
          />
          <el-input
            v-else
            :model-value="asText(values[row.key])"
            class="re-collapse-params__field"
            @update:model-value="setValue(row.key, $event)"
          />
          <span
            v-if="limitDisplay(row.option)"
            class="re-collapse-params__limit"
          >
            {{ limitDisplay(row.option) }}
          </span>
        </span>
        <span class="re-collapse-params__cell re-collapse-params__cell--desc">
          {{ row.description }}
        </span>
      </div>
    </div>

    <div v-if="hasCollapsible" class="re-collapse-params__trigger">
      <el-button
        link
        type="primary"
        :aria-expanded="open"
        :aria-controls="bodyId"
        @click="toggleCollapsed"
      >
        {{ open ? t("collapseParams.fold") : t("collapseParams.unfold") }}
      </el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/style/tokens/breakpoints" as bp;

.re-collapse-params {
  /* 窄屏（移动端断点）：三列改纵向堆叠——表头列宽语义失效故隐藏，名称行
     加粗承载字段名、说明转次要色，避免横向挤压溢出错行 */
  @include bp.below("md") {
    &__header {
      display: none;
    }

    &__row {
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-2) var(--space-4);
    }

    &__cell {
      flex-basis: auto;
      min-width: 0;
      padding: 0;
      font-size: var(--font-size-sm);

      &--name {
        font-weight: var(--font-weight-semibold);
      }
    }

    &__limit {
      align-self: flex-start;
    }
  }

  width: 100%;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);

  &__header {
    display: flex;
    background: var(--el-fill-color-light);
    border-bottom: 1px solid hsl(var(--border-light));
  }

  &__body {
    overflow-y: auto;
  }

  &__row {
    display: flex;

    &:not(:last-child) {
      border-bottom: 1px solid hsl(var(--border-light));
    }
  }

  &__cell {
    display: flex;
    flex: none;
    gap: var(--space-2);
    align-items: center;
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-base);
    line-height: 1.5;

    &--name {
      flex-basis: 180px;
    }

    &--value {
      flex-basis: 300px;
    }

    &--desc {
      flex: 1 1 auto;
      min-width: 220px;
      color: var(--el-text-color-regular);
    }
  }

  &__field {
    width: 100%;
  }

  &__limit {
    flex: none;
    font-size: var(--font-size-sm);
    color: var(--el-text-color-secondary);
  }

  &__trigger {
    display: flex;
    justify-content: center;
    padding: var(--space-1) 0;
    border-top: 1px solid hsl(var(--border-light));
  }
}
</style>
