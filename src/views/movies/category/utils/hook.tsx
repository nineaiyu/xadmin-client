import dayjs from "dayjs";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "./types";
import editForm from "../form.vue";
import type { PaginationProps } from "@pureadmin/table";
import {
  h,
  nextTick,
  onMounted,
  reactive,
  ref,
  type Ref,
  toRaw,
  watch
} from "vue";
import { delay, getKeyList } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { formatColumns, usePublicHooks } from "@/views/system/hooks";
import {
  actionRankCategoryApi,
  createCategoryApi,
  deleteCategoryApi,
  getCategoryListApi,
  manyDeleteCategoryApi,
  updateCategoryApi
} from "@/api/movies/category";
import Sortable from "sortablejs";

export function useMoviesCategory(tableRef: Ref) {
  const { t } = useI18n();
  const sortOptions = [
    {
      label: `${t("sorts.createdDate")} ${t("labels.descending")}`,
      key: "-created_time"
    },
    {
      label: `${t("sorts.createdDate")} ${t("labels.ascending")}`,
      key: "created_time"
    },
    {
      label: `${t("MoviesCategory.rank")} ${t("labels.descending")}`,
      key: "-rank"
    },
    {
      label: `${t("MoviesCategory.rank")} ${t("labels.ascending")}`,
      key: "rank"
    }
  ];
  const form = reactive({
    name: "",
    enable: "",
    category_type: "",
    ordering: sortOptions[3].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const canDrop = ref(false);
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const dictChoices = ref([]);
  const { switchStyle } = usePublicHooks();
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
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <div class="flex items-center">
          <iconify-icon-online
            v-show={hasAuth("rank:MoviesCategory") && canDrop.value}
            icon="icon-park-outline:drag"
            class="drag-btn cursor-grab"
            onMouseenter={(event: { preventDefault: () => void }) =>
              rowDrop(event)
            }
          />
          <p class="ml-[16px]">{row.pk}</p>
        </div>
      )
    },
    {
      label: t("MoviesCategory.name"),
      prop: "name",
      minWidth: 120
    },
    {
      label: t("MoviesCategory.categoryDisplay"),
      prop: "category_display",
      minWidth: 120
    },
    {
      label: t("MoviesCategory.rank"),
      prop: "rank",
      minWidth: 100
    },
    {
      label: t("MoviesCategory.count"),
      prop: "count",
      minWidth: 120
    },
    {
      label: t("labels.status"),
      minWidth: 130,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.enable}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.enable")}
          inactive-text={t("labels.disable")}
          disabled={!hasAuth("update:MoviesCategory")}
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChange(scope as any)}
        />
      )
    },
    {
      label: t("sorts.createdDate"),
      minWidth: 180,
      prop: "createTime",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: t("labels.operations"),
      fixed: "right",
      width: 180,
      slot: "operation",
      hide: !(
        hasAuth("update:MoviesCategory") || hasAuth("delete:MoviesCategory")
      )
    }
  ]);
  const rowDrop = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    nextTick(() => {
      const wrapper: HTMLElement = document.querySelector(
        ".el-table__body-wrapper tbody"
      );
      Sortable.create(wrapper, {
        animation: 300,
        handle: ".drag-btn",
        onEnd: ({ newIndex, oldIndex }) => {
          const currentRow = dataList.value.splice(oldIndex, 1)[0];
          dataList.value.splice(newIndex, 0, currentRow);
          if (newIndex !== oldIndex) {
            actionRankCategoryApi({
              pks: getKeyList(dataList.value, "pk")
            }).then(res => {
              if (res.code === 1000) {
                message(t("results.success"), { type: "success" });
                onSearch();
              } else {
                message(`${t("results.failed")}，${res.detail}`, {
                  type: "error"
                });
              }
            });
          }
        }
      });
    });
  };

  function onChange({ row, index }) {
    const action =
      row.enable === false ? t("labels.disable") : t("labels.enable");
    ElMessageBox.confirm(
      `${t("buttons.hsoperateconfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style='color:var(--el-color-primary)'>${row.name}</strong>`
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
        updateCategoryApi(row.pk, row).then(res => {
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
        row.enable === false ? (row.enable = true) : (row.enable = false);
      });
  }

  async function handleDelete(row) {
    deleteCategoryApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
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
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteCategoryApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(async res => {
      if (res.code === 1000) {
        message(t("results.batchDelete", { count: manySelectCount.value }), {
          type: "success"
        });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    const { data, choices_dict }: any = await getCategoryListApi(toRaw(form));
    formatColumns(data?.results, columns, showColumns);
    dataList.value = data.results;
    pagination.total = data.total;
    dictChoices.value = choices_dict;
    delay(500).then(() => {
      loading.value = false;
    });
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  };

  function openDialog(is_add = true, row?: FormItemProps) {
    let title = t("buttons.hsedit");
    if (is_add) {
      title = t("buttons.hsadd");
    }
    addDialog({
      title: `${title} ${t("MoviesCategory.category")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          name: row?.name ?? "",
          rank: row?.rank ?? 999,
          description: row?.description ?? "",
          category_type: row?.category_type ?? "",
          enable: row?.enable ?? true
        },
        dictChoices: dictChoices.value
      },
      width: "50%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;

        async function chores(detail) {
          message(detail, { type: "success" });
          done(); // 关闭弹框
          await onSearch(); // 刷新表格数据
        }

        FormRef.validate(valid => {
          if (valid) {
            if (is_add) {
              createCategoryApi(curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              updateCategoryApi(curData.pk, curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
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

  watch(
    () => form.category_type,
    () => {
      if (form.category_type) {
        canDrop.value = true;
      } else {
        canDrop.value = false;
      }
    }
  );

  onMounted(() => {
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
    dictChoices,
    manySelectCount,
    onSelectionCancel,
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
