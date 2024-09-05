<template>
  <json-editor
    ref="editor"
    v-model:json="value"
    :navigationBar="false"
    :onRenderMenu="handleRenderMenu"
    height="400"
    mode="text"
    style="width: 100%; text-align: left"
    :readOnly="attr?.disabled as any"
    :dark-theme="isDark"
    @change="handleChange"
  />
</template>

<script lang="ts" setup>
// https://github.com/bestkolobok/vue3-jsoneditor
import JsonEditor, { MenuItem, TextContent } from "vue3-ts-jsoneditor";
import { useAttrs } from "vue";
import { useDark } from "@pureadmin/utils";

defineOptions({ name: "JsonInput" });
const { isDark } = useDark();
const value = defineModel<any>({ default: {} });
const attr = useAttrs();
const emit = defineEmits<{
  (e: "change", values: any): void;
}>();

const handleChange = (content: TextContent) => {
  try {
    emit("change", JSON.parse(content.text));
  } catch (e) {
    emit("change", value);
  }
};

const handleRenderMenu = (items: MenuItem[]) => {
  items.splice(0, 4);
  items.splice(3, 2);
  items.splice(2, 1);
  return items;
};
</script>
