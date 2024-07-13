<script lang="ts" setup>
import { ref } from "vue";
import PureTable from "@pureadmin/table";
import { useBaseTable } from "./utils/hook";
import { RePlusPageProps } from "./utils/types";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { cloneDeep, deviceDetection, getKeyList } from "@pureadmin/utils";
import Delete from "@iconify-icons/ep/delete";
import { PlusSearch } from "plus-pro-components";
import ButtonOperation, {
  ButtonsCallBackParams
} from "./components/buttonOperation";

const props = withDefaults(defineProps<RePlusPageProps>(), {
  api: undefined,
  localeName: "",
  selection: true,
  operation: true,
  searchResultFormat: undefined,
  listColumnsFormat: undefined,
  showColumnsFormat: undefined,
  searchColumnsFormat: undefined,
  beforeSearchSubmit: undefined,
  auth: () => ({
    list: false,
    batchDelete: false,
    create: false,
    delete: false,
    update: false,
    patch: false,
    export: false,
    import: false
  }),
  addOrEditOptions: () => ({}),
  pagination: () => ({}),
  pureTableProps: () => ({}),
  plusSearchProps: () => ({}),
  operationButtonsProps: () => ({}),
  tableBarButtonsProps: () => ({})
});
defineOptions({ name: "RePlusCRUD" });
const emit = defineEmits<{
  (e: "searchComplete", ...args: any[]): void;
  (e: "selectionChange", ...args: any[]): void;
  (e: "tableBarClickAction", data: ButtonsCallBackParams): void;
  (e: "operationClickAction", data: ButtonsCallBackParams): void;
}>();

const tableRef = ref();

const {
  t,
  loading,
  dataList,
  pageTitle,
  listColumns,
  selectedNum,
  defaultValue,
  searchFields,
  searchColumns,
  tablePagination,
  tableBarButtons,
  operationButtons,
  handleReset,
  handleSearch,
  getSelectPks,
  handleGetData,
  handleManyDelete,
  handleSizeChange,
  onSelectionCancel,
  handleCurrentChange,
  handleSelectionChange
} = useBaseTable(emit, tableRef, props);

function getTableRef() {
  return tableRef.value;
}

defineExpose({
  dataList,
  searchFields,
  handleGetData,
  getTableRef,
  getSelectPks
});
</script>

<template>
  <div v-if="auth?.list" class="main">
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
        :default-values="cloneDeep(defaultValue)"
        :row-props="{
          gutter: 24
        }"
        :search-loading="loading"
        :show-number="deviceDetection() ? 1 : 3"
        label-width="auto"
        v-bind="plusSearchProps"
        @change="
          (_, column) => {
            const canChangeType = [
              'select',
              'date-picker',
              'time-picker',
              'time-select'
            ];
            canChangeType.indexOf(column.valueType) > -1 && handleSearch();
          }
        "
        @reset="handleReset"
        @search="handleSearch"
        @keyup.enter="handleSearch"
      />
    </div>
    <PureTableBar :columns="listColumns" @refresh="handleGetData">
      <template #title>
        <el-space>
          <p class="font-bold truncate">
            {{ pageTitle }}
          </p>
          <div
            v-if="selectedNum > 0"
            v-motion-fade
            class="bg-[var(--el-fill-color-light)] w-[160px] h-[46px] m-2 pl-4 flex items-center rounded-md"
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
        <el-space>
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
          <button-operation
            :show-number="99"
            v-bind="tableBarButtonsProps"
            :buttons="tableBarButtons"
            @clickAction="
              data => {
                emit('tableBarClickAction', data);
              }
            "
          />
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
          :pagination="tablePagination"
          :paginationSmall="size === 'small'"
          :size="size"
          adaptive
          align-whole="center"
          default-expand-all
          row-key="pk"
          showOverflowTooltip
          table-layout="auto"
          v-bind="pureTableProps"
          @selection-change="handleSelectionChange"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #operation="{ row }">
            <button-operation
              :row="row"
              :size="size"
              v-bind="operationButtonsProps"
              :buttons="operationButtons"
              @clickAction="
                data => {
                  emit('operationClickAction', data);
                }
              "
            />
            <slot name="extOperation" v-bind="{ row, size }" />
          </template>
          <template
            v-for="item in getKeyList(listColumns, 'slot').filter(x => {
              return x !== 'operation';
            })"
            :key="item"
            #[item]="{ row, size }"
          >
            <slot :key="item" :name="item" v-bind="{ row, size }" />
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
