import { dataPermissionApi } from "@/api/system/permission";
import { h, onMounted, reactive, ref, shallowRef } from "vue";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { FieldChoices } from "@/views/system/constants";
import { handleTree } from "@/utils/tree";
import { modelLabelFieldApi } from "@/api/system/field";
import { transformI18n } from "@/plugins/i18n";
import { getKeyList } from "@pureadmin/utils";
import type { OperationProps, RePlusPageProps } from "@/components/RePlusCRUD";
import filterForm from "../filter/index.vue";

export function useDataPermission() {
  const fieldLookupsData = ref([]);
  const valuesData = ref([]);

  const api = reactive(dataPermissionApi);

  const auth = reactive({
    list: hasAuth("list:systemDataPermission"),
    create: hasAuth("create:systemDataPermission"),
    delete: hasAuth("delete:systemDataPermission"),
    update: hasAuth("update:systemDataPermission"),
    detail: hasAuth("detail:systemDataPermission"),
    export: hasAuth("export:systemDataPermission"),
    import: hasAuth("import:systemDataPermission"),
    batchDelete: hasAuth("batchDelete:systemDataPermission")
  });

  onMounted(() => {
    if (hasGlobalAuth("list:systemModelField")) {
      modelLabelFieldApi
        .list({
          page: 1,
          size: 1000,
          field_type: FieldChoices.DATA
        })
        .then(res => {
          if (res.code === 1000) {
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
            default: ({ node, data }) => {
              data.title = transformI18n(data?.meta__title);
              return (
                <>
                  <span>{data.title}</span>
                  <span v-show={!node.isLeaf}>
                    {" "}
                    ({data?.children?.length}){" "}
                  </span>
                </>
              );
            }
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
