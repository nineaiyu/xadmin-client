import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { computed, h, onMounted, reactive, ref, type Ref, toRaw } from "vue";
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
  deviceDetection,
  getKeyList,
  isEmpty,
  isString
} from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { useRoute, useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import { formatColumns, formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";

export function useNoticeRead(tableRef: Ref) {
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
  const form = ref({
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
  const selectedNum = ref(0);
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
      label: t("labels.checkColumn"),
      type: "selection",
      fixed: "left",
      reserveSelection: true
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

  const searchColumns: PlusColumn[] = computed(() => {
    return [
      {
        label: t("user.userId"),
        prop: "owner_id",
        valueType: "input",
        fieldProps: {
          placeholder: t("user.verifyUserId")
        }
      },
      {
        label: t("labels.id"),
        prop: "notice_id",
        valueType: "input"
      },
      {
        label: t("notice.title"),
        prop: "title",
        valueType: "input",
        fieldProps: {
          placeholder: t("notice.verifyTitle")
        }
      },
      {
        label: t("notice.content"),
        prop: "message",
        valueType: "input",
        fieldProps: {
          placeholder: t("notice.verifyContent")
        }
      },
      {
        label: t("user.username"),
        prop: "username",
        valueType: "input",
        fieldProps: {
          placeholder: t("user.verifyUsername")
        }
      },
      {
        label: t("notice.level"),
        prop: "level",
        valueType: "select",
        options: formatOptions(levelChoices.value)
      },
      {
        label: t("notice.type"),
        prop: "notice_type",
        valueType: "select",
        options: formatOptions(noticeChoices.value)
      },
      {
        label: t("notice.haveRead"),
        prop: "unread",
        valueType: "select",
        options: [
          {
            label: t("labels.read"),
            value: false
          },
          {
            label: t("labels.unread"),
            value: true
          }
        ]
      },
      {
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });

  function onChange({ row, index }) {
    const action = row.unread === false ? t("labels.read") : t("labels.unread");
    ElMessageBox.confirm(
      `${t("buttons.operateConfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style='color:var(--el-color-primary)'>${row.notice_info.title}</strong>`
      })}`,
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
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
        name: "SystemUser",
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
        name: "SystemNotice",
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
      fullscreen: deviceDetection(),
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
    form.value.page = 1;
    form.value.size = val;
    onSearch();
  }

  async function handleCurrentChange(val: number) {
    form.value.page = val;
    onSearch();
  }

  function handleSelectionChange(val) {
    selectedNum.value = val.length;
  }

  function onSelectionCancel() {
    selectedNum.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  function handleManyDelete() {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteNoticeReadApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(async res => {
      if (res.code === 1000) {
        message(t("results.batchDelete", { count: selectedNum.value }), {
          type: "success"
        });
        onSelectionCancel();
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.value.page = 1;
      pagination.pageSize = form.value.size = 10;
    }
    loading.value = true;
    getNoticeReadListApi(toRaw(form.value))
      .then(res => {
        if (res.code === 1000 && res.data) {
          formatColumns(res?.data?.results, columns, showColumns);
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
      })
      .catch(() => {
        loading.value = false;
      });
  }

  onMounted(() => {
    if (getParameter) {
      const parameter = cloneDeep(getParameter);
      Object.keys(parameter).forEach(param => {
        if (!isString(parameter[param])) {
          parameter[param] = parameter[param].toString();
        }
      });
      form.value.notice_id = parameter.notice_id;
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
    selectedNum,
    levelChoices,
    searchColumns,
    noticeChoices,
    onSearch,
    showDialog,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
