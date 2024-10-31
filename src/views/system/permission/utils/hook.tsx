import { dataPermissionApi } from "@/api/system/permission";
import {
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  ref,
  shallowRef
} from "vue";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { FieldChoices } from "@/views/system/constants";
import { handleTree } from "@/utils/tree";
import { modelLabelFieldApi } from "@/api/system/field";
import { transformI18n } from "@/plugins/i18n";
import { getKeyList } from "@pureadmin/utils";
import type { OperationProps, RePlusPageProps } from "@/components/RePlusPage";
import filterForm from "../components/index.vue";
import { formatFiledAppParent } from "@/views/system/hooks";

export function useDataPermission() {
  const fieldLookupsData = ref([]);
  const valuesData = ref([]);

  const api = reactive(dataPermissionApi);

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance())
  });

  onMounted(() => {
    if (hasAuth("list:SystemModelLabelField")) {
      modelLabelFieldApi
        .list({
          page: 1,
          size: 1000,
          field_type: FieldChoices.DATA
        })
        .then(res => {
          if (res.code === 1000) {
            formatFiledAppParent(res.data.results);
            fieldLookupsData.value = handleTree(res.data.results);
          }
        });
    }
    modelLabelFieldApi.choices().then(res => {
      if (res.code === 1000) {
        valuesData.value = res.choices_dict?.choices;
      }
    });
  });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        menu: ({ rawRow }) => {
          return getKeyList(rawRow?.menu ?? [], "pk") ?? [];
        },
        rules: ({ rawRow }) => {
          return rawRow?.rules ?? [];
        }
      },
      columns: {
        pk: ({ column }) => {
          column["hideInForm"] = true;
          return column;
        },
        menu: ({ column }) => {
          column._column.choices.forEach(item => {
            item.title = transformI18n(item?.meta__title);
          });
          column["options"] = handleTree(
            column._column.choices,
            "pk",
            "parent_id"
          );
          column["valueType"] = "cascader";
          column["fieldProps"]["props"] = {
            ...column["fieldProps"]["props"],
            ...{
              value: "pk",
              label: "title",
              emitPath: false,
              checkStrictly: false,
              multiple: true
            }
          };
          column["fieldSlots"] = {
            default: ({ node, data }) => (
              <>
                <span>{data.title}</span>
                <span v-show={!node.isLeaf}> ({data?.children?.length}) </span>
              </>
            )
          };
          return column;
        },
        rules: ({ column }) => {
          column["hasLabel"] = false;
          column["renderField"] = (value, onChange) => {
            return h(filterForm, {
              class: ["overflow-auto"],
              dataList: value,
              valuesData: valuesData.value,
              ruleList: fieldLookupsData.value,
              onChange
            });
          };
          return column;
        }
      }
    }
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 160,
    buttons: [{ code: "detail", show: false }]
  });
  return {
    api,
    auth,
    addOrEditOptions,
    operationButtonsProps
  };
}
