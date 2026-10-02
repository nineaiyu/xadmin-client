import { computed, h, shallowRef, type Ref } from "vue";
import type { noticeApi } from "@/api/system/notice";
import { hasAuth } from "@/router/utils";
import { NoticeChoices } from "@/views/system/constants";
import type { RePlusPageProps } from "@/components/RePlusPage";
import WangEditor from "@/components/RePlusPage/src/components/WangEditor.vue";
import type { RecordType } from "plus-pro-components";
import type { VNode } from "vue";
import { NOTICE_TARGET_AUTH, noticeTypeOptionLocked } from "./noticeFormRules";

/** plus-pro select 选项条目（value 为对象形态，供 fieldSlot 展示与禁用判定） */
type ElTextType = "" | "primary" | "success" | "warning" | "info" | "danger";
type SelectOption = {
  label?: string;
  value?: { value?: string | number; color?: string | null };
  fieldItemProps?: { disabled?: boolean };
  fieldSlot?: () => VNode;
};

type NoticeApiLike = Pick<typeof noticeApi, "announcement">;

/**
 * 通知公告新增/编辑弹窗列装配。
 * 自 useNotice 拆出（行为不变）：等级选项着色、类型联动接收对象列显隐、
 * 富文本消息渲染与公告接口分流（apiReq）。
 */
export function useNoticeFormOptions({ api }: { api: NoticeApiLike }) {
  /** 接收对象列显隐：通知类型匹配且具备对应搜索权限（映射见 NOTICE_TARGET_AUTH） */
  const noticeTargetColumn = (target: number) => {
    return <C extends Record<string, unknown>>({
      column,
      formValue
    }: {
      column: C;
      formValue?: Ref<RecordType>;
    }): C => {
      const target_column: Record<string, unknown> = column;
      target_column["hideInForm"] = computed(() => {
        return !(
          formValue?.value?.notice_type?.value === target &&
          hasAuth(NOTICE_TARGET_AUTH[target])
        );
      });
      return column;
    };
  };

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        level: ({ column }) => {
          (column?.options as SelectOption[]).forEach(option => {
            option["fieldSlot"] = () => {
              return (
                // 字典驱动（notice_level）：选项色字典 color 优先（style），
                // 无色回退「value 即 el-text 类型色」契约
                <el-text
                  type={option.value?.value as ElTextType}
                  style={
                    option.value?.color
                      ? { color: option.value.color }
                      : undefined
                  }
                >
                  {option.label}
                </el-text>
              );
            };
          });
          return column;
        },
        files: ({ column }) => {
          column.hideInForm = true;
          return column;
        },
        notice_type: ({ column, isAdd }) => {
          if (!isAdd) {
            (column["fieldProps"] as { disabled?: boolean })["disabled"] = true;
          }
          (column?.options as SelectOption[]).forEach(option => {
            const fieldItemProps = option.fieldItemProps as {
              disabled?: boolean;
            };
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
        },
        notice_user: noticeTargetColumn(NoticeChoices.USER),
        notice_dept: noticeTargetColumn(NoticeChoices.DEPT),
        notice_role: noticeTargetColumn(NoticeChoices.ROLE),
        notice_post: noticeTargetColumn(NoticeChoices.POST),
        message: ({ column, formValue }) => {
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
        }
      },
      minWidth: "600px",
      dialogDrawerOptions: {
        top: "10vh",
        width: "60vw"
      }
    },
    apiReq: ({ isAdd, formData }) => {
      if (isAdd) {
        if (
          formData?.notice_type?.value === NoticeChoices.NOTICE &&
          hasAuth("announcement:SystemNotice")
        ) {
          return api.announcement(formData);
        }
      }
    }
  });

  return {
    addOrEditOptions
  };
}
