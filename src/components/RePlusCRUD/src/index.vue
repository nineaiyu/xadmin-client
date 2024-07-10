<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref, toRefs, unref } from "vue";
import {
  PlusDescriptions,
  PlusDialog,
  PlusDialogForm,
  PlusPage
} from "plus-pro-components";
import { debounce, deviceDetection } from "@pureadmin/utils";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Delete from "@iconify-icons/ep/delete";
import AddFill from "@iconify-icons/ri/add-circle-line";
import { usePlusCRUDBase } from "./utils/hook";
import { FormProps } from "./utils/types";
import Download from "@iconify-icons/ep/download";
import Upload from "@iconify-icons/ep/upload";

defineOptions({ name: "RePlusCRUD" });

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
  })
});

const {
  t,
  state,
  title,
  columns,
  buttons,
  GroupServe,
  showColumns,
  dialogTitle,
  addOrEditRules,
  addOrEditColumns,
  plusPageInstance,
  searchDefaultValue,
  importData,
  exportData,
  handleChange,
  handleSubmit,
  handleCreate,
  handleSelect,
  handleCancel,
  handleBatchDelete,
  handleTableOption
} = usePlusCRUDBase(props.api, props.auth);

const { form, confirmLoading, rules, currentRow, visible, detailsVisible } =
  toRefs(state);

export type AdaptiveConfig = {
  /** 表格距离页面底部的偏移量，默认值为 `96` */
  offsetBottom?: number;
  /** 是否固定表头，默认值为 `true` */
  fixHeader?: boolean;
  /** 页面 `resize` 时的防抖时间，默认值为 `60` ms */
  timeout?: number;
  /** 表头的 `z-index`，默认值为  `3` */
  zIndex?: number;
};
const adaptiveConfig = ref<AdaptiveConfig>({
  offsetBottom: 120,
  fixHeader: true,
  timeout: 60,
  zIndex: 3
});

const getTableRef = () =>
  plusPageInstance.value?.plusTableInstance?.tableInstance;

const getTableDoms = () => (getTableRef() as any).$refs;

const setAdaptive = async () => {
  await nextTick();
  const tableWrapper = getTableDoms().tableWrapper;
  const offsetBottom = unref(adaptiveConfig).offsetBottom ?? 96;
  tableWrapper.style.height = `${
    window.innerHeight - tableWrapper.getBoundingClientRect().top - offsetBottom
  }px`;
};

const debounceSetAdaptive = debounce(
  setAdaptive,
  unref(adaptiveConfig).timeout ?? 60
);

const setHeaderSticky = async (zIndex = 3) => {
  await nextTick();
  const headerStyle = getTableDoms().tableHeaderRef.$el.style;
  headerStyle.position = "sticky";
  headerStyle.top = 0;
  headerStyle.zIndex = zIndex;
};

onMounted(() => {
  setAdaptive();
  window.addEventListener("resize", debounceSetAdaptive);
  const hasFixHeader = Reflect.has(unref(adaptiveConfig), "fixHeader");
  if (hasFixHeader && !unref(adaptiveConfig).fixHeader) {
    return;
  } else {
    setHeaderSticky(unref(adaptiveConfig).zIndex ?? 3);
  }
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", debounceSetAdaptive);
});
</script>
<template>
  <div class="main">
    <div class="w-full">
      <PlusPage
        ref="plusPageInstance"
        :request="GroupServe.getList"
        :columns="columns"
        :default-page-size-list="[10, 20, 50, 100]"
        :default-page-info="{ page: 1, pageSize: 20 }"
        :page-info-map="{ page: 'page', pageSize: 'size' }"
        :pagination="{ background: true } as any"
        :immediate="false"
        :search-card-props="{ shadow: 'never' }"
        :table-card-props="{ shadow: 'never' }"
        :search="{
          rules: addOrEditRules,
          labelWidth: 'auto',
          colProps: { xs: 24, sm: 12, md: 6, lg: 6, xl: 6 },
          showNumber: deviceDetection() ? 1 : 3,
          defaultValues: searchDefaultValue,
          onChange: (_, column) => {
            const canChangeType = [
              'select',
              'date-picker',
              'time-picker',
              'time-select'
            ];
            canChangeType.indexOf(column.valueType) > -1 &&
              plusPageInstance.getList();
          }
        }"
        :table="{
          isSelection: true,
          headerCellStyle: {
            'text-align': 'center',
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          },
          cellStyle: { 'text-align': 'center' },
          actionBar: {
            type: 'button',
            buttons,
            fixed: 'right',
            actionBarTableColumnProps: { align: 'center' }
          },
          rowKey: 'pk',
          border: false,
          showOverflowTooltip: true,
          tableLayout: 'auto',
          defaultExpandAll: true,
          onClickAction: handleTableOption,
          onSelectionChange: handleSelect,
          onFormChange: handleChange
        }"
      >
        <template #table-title>
          <p class="font-bold truncate">
            {{ title }}
          </p>
        </template>
        <template #table-toolbar>
          <el-button
            v-if="auth.create"
            type="primary"
            :icon="useRenderIcon(AddFill)"
            @click="handleCreate"
          >
            {{ t("buttons.add") }}
          </el-button>
          <el-button
            v-if="auth.batchDelete"
            :icon="useRenderIcon(Delete)"
            type="danger"
            plain
            @click="handleBatchDelete"
          >
            {{ t("buttons.batchDelete") }}
          </el-button>
          <el-tooltip
            v-if="auth.export"
            :content="t('exportImport.export')"
            effect="dark"
            placement="top-start"
          >
            <el-button
              :icon="useRenderIcon(Download)"
              plain
              type="primary"
              @click="exportData"
            />
          </el-tooltip>
          <el-tooltip
            v-if="auth.import"
            :content="t('exportImport.import')"
            effect="dark"
            placement="top-start"
          >
            <el-button
              :icon="useRenderIcon(Upload)"
              plain
              type="primary"
              @click="importData"
            />
          </el-tooltip>
        </template>
      </PlusPage>
    </div>

    <!-- 弹窗编辑 -->
    <PlusDialogForm
      v-model:visible="visible"
      v-model="form"
      :form="{
        columns: addOrEditColumns,
        labelPosition: 'right',
        rules: rules,
        labelWidth: 120
      }"
      :dialog="{
        title: dialogTitle + title,
        width: '540px',
        top: '12vh',
        destroyOnClose: true,
        confirmLoading,
        draggable: true
      }"
      @confirm="handleSubmit"
      @cancel="handleCancel"
    />

    <!-- 查看弹窗 -->
    <PlusDialog
      v-model="detailsVisible"
      width="600px"
      :title="title"
      top="26vh"
      :has-footer="false"
      :draggable="true"
    >
      <PlusDescriptions :column="2" :columns="showColumns" :data="currentRow" />
    </PlusDialog>
  </div>
</template>

<style lang="scss" scoped>
.main-content {
  margin: 24px 24px 0 !important;
}

:deep(.plus-page__table_wrapper) {
  margin-top: 0.2rem !important;
}
</style>
