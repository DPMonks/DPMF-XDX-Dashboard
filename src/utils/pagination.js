export const LIST_PAGE_SIZE = 100;

export function pageCount(total, pageSize = LIST_PAGE_SIZE) {
  const n = Number(total);
  const size = Number(pageSize);
  if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(size) || size <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(n / size));
}

export function currentPage(page, total, pageSize = LIST_PAGE_SIZE) {
  const last = pageCount(total, pageSize);
  const next = Math.trunc(Number(page)) || 1;
  return Math.min(Math.max(1, next), last);
}

export function pageSlice(rows, page, pageSize = LIST_PAGE_SIZE) {
  const list = Array.isArray(rows) ? rows : [];
  const size = Number(pageSize) > 0 ? Number(pageSize) : LIST_PAGE_SIZE;
  const current = currentPage(page, list.length, size);
  const start = (current - 1) * size;
  return {
    currentPage: current,
    totalPages: pageCount(list.length, size),
    rows: list.slice(start, start + size),
  };
}

export function shouldSkipOwnerRestPages(existingCount, firstSize) {
  return Number(existingCount) > Number(firstSize);
}

export function mergeOwnerPage(existing, firstPage) {
  const top = Array.isArray(firstPage) ? firstPage : [];
  const seen = new Set(
    top.map((row) => String(row.account || "").toLowerCase()).filter(Boolean)
  );
  const rest = (Array.isArray(existing) ? existing : []).filter(
    (row) => !seen.has(String(row.account || "").toLowerCase())
  );
  return [...top, ...rest];
}

export function shouldFetchMoreRows(loaded, pageSize = LIST_PAGE_SIZE, knownTotal = null) {
  const have = Number(loaded) || 0;
  if (have <= 0) return false;
  const total = Number(knownTotal);
  if (Number.isFinite(total) && total > have) return true;
  return have >= Number(pageSize);
}
