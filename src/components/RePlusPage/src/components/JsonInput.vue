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
// modelValue 必须用 unknown（不能收窄成 string | Record）：JSON 字段值域是任意
// JSON 值（number/boolean/array/...，如系统配置里值为 200 的项），defineModel 的
// 泛型会被 Vue 编译成运行时 prop 校验，收窄类型会让合法值挂「type check failed」
// 开发态警告。编辑器以 text 模式渲染，值回传由 handleChange JSON.parse 还原形态
const value = defineModel<unknown>({
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
