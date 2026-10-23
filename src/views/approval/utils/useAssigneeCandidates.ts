import { onMounted, ref } from "vue";
import { isSuccess } from "@/api/types";
import { approvalRuleApi } from "@/api/approval/approvalRule";

/** 用户候选项（值=用户名；label 形如「昵称(用户名)」） */
export type AssigneeCandidateUser = { username: string; label: string };
/** 角色/岗位候选项（值=code） */
export type AssigneeCandidateOption = { code: string; name: string };
export type CandidateFetcher = (params?: {
  keyword?: string;
  limit?: number;
}) => Promise<{ code?: number; data?: unknown }>;

/** 远程搜索单次返回条数：避免 1000 人上限导致后段用户永远选不到 */
const REMOTE_SEARCH_LIMIT = 50;

/**
 * 审批人候选目录（流程节点编辑器与审批规则表单共用）。
 *
 * 初次加载拉取前 1000 个用户 + 角色/岗位；用户输入关键字时走远程搜索，
 * 不再只在本地前 1000 条里过滤。fetcher 由调用方注入：规则页走规则端点，
 * 流程设计器走流程端点（各自与页面 list 权限同口径，避免 403）。
 */
export function useAssigneeCandidates(
  fetcher: CandidateFetcher = approvalRuleApi.candidateOptions
) {
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

  const mapUsers = (rows: Array<{ username: string; nickname?: string }>) =>
    rows.map(user => ({
      username: user.username,
      label: user.nickname
        ? `${user.nickname}(${user.username})`
        : user.username
    }));

  /** 远程搜索（下拉 remote-method）：命中项 + 已选未命中项保留 */
  async function searchUsers(query: string) {
    userLoading.value = true;
    try {
      const res = await fetcher({
        keyword: query,
        limit: REMOTE_SEARCH_LIMIT
      }).catch(() => null);
      if (!(res && isSuccess(res) && res.data)) return;
      const matched = mapUsers(
        ((
          res.data as { users?: Array<{ username: string; nickname?: string }> }
        ).users ?? []) as Array<{ username: string; nickname?: string }>
      );
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
    const res = await fetcher().catch(() => null);
    if (!(res && isSuccess(res) && res.data)) return;
    const data = res.data as {
      users?: Array<{ username: string; nickname?: string }>;
      roles?: Array<{ code: string; name: string }>;
      posts?: Array<{ code: string; name: string }>;
      truncated?: boolean;
    };
    candidateTruncated.value = Boolean(data.truncated);
    userOptions.value = mapUsers(data.users ?? []);
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
