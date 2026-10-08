import { computed, onMounted, ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import type {
  FormDataApi,
  FormDataFormOption,
  FormField
} from "@/api/dataset/dform";

/**
 * 表单数据（管理端）顶部「选择表单」卡片数据源。
 * 自 useFormData 拆出（行为不变）：全部非模板表单（含停用），默认选中第一个
 * （打开即有数据）；schemaFields 随所选表单联动。
 * （切换表单写请求参数与清空筛选的 watch 留在 useFormData，因其同时触及两组状态。）
 * 接口实例由页面注入（工厂实例），本模块不持有模块级单例。
 */
export function useFormDataSelection({
  api
}: {
  api: Pick<FormDataApi, "formOptions">;
}) {
  const forms = ref<FormDataFormOption[]>([]);
  const selectedFormPk = ref("");
  const selectedForm = computed(
    () => forms.value.find(item => item.pk === selectedFormPk.value) ?? null
  );
  const schemaFields = computed<FormField[]>(
    () => selectedForm.value?.schema?.fields ?? []
  );
  /** 表单清单加载失败：与「暂无表单」区分，页面据此给显式错误态与重试 */
  const formsLoadFailed = ref(false);

  /** 表单选项：全部非模板表单（含停用），默认选中第一个（打开即有数据） */
  const loadForms = async () => {
    const res = await api.formOptions().catch(() => null);
    if (res?.code !== SUCCESS_CODE) {
      formsLoadFailed.value = true;
      return;
    }
    formsLoadFailed.value = false;
    forms.value = (res.data ?? []) as FormDataFormOption[];
    if (!selectedFormPk.value && forms.value.length) {
      selectedFormPk.value = forms.value[0].pk;
    }
  };

  onMounted(loadForms);

  return {
    forms,
    selectedFormPk,
    selectedForm,
    schemaFields,
    formsLoadFailed,
    loadForms
  };
}
