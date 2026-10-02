import { computed, onMounted, ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import {
  formDataApi,
  type FormDataFormOption,
  type FormField
} from "@/api/dataset/dform";

/**
 * 表单数据（管理端）顶部「选择表单」卡片数据源。
 * 自 useFormData 拆出（行为不变）：全部非模板表单（含停用），默认选中第一个
 * （打开即有数据）；schemaFields 随所选表单联动。
 * （切换表单写请求参数与清空筛选的 watch 留在 useFormData，因其同时触及两组状态。）
 */
export function useFormDataSelection() {
  const forms = ref<FormDataFormOption[]>([]);
  const selectedFormPk = ref("");
  const selectedForm = computed(
    () => forms.value.find(item => item.pk === selectedFormPk.value) ?? null
  );
  const schemaFields = computed<FormField[]>(
    () => selectedForm.value?.schema?.fields ?? []
  );

  /** 表单选项：全部非模板表单（含停用），默认选中第一个（打开即有数据） */
  const loadForms = async () => {
    const res = await formDataApi.formOptions().catch(() => null);
    if (res?.code !== SUCCESS_CODE) return;
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
    schemaFields
  };
}
