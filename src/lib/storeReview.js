import * as StoreReview from "expo-store-review";
import * as SecureStore from "expo-secure-store";

const REQUESTED_FLAG_KEY = "store_review_requested";

// 리뷰 저장 성공 콜백에서 호출. 내 리뷰 총 개수가 정확히 3개가 되는 순간에만 호출해야 함.
// 실패해도 리뷰 저장 흐름에 영향 없도록 내부에서 모두 try/catch 처리.
export async function maybeRequestStoreReview(myReviewCount) {
  if (myReviewCount !== 3) return;

  try {
    const alreadyRequested = await SecureStore.getItemAsync(REQUESTED_FLAG_KEY);
    if (alreadyRequested) return;

    const canRequest = await StoreReview.hasAction();
    if (!canRequest) return;

    await StoreReview.requestReview();
    await SecureStore.setItemAsync(REQUESTED_FLAG_KEY, "true");
  } catch (err) {
    console.warn("[storeReview] 별점 요청 실패:", err);
  }
}
