<script lang="ts" setup>
import { computed, onMounted, watch } from "vue";

import {
  useApiOptions,
  type ApiOption,
  type ApiOptionsConfig,
  type ApiOptionValue
} from "@/components/ReApiSelect/src/useApiOptions";

defineOptions({ name: "ReApiTreeSelect", inheritAttrs: false });

/**
 * 远程取数的树形选择：与 `ReApiSelect` 共用取数 / 归一逻辑（`childrenField`
 * 指定子节点字段），树形节点映射为 `label` / `value` / `children`。
 * `el-tree-select` 的其余 props 经 `$attrs` 透传（`multiple` / `check-strictly` 等）。
 */
const props = withDefaults(
  defineProps<{
    api?: ApiOptionsConfig["api"];
    params?: Record<string, unknown>;
    labelField?: string;
    valueField?: string;
    childrenField?: string;
    resultField?: string;
    immediate?: boolean;
    alwaysLoad?: boolean;
    numberToString?: boolean;
    autoSelect?: boolean;
    beforeFetch?: ApiOptionsConfig["beforeFetch"];
    afterFetch?: ApiOptionsConfig["afterFetch"];
    /** 静态兜底树（无 api 或未取到远程数据时使用，需为已归一形态） */
    options?: ApiOption[];
  }>(),
  {
    labelField: "label",
    valueField: "value",
    childrenField: "",
    resultField: "",
    immediate: true,
    alwaysLoad: false,
    numberToString: false,
    autoSelect: false,
    params: () => ({}),
    options: () => []
  }
);

const modelValue = defineModel<ApiOptionValue>();
const emit = defineEmits<{ optionsChange: [ApiOption[]] }>();

const { options, loading, fetch, updateParam } = useApiOptions(() => ({
  api: props.api,
  params: props.params,
  labelField: props.labelField,
  valueField: props.valueField,
  childrenField: props.childrenField,
  resultField: props.resultField,
  alwaysLoad: props.alwaysLoad,
  numberToString: props.numberToString,
  beforeFetch: props.beforeFetch,
  afterFetch: props.afterFetch
}));

const finalOptions = computed(() =>
  options.value.length ? options.value : props.options
);

const treeProps = {
  value: "value",
  label: "label",
  children: "children",
  disabled: "disabled"
};

watch(finalOptions, list => {
  emit("optionsChange", list);
  if (
    props.autoSelect &&
    (modelValue.value === undefined || modelValue.value === null) &&
    list.length
  ) {
    modelValue.value = list[0].value;
  }
});

function onVisibleChange(visible: boolean) {
  if (visible) fetch();
}

onMounted(() => {
  if (props.immediate) fetch();
});

defineExpose({
  getOptions: () => finalOptions.value,
  getValue: () => modelValue.value,
  reload: () => fetch(true),
  updateParam
});
</script>

<template>
  <el-tree-select
    v-model="modelValue"
    v-bind="$attrs"
    :data="finalOptions"
    :loading="loading"
    :props="treeProps"
    node-key="value"
    @visible-change="onVisibleChange"
  />
</template>
