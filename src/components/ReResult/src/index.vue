<script lang="ts" setup>
import { computed } from "vue";
import SuccessFilled from "~icons/ep/success-filled";
import CircleCloseFilled from "~icons/ep/circle-close-filled";
import WarningFilled from "~icons/ep/warning-filled";
import InfoFilled from "~icons/ep/info-filled";

defineOptions({ name: "ReResult" });

/**
 * 通用结果态：状态图标 + 标题 + 副标题 + 行动区，供「操作结果 / 提交成功 /
 * 无结果 / 模块停用」等场景复用（居中式版式）。
 *
 * 与全页错误骨架 `views/error/components/ErrorPage.vue` 分工不同：后者是横向
 * 「插画 + 状态码 + 返回按钮」的整页骨架，承载路由回退语义，二者非重复实现。
 */
type ResultStatus =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "403"
  | "404"
  | "500"
  | "coming-soon"
  | "offline";

const props = withDefaults(
  defineProps<{
    /** 状态（决定色调与默认图标） */
    status?: ResultStatus;
    /** 标题 */
    title?: string;
    /** 副标题 / 说明 */
    subTitle?: string;
  }>(),
  {
    status: "info",
    title: "",
    subTitle: ""
  }
);

type ResultTone = "success" | "warning" | "danger" | "info";

const tone = computed<ResultTone>(() => {
  switch (props.status) {
    case "success":
      return "success";
    case "warning":
    case "403":
    case "404":
      return "warning";
    case "error":
    case "500":
    case "offline":
      return "danger";
    default:
      return "info";
  }
});

const ICONS = {
  success: SuccessFilled,
  warning: WarningFilled,
  danger: CircleCloseFilled,
  info: InfoFilled
};

const iconComp = computed(() => ICONS[tone.value]);
</script>

<template>
  <div class="re-result" :class="`re-result--${tone}`">
    <div class="re-result__icon">
      <slot name="icon">
        <component :is="iconComp" />
      </slot>
    </div>

    <div v-if="title || $slots.title" class="re-result__title">
      <slot name="title">{{ title }}</slot>
    </div>

    <div
      v-if="subTitle || $slots.subTitle || $slots.default"
      class="re-result__sub"
    >
      <slot name="subTitle">{{ subTitle }}</slot>
      <slot />
    </div>

    <div v-if="$slots.extra" class="re-result__extra">
      <slot name="extra" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.re-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;

  &__icon {
    font-size: var(--display-size-2xl);
    line-height: 1;
  }

  &__title {
    margin-top: var(--space-4);
    font-size: var(--font-size-md);
    font-weight: 600;
    color: hsl(var(--fg));
  }

  &__sub {
    margin-top: var(--space-2);
    font-size: var(--font-size-base);
    color: hsl(var(--fg-muted));
  }

  &__extra {
    margin-top: var(--space-5);
  }

  &--success &__icon {
    color: var(--el-color-success);
  }

  &--warning &__icon {
    color: var(--el-color-warning);
  }

  &--danger &__icon {
    color: var(--el-color-danger);
  }

  &--info &__icon {
    color: var(--el-color-info);
  }
}
</style>
