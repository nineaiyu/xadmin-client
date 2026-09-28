import { h } from "vue";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { addDrawer } from "@/components/ReDrawer";
import { dialogSize } from "@/components/ReDialog/size";
import StartInstanceDialog from "../components/StartInstanceDialog.vue";
import InstanceDetail from "../components/InstanceDetail.vue";

/** 发起申请预填（重新提交场景：复用原流程与原表单内容） */
export type StartInstanceInitial = {
  flow: string;
  title?: string;
  formData?: Record<string, unknown>;
};

/**
 * 打开「发起申请」弹窗：选择流程 + 动态表单，提交成功即关弹层并回调刷新。
 *
 * initial 非空时预选流程并回填表单（我的申请页「重新提交」按原内容重发）；
 * 放在 .tsx 里以承载 contentRenderer 的 JSX；标题由调用方传入（i18n 需在 setup 内取）。
 */
export function openStartInstanceDialog(
  title: string,
  onSubmitted: () => void,
  initial?: StartInstanceInitial
) {
  const handleSubmitted = () => {
    closeDialog(options, 0);
    onSubmitted();
  };
  const options: DialogOptions = {
    title,
    // 档位口径（T6 治理）：常规表单弹窗用 md；动态表单字段数不定，留足输入宽度
    width: dialogSize("md"),
    draggable: true,
    closeOnClickModal: false,
    hideFooter: true,
    contentRenderer: () =>
      h(StartInstanceDialog, { onSubmitted: handleSubmitted, initial })
  };
  addDialog(options);
}

/** 详情抽屉：只读展示表单数据与审批轨迹 */
export function openInstanceDetail(row: {
  pk?: string | number;
  title?: string;
}) {
  addDrawer({
    title:
      `${row.title ?? ""} - ${String(row.pk).slice(0, 8).toUpperCase()}`.replace(
        /^-\s*/,
        ""
      ),
    size: "45%",
    destroyOnClose: true,
    closeOnClickModal: true,
    hideFooter: true,
    props: { pk: row.pk },
    contentRenderer: () => h(InstanceDetail)
  });
}
