import { onMounted, ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { approvalRuleApi } from "@/api/approval/approvalRule";

/** 用户候选项（值=用户名；label 形如「昵称(用户名)」） */
export type AssigneeCandidateUser = { username: string; label: string };
/** 角色/岗位候选项（值=code） */
export type AssigneeCandidateOption = { code: string; name: string };

/**
 * 审批人候选目录（流程节点编辑器与审批规则表单共用）。
 *
 * 数据来自审批模块自带的 candidate-options 端点（不依赖可独立裁剪的全局搜索模块）：
 * 单次拉全量 + 前端本地过滤；被服务端截断时置 candidateTruncated，页面据此提示
 * 「细化搜索」。用户下拉允许直接输入兜底（allow-create），已选用户经
 * ensureUserOption 并回选项，避免未搜索时看不到已选人员。
 */
export function useAssigneeCandidates() {
  /** 候选用户全量（本地过滤的数据源） */
  const allUsers = ref<AssigneeCandidateUser[]>([]);
  /** 下拉当前展示项（初始=全量；搜索后=命中项 + 已选未命中项） */
  const userOptions = ref<AssigneeCandidateUser[]>([]);
  const userLoading = ref(false);
  const candidateTruncated = ref(false);
  const roleOptions = ref<AssigneeCandidateOption[]>([]);
  const postOptions = ref<AssigneeCandidateOption[]>([]);

  /** 已选用户并入选项：未搜索时也能看到已选人员（后端只存用户名，无法反查昵称） */
  function ensureUserOption(username: string) {
    if (!username) return;
    if (!userOptions.value.some(item => item.username === username)) {
      userOptions.value.push({ username, label: username });
    }
  }

  /** 本地过滤（下拉远程搜索回调）：命中用户名或昵称；未命中的已选项保留在列表里 */
  function searchUsers(query: string) {
    userLoading.value = true;
    try {
      const keyword = query.trim().toLowerCase();
      const matched = keyword
        ? allUsers.value.filter(
            item =>
              item.username.toLowerCase().includes(keyword) ||
              item.label.toLowerCase().includes(keyword)
          )
        : allUsers.value;
      const matchedNames = new Set(matched.map(item => item.username));
      userOptions.value = [
        ...matched,
        ...userOptions.value.filter(item => !matchedNames.has(item.username))
      ];
    } finally {
      userLoading.value = false;
    }
  }

  onMounted(async () => {
    const res = await approvalRuleApi.candidateOptions().catch(() => null);
    if (!(res && res.code === SUCCESS_CODE && res.data)) return;
    const data = res.data as {
      users?: Array<{ username: string; nickname?: string }>;
      roles?: Array<{ code: string; name: string }>;
      posts?: Array<{ code: string; name: string }>;
      truncated?: boolean;
    };
    candidateTruncated.value = Boolean(data.truncated);
    allUsers.value = (data.users ?? []).map(user => ({
      username: user.username,
      label: user.nickname
        ? `${user.nickname}(${user.username})`
        : user.username
    }));
    userOptions.value = allUsers.value;
    roleOptions.value = (data.roles ?? []).map(role => ({
      code: role.code,
      name: role.name
    }));
    postOptions.value = (data.posts ?? []).map(post => ({
      code: post.code,
      name: post.name
    }));
  });

  return {
    userOptions,
    userLoading,
    candidateTruncated,
    roleOptions,
    postOptions,
    searchUsers,
    ensureUserOption
  };
}
