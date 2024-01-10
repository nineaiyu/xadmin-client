import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { h, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import {
  deleteNoticeReadApi,
  getNoticeReadListApi,
  manyDeleteNoticeReadApi,
  updateNoticeReadStateApi
} from "@/api/system/notice";
import type { FormItemProps } from "../utils/types";
import showForm from "../show.vue";
import {
  cloneDeep,
  delay,
  getKeyList,
  isEmpty,
  isString
} from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { useRoute, useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import { formatColumns } from "@/views/system/hooks";

export function useNoticeRead(tableRef: Ref, tableBarRef: Ref) {
  const { t } = useI18n();
  const sortOptions = [
    {
      label: `${t("sorts.createdDate")} ${t("labels.descending")}`,
      key: "-created_time"
    },
    {
      label: `${t("sorts.createdDate")} ${t("labels.ascending")}`,
      key: "created_time"
    }
  ];
  const form = reactive({
    title: "",
    message: "",
    username: "",
    owner_id: "",
    notice_id: "",
    notice_type: "",
    level: "",
    unread: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const router = useRouter();
  const switchLoadMap = ref({});
  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const noticeChoices = ref([]);
  const levelChoices = ref([]);
  const showColumns = ref([]);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
  const columns = ref<TableColumnList>([
    {
      type: "selection",
      align: "left"
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
    },
    {
      label: t("notice.title"),
      prop: "notice_info",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-link
          type={row.notice_info.level == "" ? "default" : row.notice_info.level}
          onClick={() => onGoNoticeDetail(row as any)}
        >
          {row.notice_info.title}
        </el-link>
      )
    },
    {
      label: t("notice.type"),
      prop: "notice_info",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-text>{row.notice_info.notice_type_display}</el-text>
      )
    },
    {
      label: t("user.userId"),
      prop: "owner_info",
      minWidth: 100,
      cellRenderer: ({ row }) => <el-text>{row.owner_info?.pk}</el-text>
    },
    {
      label: t("user.userInfo"),
      prop: "owner_info",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoUserDetail(row as any)}>
          {row.owner_info?.username ? row.owner_info?.username : "/"}
        </el-link>
      )
    },
    {
      label: t("notice.readDate"),
      minWidth: 180,
      prop: "updated_time",
      cellRenderer: ({ row }) => (
        <el-text>
          {!row.unread
            ? dayjs(row.updated_time).format("YYYY-MM-DD HH:mm:ss")
            : "/"}
        </el-text>
      )
    },
    {
      label: t("notice.haveRead"),
      prop: "unread",
      minWidth: 90,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.unread}
          active-value={false}
          inactive-value={true}
          active-text={t("labels.read")}
          inactive-text={t("labels.unread")}
          disabled={!hasAuth("update:systemNoticeReadState")}
          inline-prompt
          onChange={() => onChange(scope as any)}
        />
      )
    },
    {
      label: t("labels.operations"),
      fixed: "right",
      width: 200,
      slot: "operation"
    }
  ]);

  function onChange({ row, index }) {
    const action = row.unread === false ? t("labels.read") : t("labels.unread");
    ElMessageBox.confirm(
      `${t("buttons.hsoperateconfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style='color:var(--el-color-primary)'>${row.notice_info.title}</strong>`
      })}`,
      {
        confirmButtonText: t("buttons.hssure"),
        cancelButtonText: t("buttons.hscancel"),
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
        updateNoticeReadStateApi(row.pk, { unread: row.unread }).then(res => {
          if (res.code === 1000) {
            switchLoadMap.value[index] = Object.assign(
              {},
              switchLoadMap.value[index],
              {
                loading: false
              }
            );
            message(t("results.success"), { type: "success" });
            onSearch();
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          }
        });
      })
      .catch(() => {
        row.unread === false ? (row.unread = true) : (row.unread = false);
      });
  }

  function onGoUserDetail(row: any) {
    if (
      hasGlobalAuth("list:systemUser") &&
      row.owner_info &&
      row.owner_info?.pk
    ) {
      router.push({
        name: "systemUser",
        query: { pk: row.owner_info.pk }
      });
    }
  }

  function onGoNoticeDetail(row: any) {
    if (
      hasGlobalAuth("list:systemNotice") &&
      row.notice_info &&
      row.notice_info.pk
    ) {
      router.push({
        name: "systemNotice",
        query: { pk: row.notice_info.pk }
      });
    }
  }

  function showDialog(row?: FormItemProps) {
    addDialog({
      title: t("notice.showSystemNotice"),
      props: {
        formInline: {
          pk: row?.pk ?? "",
          title: row?.title ?? "",
          message: row?.message ?? "",
          publish: row?.publish ?? true,
          level: row?.level ?? ""
        }
      },
      width: "70%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(showForm, { ref: formRef })
    });
  }

  async function handleDelete(row) {
    deleteNoticeReadApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function handleSizeChange(val: number) {
    form.page = 1;
    form.size = val;
    onSearch();
  }

  async function handleCurrentChange(val: number) {
    form.page = val;
    onSearch();
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
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteNoticeReadApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(async res => {
      if (res.code === 1000) {
        message(t("results.batchDelete", { count: manySelectCount.value }), {
          type: "success"
        });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    getNoticeReadListApi(toRaw(form)).then(res => {
      if (res.code === 1000 && res.data) {
        formatColumns(res?.data?.results, columns, showColumns, tableBarRef);
        dataList.value = res.data.results;
        pagination.total = res.data.total;
        noticeChoices.value = res.notice_type_choices;
        levelChoices.value = res.level_choices;
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      delay(500).then(() => {
        loading.value = false;
      });
    });
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  };

  onMounted(() => {
    if (getParameter) {
      const parameter = cloneDeep(getParameter);
      Object.keys(parameter).forEach(param => {
        if (!isString(parameter[param])) {
          parameter[param] = parameter[param].toString();
        }
      });
      form.notice_id = parameter.notice_id;
    }
    onSearch();
  });

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    pagination,
    sortOptions,
    manySelectCount,
    noticeChoices,
    levelChoices,
    onSelectionCancel,
    onSearch,
    resetForm,
    showDialog,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
