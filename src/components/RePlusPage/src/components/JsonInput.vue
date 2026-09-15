<template>
  <json-editor
    ref="editor"
    v-model:json="value"
    :navigationBar="false"
    :onRenderMenu="handleRenderMenu"
    :fullWidthButton="false"
    height="400"
    mode="text"
    style="width: 100%; text-align: left"
    :readOnly="attr?.disabled as boolean"
    :dark-theme="isDark"
    @change="handleChange"
  />
</template>

<script lang="ts" setup>
// https://github.com/bestkolobok/vue3-jsoneditor
import JsonEditor, { MenuItem } from "vue3-ts-jsoneditor";
import { useAttrs } from "vue";
import { useDark } from "@pureadmin/utils";

defineOptions({ name: "JsonInput" });
const { isDark } = useDark();
const value = defineModel<string | Record<string, unknown>>({
  default: () => ({})
});
const attr = useAttrs();
const emit = defineEmits<{
  change: [values: unknown];
}>();

// vue-json-pretty 的 change 事件透传多参（首个参数为 Content）
const handleChange = (...args: unknown[]) => {
  const content = args[0] as { text: string };
  try {
    emit("change", JSON.parse(content.text));
  } catch {
    emit("change", value.value);
  }
};

const handleRenderMenu = (items: MenuItem[]) => {
  items.splice(0, 4);
  items.splice(3, 2);
  items.splice(2, 1);
  return items;
};
</script>
