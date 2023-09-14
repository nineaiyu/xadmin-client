import { reactive } from "vue";
import type { FormRules } from "element-plus";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  owners: [{ required: true, message: "消息所接收用户", trigger: "blur" }],
  title: [{ required: true, message: "消息标题", trigger: "blur" }],
  message: [{ required: true, message: "消息内容", trigger: "blur" }]
});
