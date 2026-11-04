<script lang="ts" setup>
import type { Props } from "../types";
import { transformI18n } from "@/plugins/i18n";
import { useResizeObserver } from "@pureadmin/utils";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import { pickSelectedForeground } from "@/utils/colorContrast";
import { paletteOptionId } from "../paletteA11y";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { computed, getCurrentInstance, onMounted, ref } from "vue";
import type { optionsItem } from "../types";
import EnterOutlined from "@/assets/svg/enter_outlined.svg?component";

const resultRef = ref();
const innerHeight = ref();
const emit = defineEmits<{
  "update:value": [val: string];
  enter: [];
}>();
const instance = getCurrentInstance()!;
const props = withDefaults(defineProps<Props>(), {});

const itemStyle = computed(() => {
  return (item: optionsItem) => {
    const isActive = item.path === active.value;
    return {
      background: isActive ? useEpThemeStoreHook().epThemeColor : "",
      // 选中态文字按底色亮度自适应：浅主色（用户自定义）下白字对比度不足，
      // 切正文色（WCAG 4.5:1 口径）；选中差异改字重表达（字号跳变会引发布局位移）
      color: isActive
        ? pickSelectedForeground(
            useEpThemeStoreHook().epThemeColor,
            "var(--el-text-color-primary)",
            "var(--el-color-white)"
          )
        : "",
      fontWeight: isActive ? "var(--font-weight-semibold)" : ""
    };
  };
});

const active = computed({
  get() {
    return props.value;
  },
  set(val: string) {
    emit("update:value", val);
  }
});

/** 鼠标移入 */
async function handleMouse(item: optionsItem) {
  active.value = item.path;
}

function handleTo() {
  emit("enter");
}

function resizeResult() {
  // el-scrollbar max-height="calc(90vh - 140px)"
  innerHeight.value = window.innerHeight - window.innerHeight / 10 - 140;
}

useResizeObserver(resultRef, resizeResult);

function handleScroll(index: number) {
  const curInstance = (
    instance?.proxy?.$refs as Record<string, ElRef[] | undefined>
  )?.[`resultItemRef${index}`];
  const curRef = curInstance?.[0];
  if (!curRef) return 0;
  const scrollTop = curRef.offsetTop + 128; // 128 两个result-item（56px+56px=112px）高度加上下margin（8px+8px=16px）
  return scrollTop > innerHeight.value ? scrollTop - innerHeight.value : 0;
}

onMounted(() => {
  resizeResult();
});

defineExpose({ handleScroll });
</script>

<template>
  <div ref="resultRef" class="result">
    <div
      v-for="(item, index) in options"
      :id="paletteOptionId(item.path)"
      :key="item.path"
      :ref="'resultItemRef' + index"
      :style="itemStyle(item)"
      class="result-item dark:bg-fill-subtle"
      role="option"
      :aria-selected="item.path === active"
      @click="handleTo"
      @mouseenter="handleMouse(item)"
    >
      <component :is="useRenderIcon(item.meta?.icon ?? '')" />
      <span class="result-item-title">
        {{ transformI18n(item.meta?.title ?? "") }}
      </span>
      <EnterOutlined />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.result {
  padding-bottom: var(--space-3);

  &-item {
    display: flex;
    align-items: center;
    height: 56px;
    padding: var(--space-3-5);
    margin-top: var(--space-2);
    cursor: pointer;
    border: 0.1px solid hsl(var(--border));
    border-radius: var(--radius-sm);

    /* 字号恒定（选中态用字重/底色表达，箭头键移动不再引发布局位移） */
    transition:
      background-color var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);

    &-title {
      display: flex;
      flex: 1;
      margin-left: var(--space-1);
    }
  }
}
</style>
