import type { Ref, VNode } from "vue";
import { addDialog } from "@/components/ReDialog";

/** 表单组件的提交契约：返回载荷对象；返回 `null` 表示校验未过（保持弹窗） */
export type ActionFormInstance<T> = { getPayload: () => T | null };

/**
 * 动作弹窗公共装配（表单独立成 `components/*Form.vue` + `getPayload` 契约）：
 * - 弹窗只负责标题/确认编排，表单状态与校验都在表单组件内部；
 * - `destroyOnClose` 保证每次打开都是干净的表单（无需 closeCallBack 手工复位）；
 * - 载荷为 `null` 时必须复位按钮 loading，否则「保存」会永久转圈
 *   （ReDialog 不感知表单内部拦截，loading 不会自动收）。
 *
 * 单行动作（useInstanceActions）与批量动作（useInstanceBatchActions）共用，
 * 两处只是弹窗标题与请求编排不同。
 */
export function openActionDialog<T>({
  title,
  formRef,
  render,
  submit
}: {
  title: string;
  formRef: Ref<ActionFormInstance<T> | undefined>;
  render: () => VNode;
  submit: (payload: T, done: () => void, closeLoading: () => void) => void;
}) {
  addDialog({
    title,
    // 档位口径：动作弹窗只有一段文本/一个选人控件，固定 md 宽度与既有实现一致
    width: "440px",
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: render,
    beforeSure: (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      submit(payload, done, closeLoading);
    }
  });
}
