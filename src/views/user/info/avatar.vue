<script lang="ts" setup>
import ReCol from "@/components/ReCol";
import { hasAuth } from "@/router/utils";
import croppingUpload from "@/components/AvatarUpload/index.vue";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "editUserAvatar"
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

function onCropper({ blob }) {
  avatarInfo.value = blob;
}
</script>

<template>
  <el-form ref="ruleFormRef" label-width="82px">
    <el-row :gutter="30">
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('user.avatar')">
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
        v-if="hasAuth('upload:UserInfoAvatar')"
        :title="t('buttons.hsconfirmdupdate')"
        @confirm="handleUpdate"
      >
        <template #reference>
          <el-button>{{ t("buttons.hssave") }}</el-button>
        </template>
      </el-popconfirm>
    </el-form-item>
  </el-form>
</template>
