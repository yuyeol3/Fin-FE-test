import client from "./client";

// /search/** 는 인증 없이도 호출된다. 토큰이 있으면 Tab B와 상세 지표가 열린다.
export async function searchProducts(request) {
  const res = await client.post("/search/products", request);
  return res.data;
}

// searchInput이 빈 문자열이면 전체 카탈로그가 내려온다.
// 목록에 필요한 baseRate/maxRate를 한 번에 얻는 유일한 통로다.
export async function fetchProductCatalog(searchInput = "") {
  const res = await client.get("/search/products", { params: { searchInput } });
  return res.data ?? [];
}

export async function fetchProductDetail(productId, body) {
  const res = await client.post(`/search/products/${productId}/detail`, body ?? null);
  return res.data;
}

// 가구원 수에 맞는 중위소득 기준을 받아온다.
// options / detailedOptions 는 @NotNull 이라 최소 형태라도 반드시 보내야 한다.
export async function fetchDynamicForm(householdSize) {
  const res = await client.post("/search/dynamic-form", {
    options: [],
    detailedOptions: { householdSize },
  });
  return res.data;
}

export async function simulateCalculator(body) {
  const res = await client.post("/calculator", body);
  return res.data;
}

export async function fetchBankProviders() {
  const res = await client.get("/providers/banks");
  return res.data ?? [];
}
