export const NoticeChoices = {
  SYSTEM: 0,
  NOTICE: 1,
  USER: 2,
  DEPT: 3,
  ROLE: 4
};

export const MethodChoices = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE"
};

export const MenuChoices = {
  DIRECTORY: 0,
  MENU: 1,
  PERMISSION: 2
};
export const ModeChoices = {
  OR: 0,
  AND: 1
};

/** 数据权限规则的值类型（与后端 ModelLabelField.KeyChoices 对齐） */
export const FieldKeyChoices = {
  ALL: "value.all",
  TEXT: "value.text",
  JSON: "value.json",
  DATE: "value.date",
  DATETIME: "value.datetime",
  DATETIME_RANGE: "value.datetime.range",
  USER_ID: "value.user.id",
  USER_DEPT_ID: "value.user.dept.id",
  USER_DEPT_IDS: "value.user.dept.ids",
  DEPARTMENTS: "value.dept.ids",
  LEADER_DEPTS: "value.leader.dept.ids",
  LEADER_USERS: "value.leader.user.ids",
  TABLE_USER: "value.table.user.ids",
  TABLE_MENU: "value.table.menu.ids",
  TABLE_ROLE: "value.table.role.ids",
  TABLE_DEPT: "value.table.dept.ids"
};

export const FieldChoices = {
  ROLE: 0,
  DATA: 1
};
