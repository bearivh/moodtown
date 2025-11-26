/**
 * 일기 데이터 모듈 레벨 캐시
 * 컴포넌트 언마운트와 무관하게 데이터를 유지하여
 * 페이지 이동 시 딜레이를 방지합니다.
 */

// 날짜별 일기 데이터 캐시
const diaryCache = new Map()

// 날짜별 일기 존재 여부 캐시
const hasDiaryCache = new Map()

/**
 * 특정 날짜의 일기 데이터를 캐시에 저장
 * @param {string} date - 날짜 문자열 (YYYY-MM-DD)
 * @param {Array} diaries - 일기 배열
 */
export function setDiariesForDate(date, diaries) {
  if (!date) return
  diaryCache.set(date, diaries)
  hasDiaryCache.set(date, diaries.length > 0)
}

/**
 * 특정 날짜의 일기 데이터를 캐시에서 가져오기
 * @param {string} date - 날짜 문자열 (YYYY-MM-DD)
 * @returns {Array|null} 일기 배열 또는 null (캐시에 없으면)
 */
export function getCachedDiariesForDate(date) {
  if (!date) return null
  return diaryCache.get(date) ?? null
}

/**
 * 특정 날짜에 일기가 있는지 캐시에서 확인
 * @param {string} date - 날짜 문자열 (YYYY-MM-DD)
 * @returns {boolean|null} 일기 존재 여부 또는 null (캐시에 없으면)
 */
export function getCachedHasDiary(date) {
  if (!date) return null
  return hasDiaryCache.get(date) ?? null
}

/**
 * 특정 날짜의 캐시를 삭제
 * @param {string} date - 날짜 문자열 (YYYY-MM-DD)
 */
export function clearDiaryCacheForDate(date) {
  if (!date) return
  diaryCache.delete(date)
  hasDiaryCache.delete(date)
}

/**
 * 모든 캐시 삭제
 */
export function clearAllDiaryCache() {
  diaryCache.clear()
  hasDiaryCache.clear()
}

