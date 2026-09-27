/** AI 档案用途（与后端 AiProfile.Purpose 同口径）：chat / structured / embedding */
export type AiProfilePurpose = "chat" | "structured" | "embedding";

/** 用途标签词条（表格、抽屉、表单共用；未知值回退对话问答） */
export const purposeLabelKey = (purpose?: string): string => {
  switch (purpose) {
    case "structured":
      return "aiConfig.purposeStructured";
    case "embedding":
      return "aiConfig.purposeEmbedding";
    default:
      return "aiConfig.purposeChat";
  }
};

/** 用途标签配色：结构化=warning、向量化=success、对话=primary */
export const purposeTagType = (
  purpose?: string
): "warning" | "success" | "primary" => {
  if (purpose === "structured") return "warning";
  if (purpose === "embedding") return "success";
  return "primary";
};
