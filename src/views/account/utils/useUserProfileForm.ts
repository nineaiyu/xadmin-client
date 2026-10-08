import { computed, onMounted, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PlusColumn, RecordType } from "plus-pro-components";
import { useUserStoreHook } from "@/store/modules/user";
import { formatFormColumns, formatOptions } from "@/views/system/hooks";
import { handleOperation } from "@/components/RePlusPage";
import { useApiAuth } from "./useApiAuth";
import { useAvatarUpload } from "./useAvatarUpload";

/** 资料页表单（列、更新、头像上传、选择项加载；自 utils/hook 拆出，行为不变） */
export function useUserProfileForm(formRef: Ref) {
  const { t, te } = useI18n();
  const { api, auth } = useApiAuth();
  const userinfoStore = useUserStoreHook();
  const choicesDict = ref<RecordType>({});
  const userInfo = ref({
    username: "",
    nickname: "",
    avatar: "",
    phone: "",
    email: "",
    gender: 0,
    /** 服务端 userinfo 只读下发（人员维度回显），Profile 以标签展示 */
    posts: [] as string[]
  });

  const columns: PlusColumn[] = [
    {
      prop: "avatar",
      valueType: "input"
    },
    {
      prop: "username",
      valueType: "input"
    },
    {
      prop: "nickname",
      valueType: "input"
    },
    {
      prop: "gender",
      valueType: "select",
      // colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
      options: computed(() => {
        return formatOptions(choicesDict.value["gender"]);
      })
    },
    {
      prop: "operation",
      valueType: "input",
      hasLabel: false
    }
  ];
  formatFormColumns({}, columns, t, te, "userinfo");

  const handleUpdate = (row: RecordType) => {
    formRef.value?.formInstance?.validate((valid: boolean) => {
      if (valid) {
        handleOperation({
          t,
          apiReq: api.partialUpdate(
            {},
            {
              username: row.username,
              nickname: row.nickname,
              gender: row.gender
            }
          ),
          success() {
            getUserInfo();
          }
        });
      }
    });
  };

  const getUserInfo = () => {
    userinfoStore.getUserInfo().then(res => {
      Object.assign(userInfo.value, res.data);
    });
  };
  onMounted(() => {
    getUserInfo();
    api.choices().then(res => {
      choicesDict.value = res.choices_dict;
    });
  });

  const { handleUpload } = useAvatarUpload({ api, onUploaded: getUserInfo });

  return {
    t,
    api,
    auth,
    columns,
    userInfo,
    choicesDict,
    userinfoStore,
    getUserInfo,
    handleUpload,
    handleUpdate
  };
}
