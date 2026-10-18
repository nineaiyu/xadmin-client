import { computed, h, type Ref, type VNode } from "vue";
import { ElMessageBox } from "element-plus";
import type { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { NoticeChoices } from "@/views/system/constants";
import NoticeMessageEditor from "@/views/system/notice/components/NoticeMessageEditor.vue";
import {
  NOTICE_TARGET_AUTH,
  noticeMessageHasContent,
  noticeTypeOptionLocked
} from "./noticeFormRules";
import { resolveMessageFormat } from "./noticeFormat";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

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
export function buildNoticeFormColumns({ t }: { t: TFunction }) {
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

  /** 正文格式：创建时可选，编辑态锁定；切换格式会改变正文解释方式，
   * 非空正文需二次确认后清空（避免同一份源码被两种渲染器误解） */
  const messageFormat: ColumnHandler = ({ column, formValue, isAdd }) => {
    const fieldProps = (column["fieldProps"] ?? {}) as Record<string, unknown>;
    column["fieldProps"] = fieldProps;
    if (!isAdd) {
      fieldProps.disabled = true;
      column["tooltip"] = t("systemNotice.formatLocked");
      return column;
    }

    let previous = resolveMessageFormat(formValue?.value?.message_format);
    let previousValue: unknown = formValue?.value?.message_format ?? {
      value: previous
    };
    fieldProps.onChange = async (value: unknown) => {
      const next = resolveMessageFormat(value);
      if (next === previous) return;
      if (noticeMessageHasContent(formValue?.value?.message)) {
        try {
          await ElMessageBox.confirm(
            t("systemNotice.formatSwitchConfirm"),
            t("systemNotice.formatSwitchTitle"),
            {
              type: "warning",
              confirmButtonText: t("buttons.confirm"),
              cancelButtonText: t("buttons.cancel")
            }
          );
        } catch {
          // 取消切换：恢复原选项，正文保持不变
          if (formValue?.value) {
            formValue.value.message_format = previousValue;
          }
          return;
        }
        if (formValue?.value) {
          formValue.value.message = "";
          formValue.value.files = [];
        }
      }
      previous = next;
      previousValue = formValue?.value?.message_format ?? { value: next };
    };
    return column;
  };

  /** 消息正文：按正文格式渲染富文本 / Markdown 编辑器，附件清单回写表单值 files */
  const message: ColumnHandler = ({ column, formValue }) => {
    column["hasLabel"] = false;
    // 正文编辑器占满整行（弹窗内容区自适应），不受半宽列/标签宽度挤压
    column["colProps"] = { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 };
    column["renderField"] = (
      value: unknown,
      onChange: (val: unknown) => void
    ) => {
      const isMarkdown =
        resolveMessageFormat(formValue?.value?.message_format) === "markdown";
      return h(NoticeMessageEditor, {
        modelValue: value as string,
        format: formValue?.value?.message_format ?? "html",
        // Markdown 分栏编辑给弹窗留出更多垂直空间；富文本保持原高度
        minHeight: isMarkdown ? 320 : 400,
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
    message_format: messageFormat,
    notice_user: noticeTargetColumn(NoticeChoices.USER),
    notice_dept: noticeTargetColumn(NoticeChoices.DEPT),
    notice_role: noticeTargetColumn(NoticeChoices.ROLE),
    notice_post: noticeTargetColumn(NoticeChoices.POST),
    message
  };
}
