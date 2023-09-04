import dayjs from "dayjs";
import { message } from "@/utils/message";
import { getRoleListApi } from "@/api/system/role";
import { ElMessageBox } from "element-plus";
import { usePublicHooks } from "../../hooks";
import { addDialog } from "@/components/ReDialog";
import { type FormItemProps } from "./types";
import editForm from "../form.vue";
import { type PaginationProps } from "@pureadmin/table";
import { reactive, ref, onMounted, h, toRaw, type Ref } from "vue";
import {
  createRoleApi,
  deleteRoleApi,
  manyDeleteRoleApi,
  updateRoleApi
} from "@/api/system/role";
import { getMenuListApi } from "@/api/system/menu";
import { handleTree } from "@/utils/tree";
import { getKeyList } from "@pureadmin/utils";

const sortOptions = [
  { label: "添加时间 Descending", key: "-created_time" },
  { label: "添加时间 Ascending", key: "created_time" }
];
export function useRole(tableRef: Ref) {
  const form = reactive({
    name: "",
    code: "",
    is_active: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const menuTreeData = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
  const columns: TableColumnList = [
    {
      type: "selection",
      align: "left"
    },
    {
      label: "角色ID",
      prop: "pk",
      minWidth: 100
    },
    {
      label: "角色名称",
      prop: "name",
      minWidth: 120
    },
    {
      label: "角色标识",
      prop: "code",
      minWidth: 150
    },
    {
      label: "状态",
      minWidth: 130,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.is_active}
          active-value={true}
          inactive-value={false}
          active-text="已启用"
          inactive-text="已停用"
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChange(scope as any)}
        />
      )
    },
    {
      label: "备注",
      prop: "description",
      minWidth: 150
    },
    {
      label: "创建时间",
      minWidth: 180,
      prop: "createTime",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: "操作",
      fixed: "right",
      width: 160,
      slot: "operation"
    }
  ];

  function onChange({ row, index }) {
    ElMessageBox.confirm(
      `确认要<strong>${
        row.is_active === false ? "停用" : "启用"
      }</strong><strong style='color:var(--el-color-primary)'>${
        row.name
      }</strong>吗?`,
      "系统提示",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
        dangerouslyUseHTMLString: true,
        draggable: true
      }
    )
      .then(() => {
        switchLoadMap.value[index] = Object.assign(
          {},
          switchLoadMap.value[index],
          {
            loading: true
          }
        );
        updateRoleApi(row.pk, row).then(res => {
          if (res.code === 1000) {
            switchLoadMap.value[index] = Object.assign(
              {},
              switchLoadMap.value[index],
              {
                loading: false
              }
            );
            message("已成功修改角色状态", {
              type: "success"
            });
          }
        });
      })
      .catch(() => {
        row.is_active === false
          ? (row.is_active = true)
          : (row.is_active = false);
      });
  }

  async function handleDelete(row) {
    deleteRoleApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message("操作成功", { type: "success" });
        await onSearch();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
    });
  }

  async function handleSizeChange(val: number) {
    form.page = 1;
    form.size = val;
    await onSearch();
  }

  async function handleCurrentChange(val: number) {
    form.page = val;
    await onSearch();
  }

  function handleSelectionChange(val) {
    manySelectCount.value = val.length;
  }
  function onSelectionCancel() {
    manySelectCount.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }
  function handleManyDelete() {
    if (manySelectCount.value === 0) {
      message("数据未选择", { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteRoleApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(async res => {
      if (res.code === 1000) {
        message(`批量删除了${manySelectCount.value}条数据`, {
          type: "success"
        });
        await onSearch();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
    });
  }

  async function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    const { data } = await getRoleListApi(toRaw(form));
    dataList.value = data.results;
    pagination.total = data.total;

    setTimeout(() => {
      loading.value = false;
    }, 500);
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  };

  function openDialog(is_edit = false, row?: FormItemProps) {
    let title = "新增";
    if (is_edit) {
      title = "修改";
    }
    addDialog({
      title: `${title}角色`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          name: row?.name ?? "",
          code: row?.code ?? "",
          menu: row?.menu ?? [],
          is_active: row?.is_active ?? true,
          description: row?.description ?? ""
        }
      },
      width: "40%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const TreeRef = formRef.value.getTreeRef();
        const curData = options.props.formInline as FormItemProps;
        async function chores() {
          message(`您${title}了角色名称为${curData.name}的这条数据`, {
            type: "success"
          });
          done(); // 关闭弹框
          await onSearch(); // 刷新表格数据
        }
        FormRef.validate(valid => {
          if (valid) {
            curData.menu = TreeRef!.getCheckedKeys(false);
            if (is_edit) {
              updateRoleApi(curData.pk, curData).then(async res => {
                if (res.code === 1000) {
                  await chores();
                } else {
                  message(`操作失败，${res.detail}`, { type: "error" });
                }
              });
            } else {
              createRoleApi(curData).then(async res => {
                if (res.code === 1000) {
                  await chores();
                } else {
                  message(`操作失败，${res.detail}`, { type: "error" });
                }
              });
            }
          }
        });
      }
    });
  }

  /** 菜单权限 */

  const getMenuData = () => {
    loading.value = true;
    getMenuListApi({ page: 1, size: 100 }).then(res => {
      if (res.code === 1000) {
        menuTreeData.value = handleTree(res.data);
      }
      loading.value = false;
    });
  };

  onMounted(() => {
    onSearch();
  });

  return {
    form,
    loading,
    columns,
    dataList,
    pagination,
    sortOptions,
    menuTreeData,
    manySelectCount,
    onSelectionCancel,
    getMenuData,
    onSearch,
    resetForm,
    openDialog,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
