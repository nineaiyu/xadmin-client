import dayjs from "dayjs";
import { message } from "@/utils/message";
import {
  createUserApi,
  deleteUserApi,
  getUserListApi,
  manyDeleteUserApi,
  updateUserApi,
  uploadUserAvatarApi
} from "@/api/system/user";
import { ElMessageBox } from "element-plus";
import { type PaginationProps, TableColumns } from "@pureadmin/table";
import { utils, writeFile } from "xlsx";
import { reactive, ref, computed, onMounted, toRaw, h } from "vue";
import { addDialog } from "@/components/ReDialog/index";
import editForm from "../form.vue";
import avatarForm from "../avatar.vue";
import { FormItemProps } from "./types";
import { getRoleListApi } from "@/api/system/role";
import { cloneDeep, isEmpty, isString } from "@pureadmin/utils";
import { useRoute } from "vue-router";

const sortOptions = [
  { label: "注册时间 Descending", key: "-date_joined" },
  { label: "注册时间 Ascending", key: "date_joined" },
  { label: "登录时间 Descending", key: "-last_login" },
  { label: "登录时间 Ascending", key: "last_login" }
];
export function useUser() {
  const form = reactive({
    pk: "",
    username: "",
    mobile: "",
    is_active: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const dataList = ref([]);
  const roleData = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const currentAvatarData = reactive({
    file: "",
    img: "",
    status: false
  });
  const manySelectData = ref<FormItemProps[]>([]);
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
      label: "用户ID",
      prop: "pk",
      minWidth: 130
    },
    {
      label: "用户头像",
      prop: "avatar",
      minWidth: 160,
      cellRenderer: ({ row }) => (
        <el-image
          class="w-[100px] h-[100px]"
          fit={"contain"}
          src={row.avatar}
          loading={"lazy"}
          preview-teleported={true}
          preview-src-list={Array.of(row.avatar)}
        />
      )
    },
    {
      label: "用户名称",
      prop: "username",
      minWidth: 130
    },
    {
      label: "用户昵称",
      prop: "nickname",
      minWidth: 130
    },
    {
      label: "性别",
      prop: "sex",
      minWidth: 90,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.sex === 1 ? "danger" : ""}
          effect="plain"
        >
          {row.sex === 1 ? "女" : "男"}
        </el-tag>
      )
    },
    // {
    //   label: "部门",
    //   prop: "dept",
    //   minWidth: 90,
    //   formatter: ({ dept }) => dept
    // },
    {
      label: "手机号码",
      prop: "mobile",
      minWidth: 90
    },
    {
      label: "状态",
      prop: "is_active",
      minWidth: 90,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.is_active}
          active-value={true}
          inactive-value={false}
          active-text="已开启"
          inactive-text="已关闭"
          inline-prompt
          onChange={() => onChange(scope as any)}
        />
      )
    },
    {
      label: "角色",
      prop: "roles",
      width: 160,
      slot: "roles"
    },
    {
      label: "注册时间",
      minWidth: 90,
      prop: "date_joined",
      formatter: ({ date_joined }) =>
        dayjs(date_joined).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: "操作",
      fixed: "right",
      width: 180,
      slot: "operation"
    }
  ];
  const buttonClass = computed(() => {
    return [
      "!h-[20px]",
      "reset-margin",
      "!text-gray-500",
      "dark:!text-white",
      "dark:hover:!text-primary"
    ];
  });

  function onChange({ row, index }) {
    ElMessageBox.confirm(
      `确认要<strong>${
        row.is_active === false ? "停用" : "启用"
      }</strong><strong style='color:var(--el-color-primary)'>${
        row.username
      }</strong>用户吗?`,
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
        updateUserApi(row.pk, row).then(res => {
          if (res.code === 1000) {
            switchLoadMap.value[index] = Object.assign(
              {},
              switchLoadMap.value[index],
              {
                loading: false
              }
            );
            message("已成功修改用户状态", {
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
    deleteUserApi(row.pk).then(async res => {
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
    manySelectData.value = val;
  }
  function handleManyDelete() {
    if (manySelectData.value.length === 0) {
      message("数据未选择", { type: "error" });
      return;
    }
    manyDeleteUserApi({
      pks: JSON.stringify(manySelectData.value.map(res => res.pk))
    }).then(async res => {
      if (res.code === 1000) {
        message(`批量删除了${manySelectData.value.length}条数据`, {
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
    const { data } = await getUserListApi(toRaw(form));
    dataList.value = data.results;
    pagination.total = data.total;
    setTimeout(() => {
      loading.value = false;
    }, 500);
  }

  const uploadAvatar = (uid: number, file: any, callback: Function) => {
    const data = new FormData();
    data.append("file", file);
    uploadUserAvatarApi({ uid: uid }, data).then(res => {
      if (res.code === 1000) {
        callback();
      } else {
        message("头像上传失败" + res.detail, { type: "error" });
      }
    });
  };

  const resetForm = async formEl => {
    if (!formEl) return;
    formEl.resetFields();
    await onSearch();
  };
  function openDialog(
    is_edit = false,
    is_reset_password = false,
    row?: FormItemProps
  ) {
    let title = "新增用户";
    if (is_edit) {
      title = `修改${row.username}用户`;
    }
    if (is_reset_password) {
      title = `重置${row.username}密码`;
      // setTimeout(function () {
      //   formRef.value!.clearValidate([
      //     "is_active",
      //     "mobile",
      //     "email",
      //   ]);
      // }, 30);
    }
    addDialog({
      title: title,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          username: row?.username ?? "",
          nickname: row?.nickname ?? "",
          avatar: row?.avatar ?? "",
          mobile: row?.mobile ?? "",
          email: row?.email ?? "",
          sex: row?.sex ?? 0,
          roles: row?.roles ?? [],
          password: row?.password ?? "",
          repeatPassword: row?.password ?? "",
          is_active: row?.is_active ?? true,
          is_edit: is_edit,
          is_reset_password: is_reset_password
        }
      },
      width: "40%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const avatarFile = formRef.value.getAvatarFile();
        const curData = options.props.formInline as FormItemProps;
        async function chores(detail) {
          message(detail, {
            type: "success"
          });
          done(); // 关闭弹框
          await onSearch(); // 刷新表格数据
        }
        FormRef.validate(async valid => {
          if (valid) {
            if (is_edit || is_reset_password) {
              updateUserApi(curData.pk, curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`操作失败，${res.detail}`, { type: "error" });
                }
              });
            } else {
              createUserApi(curData).then(async res => {
                if (res.code === 1000) {
                  if (avatarFile.file) {
                    uploadAvatar(res.data.pk, avatarFile.file, async () => {
                      await chores(res.detail);
                    });
                  } else {
                    await chores(res.detail);
                  }
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
  const getRoleData = () => {
    loading.value = true;
    getRoleListApi({ page: 1, size: 100 }).then(res => {
      if (res.code === 1000) {
        roleData.value = res.data.results;
      }
      loading.value = false;
    });
  };

  const exportExcel = () => {
    if (manySelectData.value.length === 0) {
      message("数据未选择", { type: "error" });
      return;
    }
    loading.value = true;
    const res: string[][] = manySelectData.value.map((item: FormItemProps) => {
      const arr = [];
      columns.forEach((column: TableColumns | any) => {
        if (column.label) {
          arr.push(item[column.prop]);
        }
      });
      return arr;
    });

    const titleList: string[] = [];
    columns.forEach((column: TableColumns) => {
      if (column.label) {
        titleList.push(column.label);
      }
    });
    res.unshift(titleList);
    const workSheet = utils.aoa_to_sheet(res);
    const workBook = utils.book_new();
    utils.book_append_sheet(workBook, workSheet, "注册用户报表");
    writeFile(workBook, "用户数据.xlsx");
    loading.value = false;
  };

  function updateAvatarDialog(img, row?: FormItemProps, is_edit = false) {
    currentAvatarData.img = "";
    currentAvatarData.file = "";
    currentAvatarData.status = false;
    addDialog({
      title: `修改用户头像`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          username: row?.username ?? "",
          nickname: row?.nickname ?? "",
          avatar: img ? img : row?.avatar ?? "",
          is_edit: is_edit
        }
      },
      width: "60%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(avatarForm, { ref: formRef }),
      beforeSure: done => {
        const FormRef = formRef.value.getRef();
        const avatarFile = formRef.value.getAvatarFile();
        const avatarImg = formRef.value.getAvatarImg();
        FormRef.validate(async valid => {
          currentAvatarData.file = avatarFile;
          currentAvatarData.img = avatarImg;
          if (valid && is_edit) {
            uploadAvatar(row.pk, avatarFile, async () => {
              message("头像上传成功", { type: "success" });
              currentAvatarData.status = true;
              onSearch();
              done(); // 关闭弹框
            });
          } else {
            done(); // 关闭弹框
          }
        });
      }
    });
  }

  onMounted(async () => {
    if (getParameter) {
      const parameter = cloneDeep(getParameter);
      Object.keys(parameter).forEach(param => {
        if (!isString(parameter[param])) {
          parameter[param] = parameter[param].toString();
        }
      });
      form.pk = parameter.pk;
    }
    await onSearch();
  });

  return {
    form,
    loading,
    columns,
    dataList,
    pagination,
    buttonClass,
    sortOptions,
    roleData,
    currentAvatarData,
    exportExcel,
    getRoleData,
    onSearch,
    openDialog,
    updateAvatarDialog,
    resetForm,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
