import {
  nextTick,
  onMounted,
  reactive,
  ref,
  type Ref,
  toRaw,
  type WritableComputedRef
} from "vue";
import type { PaginationProps } from "@pureadmin/table";
import { delay, getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { handleTree } from "@/utils/tree";

export function useColumns(
  selectRef: Ref,
  tableRef: Ref,
  getListApi: Function,
  isTree: Boolean,
  selectValue: WritableComputedRef<Array<number>>
) {
  const dataList = ref([]);
  const { t } = useI18n();
  const loading = ref(true);
  const selectVisible = ref(false);
  const treeDataList = ref([]);
  const sortOptions = ref([]);
  if (!isTree) {
    sortOptions.value = [
      {
        label: `${t("sorts.createdDate")} ${t("labels.descending")}`,
        key: "-created_time"
      },
      {
        label: `${t("sorts.createdDate")} ${t("labels.ascending")}`,
        key: "created_time"
      }
    ];
  }

  const form = reactive({
    ordering: sortOptions?.value[0]?.key,
    page: 1,
    size: isTree ? 1000 : 10
  });

  /** 分页配置 */
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: isTree ? 1000 : 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    small: true,
    background: true
  });

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

  const removeTag = val => {
    const { toggleRowSelection } = tableRef.value.getTableRef();
    toggleRowSelection(dataList.value.filter(v => v.pk === val)[0], false);
  };

  const onClear = () => {
    const { clearSelection } = tableRef.value.getTableRef();
    clearSelection();
  };

  const onSure = () => {
    selectVisible.value = false;
    selectRef.value.blur();
  };

  async function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = isTree ? 1000 : 10;
    }
    loading.value = true;
    const { data } = await getListApi(toRaw(form));
    if (isTree) {
      treeDataList.value = handleTree(data.results);
    }
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

  function handleClickOutSide() {
    if (selectVisible.value) {
      selectRef.value.visible = true;
    }
  }

  onMounted(() => {
    onSearch();
  });
  return {
    t,
    form,
    loading,
    dataList,
    pagination,
    sortOptions,
    treeDataList,
    selectVisible,
    onSure,
    onClear,
    onSearch,
    removeTag,
    handleSizeChange,
    handleClickOutSide,
    handleCurrentChange,
    handleSelectionChange
  };
}
