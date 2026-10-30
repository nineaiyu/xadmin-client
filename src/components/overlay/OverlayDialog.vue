<script lang="ts" setup>
import { useAttrs } from "vue";
import { useOverlayScrollLock } from "./useOverlayScrollLock";

/**
 * 声明式弹层壳（对话框）：常驻面板 / 组件内部交互使用 `v-model` 声明式写法，
 * 但底层与 addDialog 共用 overlay 内核——滚动锁、尺寸档位与 EP 属性透传同源。
 *
 * 何时用：弹层随组件生命周期存续、不适合命令式 `addDialog`（如设计器内部交互）。
 * 何时不用：由按钮触发的一次性表单/确认 → 直接走 `addDialog`。
 */
defineOptions({ name: "OverlayDialog", inheritAttrs: false });

const model = defineModel<boolean>({ default: false });
const attrs = useAttrs();

useOverlayScrollLock(() => Boolean(model.value));
</script>

<template>
  <el-dialog v-bind="attrs" v-model="model">
    <template v-if="$slots.header" #header="scope">
      <slot name="header" v-bind="scope" />
    </template>
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </el-dialog>
</template>
