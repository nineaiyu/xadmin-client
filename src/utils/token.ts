import { getRefreshToken, getToken, setToken } from "@/utils/auth";
import { refreshTokenApi } from "@/api/auth";

export async function getUsedAccessToken() {
  const accessToken = getToken();
  if (accessToken) {
    return accessToken;
  } else {
    const RefreshToken = getRefreshToken();
    if (RefreshToken) {
      const res = await refreshTokenApi({ refresh: RefreshToken });
      setToken(res.data);
      return getToken();
    }
  }
}
