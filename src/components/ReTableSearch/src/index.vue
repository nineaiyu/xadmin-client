<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useColumns } from "./hooks";
import { FormItemProps } from "./types";
import { ClickOutside as vClickOutside } from "element-plus";

const props = withDefaults(defineProps<FormItemProps>(), {
  showColumns: () => [],
  sortOptions: () => [],
  searchKeys: () => [],
  isTree: () => false,
  getListApi: Function
});

const selectValue = defineModel({ type: Array<number> });

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
  selectValue
);

onMounted(() => {
  Object.keys(props.searchKeys).forEach((item: any) => {
    form[item.key] = "";
  });
  props.sortOptions.forEach((item: any) => {
    sortOptions.value.push(item);
  });
  props.showColumns.forEach(item => {
    columns.value.push(item);
  });
});
</script>

<template>
  <el-select
    ref="selectRef"
    v-model="selectValue"
    v-click-outside="handleClickOutSide"
    class="w-full"
    value-key="pk"
    clearable
    multiple
    collapse-tags
    :max-collapse-tags="10"
    collapse-tags-tooltip
    @visibleChange="val => (selectVisible = val)"
    @remove-tag="removeTag"
    @clear="onClear"
  >
    <template #empty>
      <div class="w-max[800px] m-4">
        <el-form
          ref="formRef"
          :inline="true"
          :model="form"
          class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
        >
          <el-form-item
            v-for="item in props.searchKeys"
            :key="item.key"
            :label="item.label"
            prop="pk"
          >
            <el-input
              v-model="form[item.key]"
              :placeholder="item.label"
              clearable
              class="!w-[160px]"
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
          border
          height="400"
          align-whole="center"
          table-layout="auto"
          showOverflowTooltip
          default-expand-all
          row-key="pk"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          :data="props.isTree ? treeDataList : dataList"
          :loading="loading"
          :columns="columns"
          :pagination="pagination"
          @selection-change="handleSelectionChange"
          @page-size-change="!props.isTree ? handleSizeChange : null"
          @page-current-change="!props.isTree ? handleCurrentChange : null"
        />
        <div class="absolute bottom-[17px]">
          <el-space>
            <el-button type="primary" size="small" text bg @click="onSure">
              {{ t("labels.sure") }}
            </el-button>
            <el-button
              type="success"
              size="small"
              text
              bg
              @click="onSearch(true)"
            >
              {{ t("buttons.hsreload") }}
            </el-button>
          </el-space>
        </div>
      </div>
    </template>
  </el-select>
</template>
