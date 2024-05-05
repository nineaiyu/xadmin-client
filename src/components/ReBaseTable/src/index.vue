<script lang="ts" setup>
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { PureTableBar } from "@/components/RePureTableBar";
import { FormProps } from "./utils/types";
import { ref } from "vue";
import { deviceDetection, getKeyList } from "@pureadmin/utils";
import { useBaseTable } from "./utils/hook";
import Delete from "@iconify-icons/ep/delete";
import EditPen from "@iconify-icons/ep/edit-pen";
import AddFill from "@iconify-icons/ri/add-circle-line";
import PureTable from "@pureadmin/table";

const props = withDefaults(defineProps<FormProps>(), {
  auth: () => ({
    list: false,
    create: false,
    delete: false,
    update: false,
    fields: false,
    batchDelete: false
  }),
  api: () => ({
    list: null,
    create: null,
    delete: null,
    update: null,
    fields: null,
    batchDelete: null
  }),
  editForm: () => ({
    form: null,
    row: {},
    props: {},
    options: {}
  }),
  customAddOrEdit: false,
  editProps: {},
  pagination: () => {
    return {
      total: 0,
      pageSize: 10,
      currentPage: 1,
      pageSizes: [5, 10, 20, 50, 100],
      background: true
    };
  },
  tableColumns: () => {
    return [];
  },
  resultFormat: null,
  localeName: ""
});
defineOptions({ name: "ReBaseTable" });
const emit = defineEmits<{
  (e: "plusChange", ...args: any[]): void;
  (e: "plusReset", ...args: any[]): void;
  (e: "plusSearch", ...args: any[]): void;
  (e: "pureRefresh", ...args: any[]): void;
  (e: "openDialog", ...args: any[]): void;
  (e: "searchEnd", ...args: any[]): void;
  (e: "selectionChange", ...args: any[]): void;
}>();

const plusPorChange = (column: any, func: Function, ...args) => {
  const canChangeType = ["select", "date-picker", "time-picker", "time-select"];
  canChangeType.indexOf(column.valueType) > -1 && func && func(...args);
  emit("plusChange");
};

const tableRef = ref();

const {
  t,
  route,
  loading,
  dataList,
  pagination,
  selectedNum,
  showColumns,
  defaultValue,
  searchFields,
  tableColumns,
  searchColumns,
  onChange,
  onSearch,
  openDialog,
  getSelectPks,
  handleDelete,
  handleManyDelete,
  handleSizeChange,
  onSelectionCancel,
  handleCurrentChange,
  handleSelectionChange
} = useBaseTable(
  emit,
  tableRef,
  props.api,
  props.editForm,
  props.tableColumns,
  props.pagination,
  props.resultFormat,
  props.localeName
);

function getTableRef() {
  return tableRef.value;
}

const editOrAdd = (isAdd = true, row = {}) => {
  if (props.customAddOrEdit) {
    emit("openDialog", isAdd, row);
  } else {
    openDialog(isAdd, row);
  }
};

defineExpose({
  onSearch,
  onChange,
  openDialog,
  getTableRef,
  getSelectPks,
  dataList,
  showColumns,
  searchFields
});
</script>

<template>
  <div v-if="auth.list" class="main">
    <div class="search-form bg-bg_color w-[99/100] pl-8 pr-8 pt-[12px]">
      <PlusSearch
        v-model="searchFields"
        :col-props="{
          xs: 24,
          sm: 12,
          md: 6,
          lg: 6,
          xl: 6
        }"
        :columns="searchColumns"
        :default-values="defaultValue"
        :row-props="{
          gutter: 24
        }"
        :search-loading="loading"
        :show-number="deviceDetection() ? 1 : 3"
        label-width="auto"
        @change="
          (values: any, column) => {
            plusPorChange(column, onSearch, true);
          }
        "
        @reset="
          () => {
            onSearch(true);
            emit('plusReset');
          }
        "
        @search="
          () => {
            onSearch(true);
            emit('plusSearch');
          }
        "
        @keyup.enter="
          () => {
            onSearch(true);
            emit('plusSearch');
          }
        "
      />
    </div>
    <PureTableBar :columns="tableColumns" @refresh="onSearch">
      <template #title>
        <el-space>
          <p class="font-bold truncate">
            {{ t(route.meta.title) }}
          </p>
          <div
            v-if="selectedNum > 0"
            v-motion-fade
            class="bg-[var(--el-fill-color-light)] w-full h-[46px] m-2 pl-4 flex items-center rounded-md"
          >
            <span
              class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
              style="font-size: var(--el-font-size-base)"
            >
              {{ t("buttons.selected", { count: selectedNum }) }}
            </span>
            <el-button text type="primary" @click="onSelectionCancel">
              {{ t("buttons.cancel") }}
            </el-button>
          </div>
        </el-space>
      </template>
      <template #buttons>
        <el-space wrap>
          <div v-if="selectedNum > 0" v-motion-fade>
            <el-popconfirm
              v-if="auth.batchDelete"
              :title="t('buttons.batchDeleteConfirm', { count: selectedNum })"
              @confirm="handleManyDelete"
            >
              <template #reference>
                <el-button :icon="useRenderIcon(Delete)" plain type="danger">
                  {{ t("buttons.batchDelete") }}
                </el-button>
              </template>
            </el-popconfirm>
          </div>
          <el-button
            v-if="auth.create"
            :icon="useRenderIcon(AddFill)"
            type="primary"
            @click="editOrAdd(true, {})"
          >
            {{ t("buttons.add") }}
          </el-button>
          <slot name="barButtons" />
        </el-space>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          ref="tableRef"
          :adaptiveConfig="{ offsetBottom: 108 }"
          :columns="dynamicColumns"
          :data="dataList"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          :loading="loading"
          :pagination="pagination"
          :paginationSmall="size === 'small'"
          :size="size"
          adaptive
          align-whole="center"
          default-expand-all
          row-key="pk"
          showOverflowTooltip
          table-layout="auto"
          @selection-change="handleSelectionChange"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #operation="{ row }">
            <el-button
              v-if="auth.update"
              :icon="useRenderIcon(EditPen)"
              :size="size"
              class="reset-margin"
              link
              type="primary"
              @click="editOrAdd(false, row)"
            >
              {{ t("buttons.edit") }}
            </el-button>
            <el-popconfirm
              v-if="auth.delete"
              :title="t('buttons.confirmDelete')"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  :icon="useRenderIcon(Delete)"
                  :size="size"
                  class="reset-margin"
                  link
                  type="danger"
                >
                  {{ t("buttons.delete") }}
                </el-button>
              </template>
            </el-popconfirm>
            <slot name="extOperation" v-bind="{ row, size }" />
          </template>
          <template
            v-for="item in getKeyList(tableColumns, 'slot').filter(x => {
              return x !== 'operation';
            })"
            :key="item"
            #[item]="{ row }"
          >
            <slot :key="item" :name="item" v-bind="{ row }" />
          </template>
        </pure-table>
      </template>
    </PureTableBar>
  </div>
</template>

<style lang="scss" scoped>
.main-content {
  margin: 24px 24px 0 !important;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
