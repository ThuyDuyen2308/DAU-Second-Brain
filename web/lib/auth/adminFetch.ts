// web/lib/auth/adminFetch.ts
/**
 * Wrapper fetch dành riêng cho Admin panel.
 * Tự động đính kèm Authorization: Bearer <token> từ sessionStorage,
 * giúp mỗi tab browser giữ session riêng biệt và không bị ảnh hưởng
 * khi tab khác đăng nhập tài khoản khác.
 */
export function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  let token: string | null = null;

  // sessionStorage chỉ tồn tại ở browser (không chạy trên server)
  if (typeof window !== "undefined") {
    token = sessionStorage.getItem("dau_session_token");
  }

  const headers: HeadersInit = {
    ...(init.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  return fetch(input, {
    ...init,
    headers,
    // credentials: "include" để vẫn gửi cookie làm fallback
    credentials: "include",
  });
}
