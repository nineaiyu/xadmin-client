<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import ReCol from "@/components/ReCol";
import { useApiAuth } from "../utils/hook";
import croppingUpload from "@/components/RePictureUpload";

defineOptions({
  name: "EditUserAvatar"
});

const props = defineProps({
  avatar: String
});

const emit = defineEmits<{
  (e: "handleUpdate", v: object): void;
}>();

const handleUpdate = () => {
  emit("handleUpdate", avatarInfo.value);
};
const avatarInfo = ref();
const { t } = useI18n();
const { auth } = useApiAuth();

function onCropper({ blob }) {
  avatarInfo.value = blob;
}
</script>

<template>
  <el-form ref="ruleFormRef" label-width="82px">
    <el-row :gutter="30">
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('userinfo.avatar')">
          <cropping-upload
            :canvasOption="{ width: 512, height: 512 }"
            :circled="true"
            :img-src="props.avatar"
            :quality="1"
            @cropper="onCropper"
          />
        </el-form-item>
      </re-col>
    </el-row>
    <el-form-item>
      <el-popconfirm
        v-if="auth.upload"
        :title="t('buttons.confirmUpdate')"
        @confirm="handleUpdate"
      >
        <template #reference>
          <el-button>{{ t("buttons.save") }}</el-button>
        </template>
      </el-popconfirm>
    </el-form-item>
  </el-form>
</template>
