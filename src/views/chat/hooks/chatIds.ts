/**
 * 客户端消息幂等键（32 位十六进制）：优先 WebCrypto randomUUID，无 subtle 环境
 * 回退时间戳 + 随机数。服务端按 client_msg_id 幂等，重发沿用同一键不会重复落库。
 */
export function genClientMsgId(): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return raw.replace(/-/g, "").slice(0, 32);
}
