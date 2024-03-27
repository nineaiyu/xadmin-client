import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { computed, h, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import {
  getUserNoticeListApi,
  updateUserNoticeReadAllApi,
  updateUserNoticeReadApi
} from "@/api/user/notice";
import { useRoute } from "vue-router";
import type { FormItemProps } from "./types";
import showForm from "../show.vue";
import {
  cloneDeep,
  deviceDetection,
  getKeyList,
  isEmpty,
  isString
} from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { formatColumns, formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";

export function useUserNotice(tableRef: Ref) {
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
    pk: "",
    title: "",
    message: "",
    level: "",
    notice_type: "",
    unread: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const formRef = ref();
  const selectedNum = ref(0);
  const unreadCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const levelChoices = ref([]);
  const noticeChoices = ref([]);
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
      prop: "title",
      minWidth: 120,
      cellRenderer: ({ row }) => <el-text type={row.level}>{row.title}</el-text>
    },
    {
      label: t("notice.haveRead"),
      prop: "unread",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-text type={row.unread ? "success" : "info"}>
          {row.unread ? t("labels.unread") : t("labels.read")}
        </el-text>
      )
    },
    {
      label: t("sorts.createdDate"),
      minWidth: 180,
      prop: "created_time",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: t("notice.type"),
      prop: "notice_type_display",
      minWidth: 120
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
        label: t("labels.id"),
        prop: "pk",
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
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });

  function showDialog(row?: FormItemProps) {
    if (row.unread) {
      updateUserNoticeReadApi({ pks: [row.pk] });
    }
    addDialog({
      title: t("notice.showSystemNotice"),
      props: {
        formInline: {
          pk: row?.pk ?? "",
          title: row?.title ?? "",
          message: row?.message ?? "",
          level: row?.level ?? "",
          levelChoices: levelChoices.value,
          noticeChoices: noticeChoices.value
        }
      },
      width: "70%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(showForm, { ref: formRef }),
      closeCallBack: () => {
        if (getParameter.pk) {
          form.value.pk = "";
        }
        if (row.unread) {
          form.value.pk = "";
          onSearch();
        }
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

  function handleReadAll() {
    updateUserNoticeReadAllApi().then(() => {
      form.value.unread = "";
      onSearch();
    });
  }

  function handleManyRead() {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    updateUserNoticeReadApi({
      pks: getKeyList(
        manySelectData.filter(r => {
          return r.unread;
        }),
        "pk"
      )
    }).then(async res => {
      if (res.code === 1000) {
        message(t("results.batchRead", { count: selectedNum.value }), {
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
      pagination.currentPage = form.value.page = 1;
      pagination.pageSize = form.value.size = 10;
    }
    loading.value = true;
    getUserNoticeListApi(toRaw(form.value))
      .then(res => {
        if (res.code === 1000 && res.data) {
          formatColumns(res?.data?.results, columns, showColumns);
          dataList.value = res.data.results;
          pagination.total = res.data.total;
          levelChoices.value = res.level_choices;
          noticeChoices.value = res.notice_type_choices;
          unreadCount.value = res.unread_count;
          useUserStoreHook().SET_NOTICECOUNT(res.unread_count);
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        setTimeout(() => {
          loading.value = false;
          if (
            getParameter.pk &&
            getParameter.pk === form.value.pk &&
            getParameter.pk !== "" &&
            dataList.value.length > 0
          ) {
            showDialog(dataList.value[0]);
          }
        }, 500);
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
      form.value.pk = parameter.pk;
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
    unreadCount,
    searchColumns,
    onSearch,
    showDialog,
    handleReadAll,
    handleManyRead,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
