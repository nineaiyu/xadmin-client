import { useI18n } from "vue-i18n";
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormRules } from "element-plus";
import {
  type ButtonsCallBackParams,
  type PlusPageInstance,
  useTable
} from "plus-pro-components";
import { useBaseColumns } from "./columns";
import { useRoute } from "vue-router";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import EditPen from "@iconify-icons/ep/edit-pen";
import Delete from "@iconify-icons/ep/delete";
import View from "@iconify-icons/ep/view";
import { set } from "lodash-es";
import importDataForm from "../components/importData.vue";
import exportDataForm from "../components/exportData.vue";
import { resourcesIDCacheApi } from "@/api/common";
import { openDialog } from "./handle";
export function usePlusCRUDBase(api, auth) {
  const { t, te } = useI18n();
  const route = useRoute();

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
    showColumns,
    searchColumns,
    getColumnData,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue
  } = useBaseColumns();

  onMounted(() => {
    getColumnData(api, () => {
      nextTick(() => {
        plusPageInstance.value?.plusSearchInstance.handleReset();
      });
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
  const title = computed(() => {
    if (te(route.meta.title)) {
      return t(route.meta.title);
    }
    return route.meta.title;
  });
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
  const handleTableOption = ({
    row,
    buttonRow
  }: ButtonsCallBackParams): void => {
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

  // 数据导出
  function exportData() {
    openDialog({
      title: t("exportImport.export"),
      row: {
        type: "xlsx",
        range: state.selectedIds.length > 0 ? "selected" : "all",
        pks: state.selectedIds
      },
      dialogOptions: { width: "600px" },
      form: exportDataForm,
      saveCallback: ({ formData, done }) => {
        if (formData.range === "all") {
          api.export(formData);
        } else if (formData.range === "search") {
          // 暂时不支持查询导出
          // searchFields.value["type"] = curData["type"];
          // api.export(toRaw(searchFields.value));
        } else if (formData.range === "selected") {
          resourcesIDCacheApi(formData.pks).then(res => {
            formData["spm"] = res.spm;
            delete formData.pks;
            api.export(formData);
          });
        }
        done();
      }
    });
  }

  // 数据导入
  function importData() {
    openDialog({
      title: t("exportImport.import"),
      row: {
        action: "create",
        api: api
      },
      dialogOptions: { width: "600px" },
      form: importDataForm,
      saveCallback: ({ formData, success, failed }) => {
        api.import(formData.action, formData.upload[0].raw).then(res => {
          if (res.code === 1000) {
            refresh(); // 刷新表格数据
            success();
          } else {
            failed(res.detail);
          }
        });
      }
    });
  }

  return {
    t,
    api,
    auth,
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
  };
}
