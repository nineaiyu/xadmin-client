/** 审批规则表单的级次行（提交时由父表单组装 order 与 assignee_value） */
export type LevelRow = {
  name: string;
  approve_type: string;
  assignee_type: string;
  assignee_value: string;
  /** 级次行内 el-select 的展示值（多选数组），提交时 join 成逗号串 */
  assignee_list: string[];
};

/** 新建级次行的默认值（父表单初始化与级次编辑器「添加级次」共用） */
export function createLevelRow(): LevelRow {
  return {
    name: "",
    approve_type: "OR",
    assignee_type: "user",
    assignee_value: "",
    assignee_list: []
  };
}
