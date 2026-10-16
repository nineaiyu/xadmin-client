import { computed, h, type Ref, type VNode } from "vue";
import { hasAuth } from "@/router/utils";
import { NoticeChoices } from "@/views/system/constants";
import WangEditor from "@/components/RePlusPage/src/components/WangEditor.vue";
import { NOTICE_TARGET_AUTH, noticeTypeOptionLocked } from "./noticeFormRules";
import type { RecordType } from "plus-pro-components";

/** plus-pro select 选项条目（value 为对象形态，供 fieldSlot 展示与禁用判定） */
type ElTextType = "" | "primary" | "success" | "warning" | "info" | "danger";
type SelectOption = {
  label?: string;
  value?: { value?: string | number; color?: string | null };
  fieldItemProps?: { disabled?: boolean };
  fieldSlot?: () => VNode;
};

type ColumnCtx = {
  column: Record<string, unknown> & { options?: unknown };
  formValue?: Ref<RecordType>;
  isAdd?: boolean;
};

type ColumnHandler = (ctx: ColumnCtx) => Record<string, unknown>;

/**
 * 通知公告表单列装配（自 useNoticeFormOptions 拆出）：等级选项着色、类型联动
 * 接收对象列显隐（映射见 NOTICE_TARGET_AUTH）、富文本消息渲染。
 */
export function buildNoticeFormColumns() {
  /** 接收对象列显隐：通知类型匹配且具备对应搜索权限 */
  const noticeTargetColumn = (target: number): ColumnHandler => {
    return ({ column, formValue }) => {
      column["hideInForm"] = computed(() => {
        return !(
          formValue?.value?.notice_type?.value === target &&
          hasAuth(NOTICE_TARGET_AUTH[target])
        );
      });
      return column;
    };
  };

  /** 等级：字典驱动（notice_level）——选项色字典 color 优先（style），
   * 无色回退「value 即 el-text 类型色」契约 */
  const level: ColumnHandler = ({ column }) => {
    (column?.options as SelectOption[]).forEach(option => {
      option["fieldSlot"] = () => (
        <el-text
          type={option.value?.value as ElTextType}
          style={
            option.value?.color ? { color: option.value.color } : undefined
          }
        >
          {option.label}
        </el-text>
      );
    });
    return column;
  };

  const files: ColumnHandler = ({ column }) => {
    column.hideInForm = true;
    return column;
  };

  /** 类型：编辑态锁定；公告类型选项按 `announcement:SystemNotice` 权限放开 */
  const noticeType: ColumnHandler = ({ column, isAdd }) => {
    if (!isAdd) {
      (column["fieldProps"] as { disabled?: boolean })["disabled"] = true;
    }
    (column?.options as SelectOption[]).forEach(option => {
      const fieldItemProps = option.fieldItemProps as { disabled?: boolean };
      if (
        noticeTypeOptionLocked(
          option.value?.value,
          hasAuth("announcement:SystemNotice")
        )
      ) {
        fieldItemProps.disabled = true;
      }
    });
    return column;
  };

  /** 消息正文：WangEditor 渲染，附件清单回写表单值 files */
  const message: ColumnHandler = ({ column, formValue }) => {
    column["hasLabel"] = false;
    column["renderField"] = (
      value: unknown,
      onChange: (val: unknown) => void
    ) => {
      return h(WangEditor, {
        modelValue: value as string,
        onChange: ({
          messages,
          files
        }: {
          messages: Ref<string | undefined>;
          files: string[];
        }) => {
          onChange(messages);
          if (formValue?.value) formValue.value.files = files;
        }
      });
    };
    return column;
  };

  return {
    level,
    files,
    notice_type: noticeType,
    notice_user: noticeTargetColumn(NoticeChoices.USER),
    notice_dept: noticeTargetColumn(NoticeChoices.DEPT),
    notice_role: noticeTargetColumn(NoticeChoices.ROLE),
    notice_post: noticeTargetColumn(NoticeChoices.POST),
    message
  };
}
