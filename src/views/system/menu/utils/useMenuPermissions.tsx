import { computed, h, ref } from "vue";
import type { Reactive, Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PlusColumn, RecordType } from "plus-pro-components";
import { ElInput } from "element-plus";
import {
  handleOperation,
  openDialogDrawer,
  renderBooleanSegmentedOption
} from "@/components/RePlusPage";
import { isObject } from "@pureadmin/utils";
import type { menuApi } from "@/api/system/menu";

/** 权限码批量生成抽屉：按视图清单勾选接口，自动拼接权限码 name（拆分自 hook.tsx） */
export function useMenuPermissions({
  api,
  menuUrlList,
  getMenuData
}: {
  api: Reactive<typeof menuApi>;
  menuUrlList: Ref<RecordType[]>;
  getMenuData: () => void;
}) {
  const { t } = useI18n();

  const handleAddPermissions = row => {
    row.skip_existing = true;
    const columns = ref<PlusColumn[]>([
      {
        label: t("systemMenu.menu"),
        prop: "meta.title",
        renderField: value => {
          return h(ElInput, {
            disabled: true,
            modelValue: t(value as string)
          });
        }
      },
      {
        label: t("systemMenu.codeSuffix"),
        prop: "name",
        tooltip: t("systemMenu.codeSuffixTip")
      },
      {
        label: t("systemMenu.menuView"),
        prop: "method",
        valueType: "select",
        fieldProps: {
          filterable: true,
          clearable: true,
          multiple: true
        },
        options: computed(() => {
          const result = {};
          menuUrlList.value?.forEach(item => {
            if (item.name !== "#") {
              result[item?.view] = {
                label: item?.view.split(".").pop(),
                value: item?.view,
                fieldSlot: () => {
                  return (
                    <>
                      <span style="float: left">
                        {result[item?.view]?.label}
                      </span>
                      <span style=" float: right; font-size: 13px; color: var(--el-text-color-secondary); ">
                        {item.label}
                      </span>
                    </>
                  );
                }
              };
            }
          });
          return Object.values(result);
        })
      },
      {
        label: t("systemMenu.skipExistingData"),
        prop: "skip_existing",
        valueType: "radio",
        renderField: renderBooleanSegmentedOption()
      }
    ]);

    openDialogDrawer({
      t,
      isAdd: false,
      title: t("systemMenu.addPermissions"),
      rawRow: { ...row },
      rawColumns: columns.value,
      rawFormProps: {
        rules: {
          method: [
            {
              required: true,
              message: t("systemMenu.menuView"),
              trigger: "blur"
            }
          ]
        }
      },
      dialogDrawerOptions: {
        onChange: data => {
          // AddOrEdit 内容组件的 change 载荷：{ values, column }
          const payload = data?.values as
            | {
                values?: { method?: string[]; name?: string };
                column?: { prop?: string };
              }
            | undefined;
          const values = payload?.values;
          if (isObject(values) && payload?.column?.prop === "method") {
            if (values.method?.length > 1) {
              values.name = values.method
                .map(item => {
                  return item
                    .split(".")
                    .pop()
                    .replace("ViewSet", "")
                    .replace("APIView", "");
                })
                .join(" | ");
            } else {
              values.name = row.name;
            }
          }
        }
      },
      saveCallback: ({ formData, done, closeLoading }) => {
        handleOperation({
          t,
          apiReq: api.permissions(row.pk, {
            views: formData.method,
            skip_existing: formData.skip_existing,
            component: formData.name
          }),
          success() {
            getMenuData();
            done();
          },
          requestEnd() {
            closeLoading();
          }
        });
      }
    });
  };

  return { handleAddPermissions };
}
