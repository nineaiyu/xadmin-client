/**
 * 菜单页字典与元数据装配：权限路由下拉的接口清单、字段字典、关联模型候选与
 * 组件路径清单。与树数据层（useMenuData）分离：这里只装配「下拉/候选」数据，
 * 不参与树的增删改与局部更新。
 */

import { ref, type Reactive } from "vue";
import { isEmpty, isNullOrUnDef } from "@pureadmin/utils";
import type { RecordType } from "plus-pro-components";
import { SUCCESS_CODE } from "@/api/types";
import { modelLabelFieldApi } from "@/api/system/field";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { formatFiledAppParent } from "@/views/system/hooks";
import { handleTree } from "@/utils/tree";
import { FieldChoices } from "@/views/system/constants";
import type { menuApi } from "@/api/system/menu";
import type {
  MenuAuths,
  MenuChoiceItem,
  MenuUrlItem,
  ModelTreeItem
} from "./types";

export function useMenuMeta({ api }: { api: Reactive<typeof menuApi> }) {
  const choicesDict = ref<Record<string, MenuChoiceItem[]>>({});
  const menuUrlList = ref<MenuUrlItem[]>([]);
  const modelList = ref<ModelTreeItem[]>([]);
  /** 组件路径清单（value → 视图组件 name，空闲时异步填充） */
  const viewList = ref<Record<string, string>>({});

  /** 字典 + 后端接口清单（权限路由下拉） */
  const getMenuApiList = (auth: MenuAuths) => {
    if (auth.apiUrl) {
      api.apiUrl().then(res => {
        if (res.code === SUCCESS_CODE) {
          menuUrlList.value = res.data as MenuUrlItem[];
        }
      });
    }
    api.choices().then(res => {
      if (res.code === SUCCESS_CODE) {
        choicesDict.value = res.choices_dict as Record<
          string,
          MenuChoiceItem[]
        >;
      }
    });
  };

  /** 关联模型（数据/字段权限绑定）候选：需具备模型字段权限列表权限 */
  const loadModels = () => {
    fetchAllRows(modelLabelFieldApi.list, {
      parent: 0,
      field_type: FieldChoices.ROLE
    }).then(res => {
      if (res.code !== SUCCESS_CODE) return;
      const results: RecordType[] = [];
      res.data.results.forEach(item => {
        // 级联值取 pk：与行数据 model（pk 列表）及提交载荷同口径，
        // 取对象会让「已有选中项回显」与提交形态不一致
        results.push({
          pk: item.pk,
          name: item.name,
          label: item.label,
          value: item.pk
        });
      });
      formatFiledAppParent(results);
      modelList.value = handleTree(results) as ModelTreeItem[];
    });
  };

  // 组件路径清单需逐个 import 视图组件才能读到 name，成本高且仅用于下拉：幂等 + 空闲加载
  let viewsLoading = false;
  const loadViews = () => {
    if (viewsLoading) return;
    viewsLoading = true;
    const files = import.meta.glob<{ default: { name?: string } }>(
      "@/views/**/*.vue"
    );
    Object.keys(files).forEach((file: string) => {
      // components 目录为依赖组件而非页面组件，不入候选
      if (/\/components\//.test(file)) return;
      files[file]().then(data => {
        if (
          isEmpty(data?.default?.name) ||
          isNullOrUnDef(data?.default?.name)
        ) {
          return;
        }
        viewList.value[
          file.replace(/(\.\/|\.vue)/g, "").replace("/src/views/", "")
        ] = data?.default?.name as string;
      });
    });
  };

  return {
    choicesDict,
    menuUrlList,
    modelList,
    viewList,
    getMenuApiList,
    loadModels,
    loadViews
  };
}
