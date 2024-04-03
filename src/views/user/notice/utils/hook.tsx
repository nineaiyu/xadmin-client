import dayjs from "dayjs";
import { message } from "@/utils/message";
import { computed, h, onMounted, reactive, ref, type Ref } from "vue";
import {
  getUserNoticeDetailApi,
  getUserNoticeListApi,
  updateUserNoticeReadAllApi,
  updateUserNoticeReadApi
} from "@/api/user/notice";
import { useRoute } from "vue-router";
import type { FormItemProps } from "./types";
import showForm from "../show.vue";
import { cloneDeep, deviceDetection, isEmpty } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";

import { hasAuth } from "@/router/utils";
import { selectOptions } from "@/views/system/render";

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
  const searchField = ref({
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

  const defaultValue = cloneDeep(searchField.value);

  const api = reactive({
    list: getUserNoticeListApi,
    detail: getUserNoticeDetailApi,
    batchRead: updateUserNoticeReadApi,
    allRead: updateUserNoticeReadAllApi
  });

  const auth = reactive({
    list: hasAuth("list:userNotice"),
    detail: hasAuth("detail:userNoticeRead"),
    batchRead: hasAuth("update:userNoticeRead"),
    allRead: hasAuth("update:userNoticeReadAll")
  });

  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const formRef = ref();
  const choicesDict = ref({});
  const selectedNum = ref(0);
  const unreadCount = ref(0);
  const manySelectData = ref([]);

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
        options: selectOptions
      },
      {
        label: t("notice.level"),
        prop: "level",
        valueType: "select",
        options: computed(() => {
          return formatOptions(choicesDict.value["level"]);
        })
      },
      {
        label: t("notice.type"),
        prop: "notice_type",
        valueType: "select",
        options: computed(() => {
          return formatOptions(choicesDict.value["notice_type"]);
        })
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
      api.batchRead({ pks: [row.pk] });
    }
    addDialog({
      title: t("notice.showSystemNotice"),
      props: {
        formInline: {
          pk: row?.pk ?? "",
          title: row?.title ?? "",
          message: row?.message ?? "",
          level: row?.level ?? ""
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
          searchField.value.pk = "";
        }
        if (row.unread) {
          searchField.value.pk = "";
          tableRef.value.onSearch();
        }
      }
    });
  }

  function handleReadAll() {
    updateUserNoticeReadAllApi().then(() => {
      searchField.value.unread = "";
      tableRef.value.onSearch();
    });
  }

  function handleManyRead() {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    api.batchRead({ pks: manySelectData.value }).then(async res => {
      if (res.code === 1000) {
        message(t("results.batchRead", { count: selectedNum.value }), {
          type: "success"
        });
        tableRef.value.onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  const searchEnd = (getParameter, form, dataList, res) => {
    unreadCount.value = res.unread_count;
    useUserStoreHook().SET_NOTICECOUNT(res.unread_count);
    if (
      getParameter.pk &&
      getParameter.pk === form.value.pk &&
      getParameter.pk !== "" &&
      dataList.value.length > 0
    ) {
      showDialog(dataList.value[0]);
    }
  };
  const selectionChange = func => {
    manySelectData.value = func();
    selectedNum.value = manySelectData.value.length ?? 0;
  };

  onMounted(() => {
    api.detail("choices").then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });
  });

  return {
    t,
    api,
    auth,
    columns,
    selectedNum,
    unreadCount,
    searchField,
    defaultValue,
    searchColumns,
    showDialog,
    searchEnd,
    handleReadAll,
    handleManyRead,
    selectionChange
  };
}
