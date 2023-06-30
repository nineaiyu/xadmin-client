/** 自定义表单规则校验 */
export const dirFormRules = {
  menu_type: [{ required: true, message: "请选择菜单类型", trigger: "change" }],
  title: [{ required: true, message: "请输入菜单名称", trigger: "blur" }],
  path: [
    { required: true, message: "请输入路由地址", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (value && value.startsWith("/")) {
          callback();
        } else {
          callback(new Error("路由必须`/`开头"));
        }
      },
      trigger: "blur"
    }
  ]
};
export const menuFormRules = {
  menu_type: [{ required: true, message: "请选择菜单类型", trigger: "change" }],
  title: [{ required: true, message: "请输入菜单名称", trigger: "blur" }],
  path: [
    { required: true, message: "请输入路由地址", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (value && value.startsWith("/")) {
          callback();
        } else {
          callback(new Error("路由必须`/`开头"));
        }
      },
      trigger: "blur"
    }
  ]
};
export const permissionFormRules = {
  menu_type: [{ required: true, message: "请选择菜单类型", trigger: "change" }],
  title: [{ required: true, message: "请输入权限名称", trigger: "blur" }],
  name: [{ required: true, message: "请输入权限标识", trigger: "blur" }],
  path: [{ required: true, message: "请输入路由地址", trigger: "blur" }],
  component: [{ required: true, message: "请输入请求方式", trigger: "blur" }]
};
