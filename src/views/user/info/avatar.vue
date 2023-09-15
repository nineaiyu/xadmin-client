<script setup lang="ts">
import ReCol from "@/components/ReCol";
import { hasAuth } from "@/router/utils";
import croppingUpload from "@/components/AvatarUpload/index.vue";
import { ref } from "vue";

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
function onCropper({ blob }) {
  avatarInfo.value = blob;
}
</script>

<template>
  <el-form ref="ruleFormRef" label-width="82px">
    <el-row :gutter="30">
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item label="用户头像">
          <cropping-upload :img-src="props.avatar" @cropper="onCropper" />
        </el-form-item>
      </re-col>
    </el-row>
    <el-form-item>
      <el-popconfirm
        title="是否确定更新本人头像?"
        @confirm="handleUpdate"
        v-if="hasAuth('update:UserInfoAvatar')"
      >
        <template #reference>
          <el-button>保存</el-button>
        </template>
      </el-popconfirm>
    </el-form-item>
  </el-form>
</template>
