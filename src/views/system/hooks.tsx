// 抽离可公用的工具函数等用于系统管理页面逻辑
import { computed } from "vue";
import type { Router } from "vue-router";
import { cloneDeep, isNullOrUnDef, useDark } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import type { PageColumn } from "@/components/RePlusPage";

/**
 * 跳转用户管理页并按用户主键定位（列表 creator / owner 列的统一点击行为）。
 *
 * 无用户列表权限或缺少主键时静默不跳转。
 */
export function goUserDetail(router: Router, pk?: number | string | null) {
  if (hasAuth("list:SystemUser") && pk) {
    router.push({ name: "SystemUser", query: { pk } });
  }
}

/** 通用选项条目（choices 接口下发） */
type OptionsItem = {
  label?: unknown;
  value?: unknown;
  disabled?: boolean;
};

/** 表单列禁用态的依赖形状（isAdd/showColumns 由弹层表单上下文提供） */
type FormStateProps = {
  isAdd?: boolean;
  showColumns?: Array<string>;
};

/** 角色权限选项条目（权限管理接口下发） */
type RolePermissionItem = {
  name?: string;
  pk?: number | string;
  code?: string;
  get_mode_type_display?: string;
};

export const usePublicHooks = () => {
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
};

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
 * @param url 图片资源链接
 */
export function picturePng(url: string) {
  return url?.replace(/_(\d).jpg/, ".png");
}

/**
 * @description 格式化后端输出
 * @param data
 */
export const formatOptions = (data: Array<OptionsItem>) => {
  const result = [];
  data?.forEach(item => {
    result.push({
      label: item?.label,
      value: item?.value,
      fieldItemProps: {
        disabled: item?.disabled
      }
    });
  });
  return result;
};

export const formatPublicLabels = (
  t: (arg0: string, arg1?: object) => string,
  te: (arg0: string, arg1?: string) => boolean,
  label: string,
  localeName: string
) => {
  const formatLabel = `${localeName}.${label}`;
  if (te(formatLabel)) {
    return t(formatLabel);
  }
  if (label.split(".").length > 1) {
    if (te(`${localeName}.${label.split(".")[0]}`)) {
      return t(`${localeName}.${label.split(".")[0]}`);
    }
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

export const disableState = (props, key) => {
  return !props?.isAdd && props?.showColumns?.indexOf(key) === -1;
};

export const formatFormColumns = (
  props: FormStateProps,
  tableColumns: Array<object>,
  t: (arg0: string, arg1?: object) => string,
  te: (arg0: string, arg1?: string) => boolean,
  localeName: string,
  disabled: boolean = false
) => {
  tableColumns?.forEach(_column => {
    // plus-pro 的 fieldProps 为宽松联合（对象/函数/ComputedRef），
    // 此处仅需就地读写 disabled，按实际依赖形状收窄
    const column = _column as {
      label?: unknown;
      prop?: string;
      fieldProps?: { disabled?: boolean } | undefined;
    };
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
  t: (arg0: string, arg1?: object) => string,
  te: (arg0: string, arg1?: string) => boolean,
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

/**
 * 角色-数据权限授权弹层的列装配（部门授权 / 用户授权共用）。
 *
 * 两者原为两份逐字重复的实现，差异仅在字段集合，故在此参数化：
 * - keepKeys：弹层内保留的字段（其余 hideInForm）
 * - disabledKeys：只读展示的字段
 * - wideKeys：需要占半行的大宽度字段
 */
export const buildRoleRulesColumns = (
  addOrEditColumns: PageColumn[],
  options: {
    keepKeys: string[];
    disabledKeys: string[];
    wideKeys?: string[];
  }
): PageColumn[] => {
  const { keepKeys, disabledKeys, wideKeys = [] } = options;
  const columns = cloneDeep(addOrEditColumns);
  columns.forEach((column: PageColumn) => {
    const key = column._column?.key;
    if (!key || !keepKeys.includes(key)) {
      column.hideInForm = true;
    }
    if (key && disabledKeys.includes(key)) {
      column["fieldProps"]["disabled"] = true;
    }
    if (key && ["roles", "rules"].includes(key)) {
      column.options = customRolePermissionOptions(
        (column._column?.choices ?? []) as Array<RolePermissionItem>
      );
    }
  });
  // "pk" / "roles" / "rules" 在新增、编辑主表单中隐藏
  addOrEditColumns.forEach((column: PageColumn) => {
    const key = column._column?.key;
    if (key && ["pk", "roles", "rules"].includes(key)) {
      column.hideInForm = true;
    }
    if (key && wideKeys.includes(key)) {
      column["colProps"] = { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 };
    }
  });
  return columns;
};

export const customRolePermissionOptions = (
  data: Array<RolePermissionItem>
) => {
  const result = [];
  data?.forEach(item => {
    result.push({
      label: item?.name,
      value: { pk: item.pk, name: item?.name },
      fieldSlot: () => {
        return (
          <>
            <span style="float: left">{item.name}</span>
            <span
              style="
                  float: right;
                  font-size: 13px;
                  color: var(--el-text-color-secondary);
                "
            >
              {item.code ?? item.get_mode_type_display}
            </span>
          </>
        );
      }
    });
  });
  return result;
};

export const formatFiledAppParent = results => {
  const app = {};
  results.forEach(item => {
    if (!item.parent && item.name !== "*") {
      const appName = item.name.split(".")[0];
      item.parent = appName;
      app[appName] = {
        pk: appName,
        name: appName,
        label: appName,
        parent: null
      };
    }
  });
  Object.values(app).forEach(item => {
    results.push(item);
  });
};
