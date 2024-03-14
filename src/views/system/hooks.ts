// 抽离可公用的工具函数等用于系统管理页面逻辑
import { computed } from "vue";
import { cloneDeep, useDark } from "@pureadmin/utils";

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
