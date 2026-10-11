<script lang="ts" setup>
import { h, onMounted, ref, computed, type VNodeChild } from "vue";
import { type TippyContent, type TippyOptions, useTippy } from "vue-tippy";

defineOptions({
  name: "ReText"
});

const props = withDefaults(
  defineProps<{
    /** 行数（不传 = 单行省略） */
    lineClamp?: string | number;
    /** 是否启用点击展开 / 收起 */
    expand?: boolean;
    /** 是否启用悬浮提示（默认启用；仅文本被截断时显示） */
    tooltip?: boolean;
    tippyProps?: TippyOptions;
  }>(),
  {
    expand: false,
    tooltip: true,
    tippyProps: () => ({})
  }
);

const emit = defineEmits<{ expandChange: [boolean] }>();

const slots = defineSlots<{
  content: () => TippyContent;
  default: () => VNodeChild;
}>();

const textRef = ref();
const tippyFunc = ref();
const expanded = ref(false);

const isTextEllipsis = (el: HTMLElement) => {
  if (!props.lineClamp) {
    // 单行省略判断
    return el.scrollWidth > el.clientWidth;
  } else {
    // 多行省略判断
    return el.scrollHeight > el.clientHeight;
  }
};

// 展开态解除截断：单行去掉 truncated、多行取消 lineClamp
const textProps = computed(() => ({
  truncated: !expanded.value && !props.lineClamp,
  lineClamp: expanded.value ? undefined : props.lineClamp
}));

const getTippyProps = () => ({
  content: h(slots.content || slots.default),
  ...props.tippyProps
});

function handleHover(event: MouseEvent) {
  if (!props.tooltip) return;
  if (isTextEllipsis(event.target as HTMLElement)) {
    tippyFunc.value.setProps(getTippyProps());
    tippyFunc.value.enable();
  } else {
    tippyFunc.value.disable();
  }
}

function handleClick() {
  if (!props.expand) return;
  expanded.value = !expanded.value;
  emit("expandChange", expanded.value);
}

onMounted(() => {
  tippyFunc.value = useTippy(textRef.value?.$el, getTippyProps());
});
</script>

<template>
  <el-text
    ref="textRef"
    v-bind="{ ...textProps, ...$attrs }"
    :class="{ 're-text--expandable': expand }"
    @mouseover.self="handleHover"
    @click="handleClick"
  >
    <slot />
  </el-text>
</template>

<style lang="scss" scoped>
.re-text--expandable {
  cursor: pointer;
}
</style>
