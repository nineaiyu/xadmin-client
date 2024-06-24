<script lang="ts" setup>
import { computed, reactive, toRefs, ref, onMounted } from "vue";
import type { FormRules } from "element-plus";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Delete } from "@element-plus/icons-vue";
import {
  ButtonsCallBackParams,
  PlusPageInstance,
  PlusPage,
  PlusDialogForm,
  PlusDialog,
  PlusDescriptions
} from "plus-pro-components";
import { useTable } from "plus-pro-components";
import { useDemoBook } from "@/views/demo/book/utils/hook";

interface TableRow {
  id: number;
  groupName: string | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
  code: string | null;
}

interface State {
  /**
   * 检索数据
   */
  query?: any;
  /**
   * 当前选择的行数据
   */
  currentRow: Partial<TableRow>;
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
  form: {
    groupName: string;
    remark: string;
    userGroupId?: number;
  };
  /**
   * 校验
   */
  rules: FormRules;
}

const {
  t,
  api,
  auth,
  listColumns,
  addOrEditRules,
  addOrEditColumns,
  addOrEditDefaultValue,
  searchColumns
} = useDemoBook();

/**
 * API
 */
const GroupServe = {
  async getList(query: Record<string, any>) {
    const { data } = await api.list(query);
    const { page = 1, pageSize = 10 } = query;
    const list = (data.results as TableRow[]).filter(
      (_, index) => index < pageSize * page && index >= pageSize * (page - 1)
    );
    return { data: list, total: data.total };
  },
  async create(data: Record<string, any>) {
    api.create(data).then(() => {
      refresh();
    });
    return data;
  },
  async update(data: Record<string, any>) {
    api.update(data.pk, data).then(() => {
      refresh();
    });
    return data;
  },
  async delete(ids: number[]) {
    return ids;
  }
};

const plusPageInstance = ref<PlusPageInstance | null>(null);
const state = reactive<State>({
  query: { groupName: "" },
  currentRow: {},
  visible: false,
  detailsVisible: false,
  confirmLoading: false,
  isCreate: true,
  isBatch: false,
  selectedIds: [],
  form: {
    groupName: "",
    remark: "",
    userGroupId: undefined
  },
  rules: {
    groupName: [
      {
        required: true,
        message: "请输入",
        trigger: "blur"
      }
    ]
  }
});

const dialogTitle = computed(() => (state.isCreate ? "新增" : "编辑"));
const { buttons } = useTable();

const columns = computed(() => {
  return listColumns.value;
});

// 按钮
buttons.value = [
  {
    text: "编辑",
    code: "update",
    props: { type: "success" }
  },
  {
    text: "删除",
    code: "delete",
    confirm: true,
    props: { type: "warning" }
  },
  {
    text: "查看",
    code: "view",
    props: { type: "info" }
  }
];

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
      api.delete(row.pk);
      refresh();
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

// 删除
const handleDelete = async (): Promise<void> => {
  try {
    const params = state.isBatch
      ? state.selectedIds
      : [state.currentRow.id as number];
    await GroupServe.delete(params);
    ElMessage.success("删除成功");
    refresh();
  } catch (error) {}
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
    handleDelete();
  } catch (error) {
    console.log(error);
  }
};

// 选择
const handleSelect = (data: any) => {
  state.selectedIds = [...data].map(item => item.id);
};

// 创建
const handleCreate = (): void => {
  state.currentRow = {};
  state.form = {
    groupName: "",
    remark: "",
    userGroupId: undefined
  };
  state.isCreate = true;
  state.visible = true;
};

// 取消
const handleCancel = () => {
  state.visible = false;
};

// 提交表单成功
const handleSubmit = async () => {
  try {
    state.confirmLoading = true;
    const params = { ...state.form, remark: state.form.remark || "" };
    if (state.isCreate) {
      await GroupServe.create(params);
      ElMessage.success("创建成功");
    } else {
      await GroupServe.update(params);
      ElMessage.success("更新成功");
    }
    handleCancel();
    refresh();
  } catch (error) {}
  state.confirmLoading = false;
};

const { form, confirmLoading, rules, currentRow, visible, detailsVisible } =
  toRefs(state);
</script>

<template>
  <div class="main">
    <div class="w-full">
      <PlusPage
        ref="plusPageInstance"
        :request="GroupServe.getList"
        :columns="columns"
        :params="state.query"
        :search="{ labelWidth: '100px', colProps: { span: 8 } }"
        :table="{
          isSelection: true,
          actionBar: { buttons, width: 200 },
          onClickAction: handleTableOption,
          onSelectionChange: handleSelect
        }"
      >
        <template #table-toolbar>
          <el-button type="primary" :icon="Plus" @click="handleCreate">
            添加
          </el-button>
          <el-button
            :icon="Delete"
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
        rules: addOrEditRules,
        labelWidth: 120
      }"
      :dialog="{
        title: dialogTitle + '用户组',
        width: '540px',
        top: '12vh',
        destroyOnClose: true,
        confirmLoading
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
    >
      <PlusDescriptions :column="2" :columns="columns" :data="currentRow" />
    </PlusDialog>
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
