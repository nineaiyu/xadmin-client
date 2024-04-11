// 抽离可公用的工具函数等用于系统管理页面逻辑
import { computed, type Ref } from "vue";
import { cloneDeep, isNullOrUnDef, useDark } from "@pureadmin/utils";
import type { PlusColumn } from "plus-pro-components";
import { getPickerShortcuts } from "@/views/system/logs/utils";
import { useI18n } from "vue-i18n";

export function usePublicHooks() {
  const { isDark } = useDark();

  const switchStyle = computed(() => {
    return {
      "--el-switch-on-color": "#6abe39",
      "--el-switch-off-color": "#e84749"
    };
  });

  const tagStyle = computed(() => {
    return (status: boolean) => {
      return status
        ? {
            "--el-tag-text-color": isDark.value ? "#6abe39" : "#389e0d",
            "--el-tag-bg-color": isDark.value ? "#172412" : "#f6ffed",
            "--el-tag-border-color": isDark.value ? "#274a17" : "#b7eb8f"
          }
        : {
            "--el-tag-text-color": isDark.value ? "#e84749" : "#cf1322",
            "--el-tag-bg-color": isDark.value ? "#2b1316" : "#fff1f0",
            "--el-tag-border-color": isDark.value ? "#58191c" : "#ffa39e"
          };
    };
  });

  return {
    /** 当前网页是否为`dark`模式 */
    isDark,
    /** 表现更鲜明的`el-switch`组件  */
    switchStyle,
    /** 表现更鲜明的`el-tag`组件  */
    tagStyle
  };
}

export function formatHigherDeptOptions(treeList) {
  // 根据返回数据的status字段值判断追加是否禁用disabled字段，返回处理后的树结构，用于上级部门级联选择器的展示
  // （实际开发中也是如此，不可能前端需要的每个字段后端都会返回，这时需要前端自行根据后端返回的某些字段做逻辑处理）
  if (!treeList || !treeList.length) return;
  const newTreeList = [];
  for (let i = 0; i < treeList.length; i++) {
    treeList[i].disabled = !treeList[i].is_active;
    formatHigherDeptOptions(treeList[i].children);
    newTreeList.push(treeList[i]);
  }
  return newTreeList;
}

/**
 * @description 将缩略图的地址转换为png地址
 * @param results 后端返回的结果
 * @param columns 定义好的字段
 * @param showColumns 需要显示的字段
 */
export function formatColumns(results, columns, showColumns) {
  if (results.length > 0) {
    showColumns.value = Object.keys(results[0]);
    cloneDeep(columns.value).forEach(column => {
      if (column?.prop && showColumns.value.indexOf(column?.prop) === -1) {
        columns.value.splice(
          columns.value.findIndex(obj => {
            return obj.label === column.label;
          }),
          1
        );
      }
    });
  }
}

/**
 * @description 将缩略图的地址转换为png地址
 * @param url 图片资源链接
 */
export function picturePng(url: string) {
  return url?.replace(/_(\d).jpg/, ".png");
}

/**
 * @description 格式化后端输出
 * @param data
 */
export const formatOptions = (data: Array<any>) => {
  const result = [];
  data?.forEach(item => {
    result.push({
      label: item?.label,
      value: item?.key,
      fieldItemProps: {
        disabled: item?.disabled
      }
    });
  });
  return result;
};

export const plusPorChange = (column: any, func: Function, ...args) => {
  const canChangeType = ["select", "date-picker", "time-picker", "time-select"];
  canChangeType.indexOf(column.valueType) > -1 && func && func(...args);
};

export const formatPublicLabels = (
  t: Function,
  te: Function,
  label: string,
  localeName: string
) => {
  const formatLabel = `${localeName}.${label}`;
  if (te(formatLabel)) {
    return t(formatLabel);
  }
  if (
    [
      "pk",
      "rank",
      "description",
      "ordering",
      "is_active",
      "selection",
      "operation",
      "created_time",
      "updated_time",
      "descending",
      "ascending",
      "status"
    ].indexOf(label) > -1
  ) {
    return t(`commonLabels.${label}`);
  }
  return t(formatLabel);
};

interface SearchProp {
  key: string;
  choices: Array<number | string | any>;
  input_type: string | any;
}

export const formatSearchColumns = (
  item: SearchProp,
  localeName?: string,
  t?: Function,
  te?: Function
) => {
  const column: PlusColumn = {
    label: localeName
      ? formatPublicLabels(t, te, item.key, localeName)
      : item.key,
    prop: item.key,
    options: formatOptions(item.choices),
    valueType: "input"
  };
  switch (item.input_type) {
    case "text":
      column.valueType = "input";
      break;
    case "datetime":
      column.valueType = "date-picker";
      column.fieldProps = {
        valueFormat: "YYYY-MM-DD HH:mm:ss"
      };
      break;
    case "datetimerange":
      column.valueType = "date-picker";
      column.fieldProps = {
        shortcuts: getPickerShortcuts(),
        valueFormat: "YYYY-MM-DD HH:mm:ss",
        type: "datetimerange"
      };
      column.colProps = {
        xs: 24,
        sm: 24,
        md: 12,
        lg: 12,
        xl: 12
      };
      break;
    case "number":
      column.valueType = "input";
      column.rules = [
        {
          validator: (rule, value, callback) => {
            if (value !== "" && !/^\d+$/.test(value)) {
              callback(new Error("field must be a number"));
            }
          }
        }
      ];
      break;
    case "select-multiple":
      column.valueType = "select";
      column.fieldProps = {
        multiple: true
      };
      break;
    case "select-ordering":
      column.valueType = "select";
      const options = formatOptions(item.choices);
      options?.forEach(option => {
        const labels = option.label.split(" ");
        option.label = `${formatPublicLabels(t, te, labels[0] as string, localeName)} ${formatPublicLabels(t, te, labels[1] as string, localeName)}`;
      });
      column.options = options;
      break;
    default:
      column.valueType = item.input_type;
  }
  return column;
};
export const getFieldsData = (
  fieldsApi: Function,
  searchFields: Ref,
  searchColumns: Ref,
  localeName?: string,
  page: number = 1,
  size: number = 10,
  ordering: string = "-created_time"
) => {
  return new Promise((resolve, reject) => {
    const { t, te } = useI18n();
    fieldsApi().then(
      (res: { code: number; data: { results: Array<SearchProp> } }) => {
        if (res.code === 1000) {
          res.data.results.forEach(item => {
            searchFields.value[item.key] = "";
            searchColumns.value.push(
              formatSearchColumns(item, localeName, t, te)
            );
          });
          searchFields.value.page = page;
          searchFields.value.size = size;
          searchFields.value.ordering = ordering;
          resolve(res);
        } else {
          reject(res);
        }
      }
    );
  });
};

export const disableState = (props, key) => {
  return !props?.isAdd && props?.showColumns?.indexOf(key) === -1;
};

export const formatFormColumns = (
  props: Record<string, any>,
  tableColumns: Array<any>,
  t: Function,
  te: Function,
  localeName: string,
  disabled: boolean = false
) => {
  tableColumns.forEach(column => {
    column.label =
      column.label ??
      formatPublicLabels(t, te, column.prop as string, localeName);
    if (isNullOrUnDef(column.fieldProps?.disabled)) {
      column.fieldProps = {
        ...column.fieldProps,
        disabled: disabled || disableState(props, column.prop)
      };
    }
  });
};

export const formatColumnsLabel = (
  tableColumns: TableColumnList,
  t: Function,
  te: Function,
  localeName: string
) => {
  tableColumns.forEach(column => {
    let key = column.prop;
    if (column.type === "selection") {
      key = column.type;
    }
    if (column.slot === "operation") {
      key = column.slot;
    }
    column.label =
      column.label ?? formatPublicLabels(t, te, key as string, localeName);
  });
};
