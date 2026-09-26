import {
  computed,
  getCurrentInstance,
  h,
  reactive,
  ref,
  type Ref,
  shallowRef,
  type VNode
} from "vue";
import { noticeApi } from "@/api/system/notice";
import { useRouter } from "vue-router";
import { deviceDetection } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { NoticeChoices } from "@/views/system/constants";
import {
  isReadonlyCell,
  renderSwitch,
  usePublicHooks,
  type PageTableColumn,
  type OperationProps,
  type RePlusPageProps
} from "@/components/RePlusPage";
import NoticeShowForm from "@/views/system/components/NoticeShow.vue";
import WangEditor from "@/components/RePlusPage/src/components/WangEditor.vue";
import type { RecordType } from "plus-pro-components";

export function useNotice(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(noticeApi);

  const auth = reactive({
    publish: false,
    ...getDefaultAuths(getCurrentInstance(), ["publish"])
  });

  // 发布开关（publish 列）的加载态与样式：走框架 renderSwitch 同款机制
  const switchLoadMap = ref<Record<number, { loading?: boolean }>>({});
  const { switchStyle } = usePublicHooks();

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 200,
    buttons: [
      {
        code: "update",
        update: true, // update:true 意味着我要更新这个按钮部分信息到默认的按钮信息，只更新props这个信息
        props: (row, button) => {
          const disabled = row?.notice_type?.value === NoticeChoices.SYSTEM;
          return {
            ...(button?._?.props ?? {}), // button?._ 这个表示之前老的按钮信息
            ...{ disabled, type: disabled ? "default" : "primary" }
          };
        }
      },
      {
        code: "detail",
        onClick({ row }) {
          addDialog({
            title: t("systemNotice.showSystemNotice"),
            props: {
              formInline: { ...row },
              hasPublish: true
            },
            width: "60%",
            draggable: true,
            fullscreen: deviceDetection(),
            fullscreenIcon: true,
            closeOnClickModal: false,
            hideFooter: true,
            contentRenderer: () => h(NoticeShowForm)
          });
        },
        update: true
      }
    ]
  });
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "title":
          // 字典驱动（notice_level）：字典色优先（el-text style），无色回退
          // 枚举值即 el-text 类型的契约
          column["cellRenderer"] = ({ row }) => (
            <el-text
              type={row.level?.value}
              style={row.level?.color ? { color: row.level.color } : undefined}
            >
              {row.title}
            </el-text>
          );
          break;
        case "publish":
          // 发布开关：文案用「已发布/未发布」（默认「启用/禁用」语义不符）；
          // 无 publish 权限时置灰，权限码不再形同虚设
          column["cellRenderer"] = renderSwitch({
            t,
            updateApi: api.publish,
            switchLoadMap,
            switchStyle,
            field: "publish",
            actionMap: {
              true: t("labels.publish"),
              false: t("labels.unPublish")
            },
            disabled: () => !auth.publish
          });
          break;
        case "read_user_count":
          column["cellRenderer"] = scope => {
            const { row } = scope;
            const content = `${
              row.notice_type?.value === NoticeChoices.NOTICE
                ? t("systemNotice.allRead")
                : row.user_count
            }/${row.read_user_count}`;
            // 回收站只读：不提供「阅读明细」入口
            if (isReadonlyCell(scope)) {
              return <span>{content}</span>;
            }
            return (
              <el-link
                type={row.level?.value}
                style={
                  row.level?.color ? { color: row.level.color } : undefined
                }
                onClick={() => onGoNoticeReadDetail(row)}
              >
                {content}
              </el-link>
            );
          };
          column["minWidth"] = 140;
          break;
      }
    });
    return columns;
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
            if (option.value?.value == NoticeChoices.SYSTEM) {
              fieldItemProps.disabled = true;
            }
            if (option.value?.value == NoticeChoices.NOTICE) {
              if (!hasAuth("announcement:SystemNotice")) {
                fieldItemProps.disabled = true;
              }
            }
          });
          return column;
        },
        notice_user: ({ column, formValue }) => {
          column["hideInForm"] = computed(() => {
            return !(
              formValue?.value?.notice_type?.value === NoticeChoices.USER &&
              hasAuth("list:SearchUser")
            );
          });
          return column;
        },
        notice_dept: ({ column, formValue }) => {
          column["hideInForm"] = computed(() => {
            return !(
              formValue?.value?.notice_type?.value === NoticeChoices.DEPT &&
              hasAuth("list:SearchDept")
            );
          });
          return column;
        },
        notice_role: ({ column, formValue }) => {
          column["hideInForm"] = computed(() => {
            return !(
              formValue?.value?.notice_type?.value === NoticeChoices.ROLE &&
              hasAuth("list:SearchRole")
            );
          });
          return column;
        },
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

  /** plus-pro select 选项条目（value 为对象形态，供 fieldSlot 展示与禁用判定） */
  type ElTextType = "" | "primary" | "success" | "warning" | "info" | "danger";
  type SelectOption = {
    label?: string;
    value?: { value?: string | number; color?: string | null };
    fieldItemProps?: { disabled?: boolean };
    fieldSlot?: () => VNode;
  };

  const router = useRouter();

  /** 公告阅读行（pk 用于跳转阅读详情） */
  type NoticeReadRow = { pk?: number | string };

  function onGoNoticeReadDetail(row: NoticeReadRow) {
    if (hasAuth("list:SystemNoticeRead") && row.pk) {
      router.push({
        name: "SystemNoticeRead",
        query: { notice_id: row.pk }
      });
    }
  }

  const searchComplete = ({
    routeParams,
    searchFields
  }: {
    routeParams: RecordType;
    searchFields: Ref<RecordType>;
  }) => {
    if (
      routeParams.notice_user &&
      searchFields.value.notice_user &&
      searchFields.value.notice_user !== ""
    ) {
      // 参数来自 URL（可被手工篡改或外链传错）：非法 JSON 直接清理并中止，
      // 避免解析异常中断 searchComplete 导致弹窗不再出现
      let noticeUser: unknown;
      try {
        noticeUser = JSON.parse(routeParams.notice_user);
      } catch {
        searchFields.value.notice_user = "";
        return;
      }
      const row = {
        notice_user: noticeUser,
        notice_type: { value: NoticeChoices.USER }
      };
      searchFields.value.notice_user = "";
      tableRef.value.handleAddOrEdit(true, row);
    }
  };

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps,
    searchComplete
  };
}
