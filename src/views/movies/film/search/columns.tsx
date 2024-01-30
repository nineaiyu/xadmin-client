import { nextTick, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import type { PaginationProps } from "@pureadmin/table";
import { delay, formatBytes, getKeyList } from "@pureadmin/utils";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { getFileListApi } from "@/api/movies/file";

export function useColumns(
  selectValue: any[],
  selectRef: Ref,
  formRef: Ref,
  tableRef: Ref
) {
  const dataList = ref([]);
  const loading = ref(false);
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
      label: `${t("MoviesFile.size")} ${t("labels.descending")}`,
      key: "-size"
    },
    {
      label: `${t("MoviesFile.size")} ${t("labels.ascending")}`,
      key: "size"
    },

    {
      label: `${t("MoviesFile.downloads")} ${t("labels.descending")}`,
      key: "-downloads"
    },
    {
      label: `${t("MoviesFile.downloads")} ${t("labels.ascending")}`,
      key: "downloads"
    }
  ];
  const usedOptions = [
    {
      label: t("MoviesFile.used"),
      key: "true"
    },
    {
      label: t("MoviesFile.unused"),
      key: "false"
    }
  ];
  const uploadOptions = [
    {
      label: t("MoviesFile.uploadFile"),
      key: "true"
    },
    {
      label: t("MoviesFile.importFile"),
      key: "false"
    }
  ];
  const form = reactive({
    name: "",
    drive_id: "",
    file_id: "",
    is_upload: "",
    used: "false",
    ordering: sortOptions[0].key,
    page: 1,
    size: 20
  });
  const columns: TableColumnList = [
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
      label: t("MoviesDrive.driveId"),
      prop: "aliyun_drive",
      minWidth: 100
    },
    {
      label: t("MoviesFile.name"),
      prop: "name",
      minWidth: 200,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      label: t("MoviesFile.fileId"),
      prop: "file_id",
      minWidth: 200,
      cellRenderer: ({ row }) => <span v-copy={row.file_id}>{row.file_id}</span>
    },
    {
      label: t("MoviesFile.size"),
      prop: "size",
      minWidth: 100,
      cellRenderer: ({ row }) => <span>{formatBytes(row.size)}</span>
    },
    {
      label: t("MoviesFile.duration"),
      prop: "duration",
      minWidth: 100
    },
    {
      label: t("labels.status"),
      prop: "used",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.used ? "success" : "warning"}
          effect="plain"
        >
          {row.used ? t("MoviesFile.used") : t("MoviesFile.unused")}
        </el-tag>
      )
    },
    {
      label: t("MoviesFile.isUpload"),
      prop: "is_upload",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.is_upload ? "success" : "warning"}
          effect="plain"
        >
          {row.is_upload
            ? t("MoviesFile.uploadFile")
            : t("MoviesFile.importFile")}
        </el-tag>
      )
    },
    {
      label: t("sorts.createdDate"),
      minWidth: 180,
      prop: "createTime",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    }
  ];

  /** 分页配置 */
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 20,
    currentPage: 1,
    layout: "prev, pager, next, total",
    background: true,
    small: true
  });
  const handleSizeChange = (val: number) => {
    form.page = 1;
    form.size = val;
    onSearch();
  };

  const handleCurrentChange = (val: number) => {
    form.page = val;
    onSearch();
  };
  const handleSelectionChange = val => {
    nextTick(() => {
      // add
      val.forEach(row => {
        if (selectValue.value.indexOf(row.pk) == -1) {
          selectValue.value.push(row.pk);
        }
      });
      // del
      const valPks = getKeyList(val, "pk");
      dataList.value.forEach(row => {
        if (
          selectValue.value.indexOf(row.pk) > -1 &&
          valPks.indexOf(row.pk) === -1
        ) {
          selectValue.value.splice(selectValue.value.indexOf(row.pk), 1);
        }
      });
    });
  };

  const onSearch = async (init = false) => {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    const { data } = await getFileListApi(toRaw(form));
    dataList.value = data.results;
    pagination.total = data.total;
    nextTick(() => {
      const { toggleRowSelection } = tableRef.value.getTableRef();
      dataList.value.forEach(item => {
        if (selectValue.value.indexOf(item.pk) > -1) {
          toggleRowSelection(item, undefined);
        }
      });
    });
    delay(200).then(() => {
      loading.value = false;
    });
  };

  const onReset = () => {
    formRef.value.resetFields();
    onClear();
    onSearch(true);
  };

  const removeTag = pk => {
    const { toggleRowSelection } = tableRef.value.getTableRef();
    toggleRowSelection(dataList.value.filter(v => v.pk == pk)?.[0], false);
  };

  const onClear = () => {
    const { clearSelection } = tableRef.value.getTableRef();
    clearSelection();
  };

  const onSure = () => {
    selectRef.value.blur();
  };

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
    selectValue,
    sortOptions,
    usedOptions,
    uploadOptions,
    onSure,
    onClear,
    onReset,
    onSearch,
    removeTag,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
