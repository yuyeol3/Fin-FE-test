import client from "./client";

// hasProfile이 false면 나머지 필드는 모두 null로 내려온다.
export async function fetchUserProfile() {
  const res = await client.get("/user/me/profile");
  return res.data;
}

// 부분 수정이 아니라 전체 덮어쓰기다. 보낸 필드가 그대로 저장된다.
export function saveUserProfile(body) {
  return client.put("/user/me/profile", body);
}
