<script lang="ts" setup>
import { computed, onMounted, watch } from "vue";

import {
  useApiOptions,
  type ApiOption,
  type ApiOptionsConfig,
  type ApiOptionValue
} from "./useApiOptions";

defineOptions({ name: "ReApiSelect", inheritAttrs: false });

/**
 * 远程取数的下拉选择：`api` 拉取选项、按 `labelField`/`valueField` 归一后
 * 交给 `el-select` 渲染。首次取数后缓存；`el-select` 的其余 props / 事件经
 * `$attrs` 透传（`clearable` / `filterable` / `multiple` / `placeholder` 等）。
 */
const props = withDefaults(
  defineProps<{
    /** 取数函数（返回数组或 `{ data }` / 由 resultField 指定路径） */
    api?: ApiOptionsConfig["api"];
    /** 基础查询参数 */
    params?: Record<string, unknown>;
    labelField?: string;
    valueField?: string;
    childrenField?: string;
    resultField?: string;
    /** 挂载即取数（默认 true） */
    immediate?: boolean;
    /** 每次打开都重新取数 */
    alwaysLoad?: boolean;
    numberToString?: boolean;
    /** 未选中且有选项时自动选中第一项 */
    autoSelect?: boolean;
    beforeFetch?: ApiOptionsConfig["beforeFetch"];
    afterFetch?: ApiOptionsConfig["afterFetch"];
    /** 静态兜底选项（无 api 或未取到远程数据时使用，需为已归一形态） */
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
  <el-select
    v-model="modelValue"
    v-bind="$attrs"
    :loading="loading"
    @visible-change="onVisibleChange"
  >
    <el-option
      v-for="item in finalOptions"
      :key="String(item.value)"
      :label="item.label"
      :value="item.value"
      :disabled="item.disabled"
    />
  </el-select>
</template>
