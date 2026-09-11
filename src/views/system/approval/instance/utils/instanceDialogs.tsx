import { h } from "vue";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { addDrawer } from "@/components/ReDrawer";
import StartInstanceDialog from "../components/StartInstanceDialog.vue";
import InstanceDetail from "../components/InstanceDetail.vue";

/**
 * 打开「发起申请」弹窗：选择流程 + 动态表单，提交成功即关弹层并回调刷新。
 *
 * 放在 .tsx 里以承载 contentRenderer 的 JSX；标题由调用方传入（i18n 需在 setup 内取）。
 */
export function openStartInstanceDialog(
  title: string,
  onSubmitted: () => void
) {
  const handleSubmitted = () => {
    closeDialog(options, 0);
    onSubmitted();
  };
  const options: DialogOptions = {
    title,
    width: "560px",
    draggable: true,
    closeOnClickModal: false,
    hideFooter: true,
    contentRenderer: () =>
      h(StartInstanceDialog, { onSubmitted: handleSubmitted })
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
