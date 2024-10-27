<script lang="ts" setup>
import { ref, watch } from "vue";
import { usePlusSearch } from "./hooks";
import { ClickOutside as vClickOutside } from "element-plus";
import { RePlusPage } from "@/components/RePlusPage";
import type { PlusSearchProps } from "./types";
import { deviceDetection, isEmpty } from "@pureadmin/utils";

defineOptions({
  name: "RePlusSearch"
});

const props = withDefaults(defineProps<PlusSearchProps>(), {
  api: undefined,
  isTree: false,
  multiple: true,
  localeName: "",
  listColumnsFormat: undefined,
  searchColumnsFormat: undefined,
  baseColumnsFormat: undefined,
  pagination: () => ({}),
  valueProps: () => ({
    value: "pk",
    label: "name"
  })
});

const selectValue = defineModel<object | object[] | string>();

const emit = defineEmits<{
  (e: "change", ...args: any[]): void;
}>();

const selectRef = ref();
const tableRef = ref();
const {
  t,
  selectVisible,
  defaultPagination,
  onSure,
  onClear,
  rowStyle,
  removeTag,
  searchComplete,
  handleRowClick,
  handleClickOutSide,
  handleSelectionChange
} = usePlusSearch(selectRef, tableRef, selectValue, props);

watch(
  () => selectValue.value,
  () => {
    emit("change", selectValue.value);
  },
  {
    deep: true,
    immediate: true
  }
);
</script>

<template>
  <el-select
    ref="selectRef"
    v-model="selectValue"
    v-click-outside="handleClickOutSide"
    :max-collapse-tags="10"
    :value-key="props.valueProps.value"
    class="w-full"
    clearable
    collapse-tags
    collapse-tags-tooltip
    :multiple="multiple"
    @clear="onClear"
    @visibleChange="val => (selectVisible = val)"
    @visible-change="
      vs => {
        if (vs) {
          tableRef?.handleGetData();
        }
      }
    "
    @remove-tag="removeTag"
  >
    <template #label="{ value }">
      <el-tag type="primary">{{ value?.label }}</el-tag>
    </template>
    <template #empty>
      <div :class="['p-4', deviceDetection() ? 'w-[100vw]' : 'w-[1200px]']">
        <RePlusPage
          ref="tableRef"
          :api="api"
          :isTree="isTree"
          :auth="{ list: true }"
          :immediate="false"
          :operation="false"
          :pagination="defaultPagination"
          :pureTableProps="{
            adaptiveConfig: { offsetBottom: 550 },
            rowStyle: rowStyle
          }"
          :tableBar="false"
          :locale-name="localeName"
          :selection="multiple"
          :listColumnsFormat="listColumnsFormat"
          :baseColumnsFormat="baseColumnsFormat"
          :searchColumnsFormat="searchColumnsFormat"
          @searchComplete="searchComplete"
          @selectionChange="handleSelectionChange"
          @rowClick="handleRowClick"
        />
      </div>

      <div class="absolute bottom-[25px] left-[25px]">
        <el-space>
          <el-button bg size="small" text type="primary" @click="onSure">
            {{ t("labels.sure") }}
          </el-button>
        </el-space>
      </div>
    </template>
  </el-select>
</template>
<style lang="scss" scoped>
:deep(.pb-2) {
  padding-bottom: 0;
}

:deep(.m-4) {
  margin: 0;
}
</style>
