<script lang="ts" setup>
import {
  computed,
  reactive,
  toRefs,
  ref,
  onMounted,
  watch,
  nextTick,
  unref,
  getCurrentInstance,
  onBeforeUnmount
} from "vue";
import type { FormRules } from "element-plus";
import { set } from "lodash-es";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  ButtonsCallBackParams,
  PlusPageInstance,
  PlusPage,
  PlusDialogForm,
  PlusDialog,
  PlusDescriptions
} from "plus-pro-components";
import { useTable } from "plus-pro-components";
import { useBaseColumns } from "@/components/RePlusProCRUD/src/utils/columns";
import { bookApi } from "@/views/demo/book/utils/api";
import { hasGlobalAuth } from "@/router/utils";
import { debounce, deviceDetection } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import EditPen from "@iconify-icons/ep/edit-pen";
import Delete from "@iconify-icons/ep/delete";
import View from "@iconify-icons/ep/view";
import AddFill from "@iconify-icons/ri/add-circle-line";

interface State {
  /**
   * 检索数据
   */
  query?: any;
  /**
   * 当前选择的行数据
   */
  currentRow: object;
  /**
   * 表单弹窗是否可见
   */
  visible: boolean;
  /**
   * 详情弹窗是否可见
   */
  detailsVisible: boolean;
  /**
   * 当前选择多行的id集合
   */
  selectedIds: number[];
  /**
   *  提交loading
   */
  confirmLoading: boolean;
  /**
   * 是否是创建
   */
  isCreate: boolean;
  /**
   * 是否批量
   */
  isBatch: boolean;
  /**
   * 表单
   */
  form: {};
  /**
   * 校验
   */
  rules: FormRules;
}
const plusPageInstance = ref<PlusPageInstance | null>(null);

const {
  listColumns,
  searchColumns,
  getColumnData,
  addOrEditRules,
  addOrEditColumns,
  searchDefaultValue,
  addOrEditDefaultValue
} = useBaseColumns();

const api = reactive(bookApi);
const { t, te } = useI18n();
const route = useRoute();

// 权限判断，用于判断是否有该权限
const auth = reactive({
  list: hasGlobalAuth("list:demoBook"),
  create: hasGlobalAuth("create:demoBook"),
  delete: hasGlobalAuth("delete:demoBook"),
  update: hasGlobalAuth("update:demoBook"),
  export: hasGlobalAuth("export:demoBook"),
  import: hasGlobalAuth("import:demoBook"),
  batchDelete: hasGlobalAuth("batchDelete:demoBook")
});

onMounted(() => {
  getColumnData(api, () => {
    plusPageInstance.value.plusSearchInstance.handleReset();
  });
});

const state = reactive<State>({
  query: searchDefaultValue.value,
  currentRow: {},
  visible: false,
  detailsVisible: false,
  confirmLoading: false,
  isCreate: true,
  isBatch: false,
  selectedIds: [],
  form: {},
  rules: addOrEditRules.value
});

const dialogTitle = computed(() => (state.isCreate ? "新增" : "编辑"));
const { buttons } = useTable();

const columns = computed(() => {
  return [...listColumns.value, ...searchColumns.value];
});

// 按钮
buttons.value = [
  {
    text: "编辑",
    code: "update",
    props: {
      type: "primary",
      icon: useRenderIcon(EditPen),
      link: true,
      size: "large"
    },
    show: auth?.update
  },
  {
    text: "删除",
    code: "delete",
    confirm: true,
    props: {
      type: "danger",
      icon: useRenderIcon(Delete),
      link: true,
      size: "large"
    },
    show: auth?.delete
  },
  {
    text: "",
    code: "view",
    props: {
      type: "info",
      icon: useRenderIcon(View),
      link: true,
      size: "large"
    },
    show: auth?.list
  }
];

/**
 * API
 */
const GroupServe = {
  async getList(query: Record<string, any>) {
    const { data } = await api.list(query);
    tableData.value = data.results;
    return { data: tableData.value, total: data.total };
  },
  async create(data: Record<string, any>) {
    return api.create(data);
  },
  async update(data: Record<string, any>) {
    return api.update(data.pk, data);
  },
  async delete(pk: string | number) {
    api.delete(pk).then(() => {
      ElMessage.success("删除成功");
      refresh();
    });
  },
  async batchDelete(pks: Array<Number | String>) {
    api.batchDelete(pks).then(() => {
      ElMessage.success("删除成功");
      refresh();
    });
  }
};

// 按钮操作
const handleTableOption = ({ row, buttonRow }: ButtonsCallBackParams): void => {
  state.currentRow = { ...row };
  switch (buttonRow.code) {
    case "update":
      state.form = { ...row } as any;
      state.isCreate = false;
      state.visible = true;
      break;
    case "delete":
      state.isBatch = false;
      GroupServe.delete(row.pk);
      break;
    case "view":
      state.detailsVisible = true;
      break;
  }
};

// 重新请求列表接口
const refresh = () => {
  plusPageInstance.value?.getList();
};

// 批量删除
const handleBatchDelete = async () => {
  if (!state.selectedIds.length) {
    ElMessage.warning("请选择数据！");
    return;
  }
  try {
    await ElMessageBox.confirm("确定删除所选数据", "提示");
    state.isBatch = true;
    await GroupServe.batchDelete(state.selectedIds);
  } catch (error) {
    console.log(error);
  }
};

// 选择
const handleSelect = (data: any) => {
  state.selectedIds = [...data].map(item => item.pk ?? item.id);
};

// 创建
const handleCreate = (): void => {
  state.currentRow = {};
  state.form = addOrEditDefaultValue.value;
  state.isCreate = true;
  state.visible = true;
};

// 取消
const handleCancel = () => {
  state.visible = false;
};

const getFormatLabel = label => {
  if (te(label)) {
    return t(label);
  }
  return label;
};

// 提交表单成功
const handleSubmit = async () => {
  try {
    state.confirmLoading = true;
    const params = { ...state.form };
    if (state.isCreate) {
      await GroupServe.create(params).then(res => {
        if (res.code === 1000) {
          ElMessage.success("创建成功");
          // 应该设置page=1，刷新页面到第一页
          refresh();
          handleCancel();
        } else {
          ElMessage.error("创建失败");
        }
      });
    } else {
      await GroupServe.update(params).then(res => {
        if (res.code === 1000) {
          ElMessage.success("更新成功");
          refresh();
          handleCancel();
        } else {
          ElMessage.error("更新失败");
        }
      });
    }
  } catch (error) {}
  state.confirmLoading = false;
};
const { tableData } = useTable();
const handleChange = ({ index, value, prop, row }) => {
  api.update(row.pk, { [prop]: value }).then(res => {
    if (res.code === 1000) {
      ElMessage.success("更新成功");
      set(tableData.value[index], prop, value);
    } else {
      ElMessage.error("更新失败");
    }
  });
};

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
  offsetBottom: 115,
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
        :page-info-map="{ page: 'page', pageSize: 'size' }"
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
            {{ getFormatLabel(route.meta.title) }}
          </p>
        </template>
        <template #table-toolbar>
          <el-button
            type="primary"
            :icon="useRenderIcon(AddFill)"
            @click="handleCreate"
          >
            新增
          </el-button>
          <el-button
            :icon="useRenderIcon(Delete)"
            type="danger"
            plain
            @click="handleBatchDelete"
          >
            批量删除
          </el-button>
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
        title: dialogTitle + '用户组',
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
      title="用户组详情"
      top="26vh"
      :has-footer="false"
      :draggable="true"
    >
      <PlusDescriptions :column="2" :columns="listColumns" :data="currentRow" />
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
