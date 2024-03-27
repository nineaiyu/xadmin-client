import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { computed, h, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import {
  createAnnouncementApi,
  createNoticeApi,
  deleteNoticeApi,
  getNoticeListApi,
  manyDeleteNoticeApi,
  updateNoticeApi,
  updateNoticePublishApi
} from "@/api/system/notice";
import { useRoute, useRouter } from "vue-router";
import type { FormItemProps } from "./types";
import editForm from "../editor.vue";
import showForm from "../show.vue";
import {
  cloneDeep,
  deviceDetection,
  getKeyList,
  isEmpty,
  isString
} from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import { NoticeChoices } from "@/views/system/constants";
import { formatColumns, formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";

export function useNotice(tableRef: Ref) {
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
    notice_user: "",
    publish: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const router = useRouter();
  const defaultNoticeType = ref(NoticeChoices.NOTICE);
  const switchLoadMap = ref({});
  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const formRef = ref();
  const selectedNum = ref(0);
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
      cellRenderer: ({ row }) => (
        <el-text type={row?.level}>{row.title}</el-text>
      )
    },
    {
      label: t("notice.type"),
      prop: "notice_type_display",
      minWidth: 120
    },
    {
      label: t("notice.receiveRead"),
      prop: "user_count",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-link
          type={row.level == "" ? "default" : row.level}
          onClick={() => onGoNoticeReadDetail(row as any)}
        >
          {row.notice_type === NoticeChoices.NOTICE
            ? t("notice.allRead")
            : row.user_count}
          /{row.read_user_count}
        </el-link>
      )
    },
    {
      label: t("notice.publish"),
      prop: "publish",
      minWidth: 90,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.publish}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.publish")}
          inactive-text={t("labels.unPublish")}
          disabled={!hasAuth("update:systemNoticePublish")}
          inline-prompt
          onChange={() => onChange(scope as any)}
        />
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
        label: t("notice.publish"),
        prop: "publish",
        valueType: "select",
        options: [
          {
            label: t("labels.unPublish"),
            value: false
          },
          {
            label: t("labels.publish"),
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

  function onGoNoticeReadDetail(row: any) {
    if (hasGlobalAuth("list:systemNoticeRead") && row.pk) {
      router.push({
        name: "SystemNoticeRead",
        query: { notice_id: row.pk }
      });
    }
  }

  function openDialog(isAdd = true, row?: FormItemProps) {
    let title = t("buttons.hsedit");
    if (isAdd) {
      title = t("buttons.hsadd");
    }
    addDialog({
      title: `${title} ${t("notice.notice")}`,
      props: {
        formInline: {
          pk: row?.pk ?? 0,
          title: row?.title ?? "",
          publish: row?.publish ?? false,
          message: row?.message ?? "",
          level: row?.level ?? "",
          notice_type_display: row?.notice_type_display ?? "",
          notice_type: row?.notice_type ?? defaultNoticeType.value,
          levelChoices: levelChoices.value,
          noticeChoices: noticeChoices.value,
          notice_user: row?.notice_user ?? [],
          notice_dept: row?.notice_dept ?? [],
          notice_role: row?.notice_role ?? []
        },
        showColumns: showColumns.value,
        isAdd: isAdd
      },
      width: "60%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      top: "10vh",
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        delete curData?.levelChoices;
        delete curData?.noticeChoices;
        curData.files = formRef.value.getUploadFiles();

        function chores(detail) {
          message(detail, { type: "success" });
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        }

        FormRef.validate(valid => {
          if (valid) {
            if (isAdd) {
              let createApi = createNoticeApi;
              if (
                curData.notice_type == NoticeChoices.NOTICE &&
                hasAuth("create:systemAnnouncement")
              ) {
                createApi = createAnnouncementApi;
              }
              createApi(curData).then(res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              updateNoticeApi(curData.pk, curData).then(res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            }
          }
        });
      }
    });
  }

  function showDialog(row?: FormItemProps) {
    addDialog({
      title: t("notice.showSystemNotice"),
      props: {
        formInline: {
          pk: row?.pk ?? "",
          title: row?.title ?? "",
          publish: row?.publish ?? false,
          message: row?.message ?? "",
          level: row?.level ?? "",
          levelChoices: levelChoices.value,
          noticeChoices: noticeChoices.value
        },
        isAdd: false,
        showColumns: showColumns.value
      },
      width: "70%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(showForm, { ref: formRef })
    });
  }

  function onChange({ row, index }) {
    const action =
      row.publish === false ? t("labels.unPublish") : t("labels.publish");
    ElMessageBox.confirm(
      `${t("buttons.hsoperateconfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style='color:var(--el-color-primary)'>${row.title}</strong>`
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
        updateNoticePublishApi(row.pk, { publish: row.publish }).then(res => {
          if (res.code === 1000) {
            switchLoadMap.value[index] = Object.assign(
              {},
              switchLoadMap.value[index],
              {
                loading: false
              }
            );
            message(t("results.success"), { type: "success" });
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          }
        });
      })
      .catch(() => {
        row.publish === false ? (row.publish = true) : (row.publish = false);
      });
  }

  function handleDelete(row) {
    deleteNoticeApi(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function handleSizeChange(val: number) {
    form.value.page = 1;
    form.value.size = val;
    onSearch();
  }

  function handleCurrentChange(val: number) {
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
    manyDeleteNoticeApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(res => {
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
    getNoticeListApi(toRaw(form.value))
      .then(res => {
        if (res.code === 1000 && res.data) {
          formatColumns(res?.data?.results, columns, showColumns);
          dataList.value = res.data.results;
          pagination.total = res.data.total;
          levelChoices.value = res.level_choices;
          noticeChoices.value = res.notice_type_choices;
          noticeChoices.value.forEach(item => {
            if (item.key == NoticeChoices.NOTICE) {
              if (!hasAuth("create:systemAnnouncement")) {
                if (!item.disabled) {
                  item.disabled = true;
                  defaultNoticeType.value = NoticeChoices.USER;
                }
              }
            }
          });
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        setTimeout(() => {
          loading.value = false;
          if (
            getParameter.notice_user &&
            form.value.notice_user &&
            form.value.notice_user !== ""
          ) {
            const parameter = {
              notice_user: JSON.parse(getParameter.notice_user as string),
              notice_type: NoticeChoices.USER
            };
            form.value.notice_user = "";
            openDialog(true, parameter);
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
      form.value.notice_user = parameter.notice_user;
    }
    onSearch(true);
  });

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    pagination,
    selectedNum,
    searchColumns,
    onSearch,
    openDialog,
    showDialog,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
