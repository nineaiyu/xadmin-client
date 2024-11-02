import { nextTick, reactive, type Ref, ref } from "vue";
import type { PaginationProps } from "@pureadmin/table";
import { getKeyList, isArray } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import type { PlusSearchProps } from "./types";

export function usePlusSearch(
  selectRef: Ref,
  tableRef: Ref,
  selectValue: Ref,
  props: PlusSearchProps
) {
  const { pagination, valueProps, isTree } = props;
  const dataList = ref([]);
  const { t } = useI18n();
  const selectVisible = ref(false);

  /** 分页配置 */
  const defaultPagination = reactive<PaginationProps>({
    total: 0,
    pageSize: isTree ? 1000 : 10,
    currentPage: 1,
    pageSizes: [isTree ? 1000 : 10],
    layout: isTree ? "total" : "prev, pager, next, jumper, total",
    size: "small",
    background: true,
    ...pagination
  });

  const formatValue = (row, key) => {
    if (typeof key === "function") {
      return key(row);
    } else {
      return row[key];
    }
  };
  const getSelectPks = () => {
    if (!isArray(selectValue.value)) {
      return [];
    }
    return getKeyList(selectValue.value ?? [], valueProps.value ?? "pk");
  };

  const handleSelectionChange = val => {
    nextTick(() => {
      // add
      val.forEach(row => {
        if (getSelectPks().indexOf(row.pk) == -1) {
          const item = {
            pk: row.pk,
            label: formatValue(row, valueProps.label)
          };
          (selectValue.value as any[]).push(item);
        }
      });
      // del
      const valPks = getKeyList(val, "pk");
      dataList.value.forEach(row => {
        if (
          getSelectPks().indexOf(row.pk) > -1 &&
          valPks.indexOf(row.pk) === -1
        ) {
          (selectValue.value as any[]).splice(
            getSelectPks().indexOf(row.pk),
            1
          );
        }
      });
    });
  };

  const removeTag = val => {
    if (dataList.value?.length > 0) {
      const { toggleRowSelection } = tableRef.value.getTableRef().getTableRef();
      toggleRowSelection(
        dataList.value.filter(v => v.pk === val?.pk)[0],
        false
      );
    }
  };

  const onClear = () => {
    const { clearSelection } = tableRef.value.getTableRef().getTableRef();
    clearSelection();
    selectValue.value = props.multiple ? [] : undefined;
  };

  const onSure = async () => {
    selectVisible.value = false;
    selectRef.value.expanded = false;
    await nextTick();
    selectRef.value.blur();
  };

  function handleClickOutSide() {
    if (selectVisible.value) {
      selectRef.value.visible = true;
    }
  }

  const searchComplete = ({ res: { data } }) => {
    dataList.value = data?.results;
    nextTick(() => {
      const { toggleRowSelection } = tableRef.value.getTableRef().getTableRef();
      if (props.multiple) {
        const selectPks = getSelectPks();
        dataList.value.forEach(item => {
          if (selectPks.indexOf(item.pk) > -1) {
            toggleRowSelection(item, true);
          }
        });
      }
    });
  };

  const rowStyle = ({ row: { pk } }) => {
    return {
      cursor: "pointer",
      background:
        pk === (selectValue.value as any)?.pk
          ? "var(--el-fill-color-light)"
          : ""
    };
  };

  const handleRowClick = row => {
    if (props.multiple) {
      return;
    }
    selectValue.value = {
      pk: row.pk,
      label: formatValue(row, valueProps.label)
    };
  };

  return {
    t,
    selectValue,
    selectVisible,
    defaultPagination,
    onSure,
    onClear,
    rowStyle,
    removeTag,
    searchComplete,
    handleRowClick,
    handleClickOutSide,
    handleSelectionChange
  };
}
