<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import { useColumns } from "./hooks";
import { FormItemProps } from "./types";
import { ClickOutside as vClickOutside } from "element-plus";

defineOptions({
  name: "ReTableSearch"
});

const props = withDefaults(defineProps<FormItemProps>(), {
  showColumns: () => [],
  sortOptions: () => [],
  searchKeys: () => [],
  isTree: () => false,
  getListApi: Function,
  valueProps: () => ({
    value: "pk",
    label: "name"
  })
});

const selectValue = defineModel({ type: Array<object> });
const emit = defineEmits<{
  (e: "change", ...args: any[]): void;
}>();
const columns = ref([
  {
    type: "selection",
    align: "left"
  }
]);

const selectRef = ref();
const tableRef = ref();
const {
  t,
  form,
  loading,
  dataList,
  pagination,
  sortOptions,
  treeDataList,
  selectVisible,
  onClear,
  onSure,
  onSearch,
  removeTag,
  handleSizeChange,
  handleClickOutSide,
  handleCurrentChange,
  handleSelectionChange
} = useColumns(
  selectRef,
  tableRef,
  props.getListApi,
  props.isTree,
  props.valueProps,
  selectValue
);

onMounted(() => {
  props.searchKeys.forEach((item: any) => {
    form[item.key] = item.value ?? "";
  });
  props.sortOptions.forEach((item: any) => {
    sortOptions.value.push(item);
  });
  props.showColumns.forEach(item => {
    columns.value.push(item);
  });
  // onSearch();
});

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
    class="w-full"
    clearable
    collapse-tags
    collapse-tags-tooltip
    multiple
    :value-key="props.valueProps.value"
    @visible-change="
      vs => {
        if (vs) onSearch();
      }
    "
    @clear="onClear"
    @visibleChange="val => (selectVisible = val)"
    @remove-tag="removeTag"
  >
    <template #label="{ value }">
      <el-tag type="primary">{{ value[props.valueProps.label] }}</el-tag>
    </template>
    <template #empty>
      <div class="max-w-[1000px] m-4 min-w-[800px]">
        <el-form
          ref="formRef"
          :inline="true"
          :model="form"
          class="search-form bg-bg_color pl-8 pt-[12px] overflow-auto"
        >
          <el-form-item
            v-for="item in searchKeys.filter(x => {
              return !x.value;
            })"
            :key="item.key"
            :label="item.label"
            prop="pk"
          >
            <el-input
              v-model="form[item.key]"
              :placeholder="item.label"
              class="!w-[160px]"
              clearable
              @keyup.enter="onSearch(true)"
            />
          </el-form-item>
          <el-form-item v-if="sortOptions.length" :label="t('labels.sort')">
            <el-select
              v-model="form.ordering"
              class="!w-[180px]"
              clearable
              @change="onSearch(true)"
            >
              <el-option
                v-for="item in sortOptions"
                :key="item.key"
                :label="item.label"
                :value="item.key"
              />
            </el-select>
          </el-form-item>
        </el-form>
        <pure-table
          ref="tableRef"
          :columns="columns"
          :data="props.isTree ? treeDataList : dataList"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          :loading="loading"
          :pagination="pagination"
          align-whole="center"
          border
          default-expand-all
          height="400"
          row-key="pk"
          showOverflowTooltip
          table-layout="auto"
          @selection-change="handleSelectionChange"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        />
        <div class="absolute bottom-[17px]">
          <el-space>
            <el-button bg size="small" text type="primary" @click="onSure">
              {{ t("labels.sure") }}
            </el-button>
            <el-button
              bg
              size="small"
              text
              type="success"
              @click="onSearch(true)"
            >
              {{ t("buttons.reload") }}
            </el-button>
          </el-space>
        </div>
      </div>
    </template>
  </el-select>
</template>
