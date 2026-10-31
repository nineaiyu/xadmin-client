/**
 * 菜单页字典与元数据装配：权限路由下拉的接口清单、字段字典、关联模型候选与
 * 组件路径清单。与树数据层（useMenuData）分离：这里只装配「下拉/候选」数据，
 * 不参与树的增删改与局部更新。
 */

import { ref, type Reactive } from "vue";
import type { RecordType } from "plus-pro-components";
import { isSuccess } from "@/api/types";
import { modelLabelFieldApi } from "@/api/system/field";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { normalizeError } from "@/utils/apiError";
import { formatFiledAppParent } from "@/views/system/hooks";
import { handleTree } from "@/utils/tree";
import { FieldChoices } from "@/views/system/constants";
import type { menuApi } from "@/api/system/menu";
import { loadMenuViewList } from "./menuViewList";
import type {
  MenuAuths,
  MenuChoiceItem,
  MenuRow,
  MenuUrlItem,
  ModelTreeItem
} from "./types";

export function useMenuMeta({ api }: { api: Reactive<typeof menuApi> }) {
  const choicesDict = ref<Record<string, MenuChoiceItem[]>>({});
  const menuUrlList = ref<MenuUrlItem[]>([]);
  const modelList = ref<ModelTreeItem[]>([]);
  /** 组件路径清单（value → 视图组件 name，空闲时异步填充） */
  const viewList = ref<Record<string, string>>({});

  /** 下拉候选为可选能力：失败静默降级，但 DEV 下留痕便于排查空下拉 */
  const warnDegraded = (scope: string, detail: unknown) => {
    if (!import.meta.env.DEV) return;
    console.warn(`[menu] ${scope}加载失败，已降级`, detail);
  };

  /** 字典 + 后端接口清单（权限路由下拉） */
  const getMenuApiList = (auth: MenuAuths) => {
    if (auth.apiUrl) {
      api
        .apiUrl()
        .then(res => {
          if (isSuccess(res)) {
            menuUrlList.value = res.data as MenuUrlItem[];
          } else {
            warnDegraded("接口清单", res?.detail);
          }
        })
        .catch(error => warnDegraded("接口清单", normalizeError(error).detail));
    }
    api
      .choices()
      .then(res => {
        if (isSuccess(res)) {
          choicesDict.value = res.choices_dict as Record<
            string,
            MenuChoiceItem[]
          >;
        } else {
          warnDegraded("菜单字典", res?.detail);
        }
      })
      .catch(error => warnDegraded("菜单字典", normalizeError(error).detail));
  };

  /** 关联模型（数据/字段权限绑定）候选：需具备模型字段权限列表权限 */
  const loadModels = () => {
    fetchAllRows(modelLabelFieldApi.list, {
      parent: 0,
      field_type: FieldChoices.ROLE
    }).then(res => {
      if (!isSuccess(res)) {
        warnDegraded("关联模型候选", res?.detail);
        return;
      }
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

  // 组件路径清单只枚举视图文件键（不 import chunk），名称由菜单元数据带入
  let viewsLoading = false;
  const loadViews = (rows: MenuRow[] = []) => {
    if (viewsLoading) return;
    viewsLoading = true;
    loadMenuViewList(viewList, rows);
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
