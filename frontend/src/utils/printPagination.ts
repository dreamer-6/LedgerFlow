/**
 * printPagination.ts — Deterministic A4 Multi-Page Pagination Engine
 *
 * Implements automatic, content-aware pagination for multi-page documents (Invoices & Quotations)
 * ensuring exact A4 physical page boundaries, repeated continuation headers,
 * repeated table column headers, and graceful totals/footer placement.
 */

export interface PaginationConfig {
  totalPageHeight: number;        // Total printable height in px (e.g. 1000px for A4)
  page1HeaderHeight: number;      // Height of full header + parties card on Page 1
  continuationHeaderHeight: number; // Height of compact header on Page 2..N
  tableHeaderHeight: number;      // Height of repeated table column headers
  footerHeight: number;           // Height of totals + amount in words + terms + bank + signature
  pageNumberHeight: number;       // Height of bottom page numbering bar
  minItemsOnFinalPageWithFooter?: number;
}

export interface PageChunk<T> {
  pageIndex: number;
  totalPages: number;
  items: T[];
  isFirstPage: boolean;
  isLastPage: boolean;
  hasFooter: boolean;
}

export const DEFAULT_A4_PAGINATION_CONFIG: PaginationConfig = {
  totalPageHeight: 1020,
  page1HeaderHeight: 290,
  continuationHeaderHeight: 52,
  tableHeaderHeight: 40,
  footerHeight: 330,
  pageNumberHeight: 30,
  minItemsOnFinalPageWithFooter: 1
};

/**
 * Calculates deterministic line item height based on description length, serial number, etc.
 */
export function estimateItemRowHeight(item: {
  description?: string;
  itemName?: string;
  subtext?: string;
  serialNumber?: string;
}): number {
  let height = 36; // Base row height
  const name = item.itemName || item.description || '';
  if (name.length > 40) {
    height += 16 * Math.floor(name.length / 40);
  }
  const sub = item.subtext || item.serialNumber || '';
  if (sub) {
    height += 16;
  }
  return height;
}

/**
 * Paginates an arbitrary array of items into discrete A4 page chunks.
 * Guarantee invariants:
 * 1. No item is duplicated or lost.
 * 2. Order of items is strictly preserved.
 * 3. Page count is accurate (Page X of Y).
 * 4. Totals & footer are NEVER placed before remaining items.
 * 5. If footer cannot fit with remaining items, it cleanly flows to an overflow final page.
 */
export function paginateItems<T>(
  items: T[],
  getItemHeight: (item: T) => number,
  config: PaginationConfig = DEFAULT_A4_PAGINATION_CONFIG
): PageChunk<T>[] {
  if (!items || items.length === 0) {
    return [
      {
        pageIndex: 0,
        totalPages: 1,
        items: [],
        isFirstPage: true,
        isLastPage: true,
        hasFooter: true
      }
    ];
  }

  // Calculate item heights
  const itemHeights = items.map(getItemHeight);
  const totalItemHeight = itemHeights.reduce((sum, h) => sum + h, 0);

  // Check if everything fits on a single page
  const page1CapacityWithFooter =
    config.totalPageHeight -
    config.page1HeaderHeight -
    config.tableHeaderHeight -
    config.footerHeight -
    config.pageNumberHeight;

  if (totalItemHeight <= page1CapacityWithFooter) {
    return [
      {
        pageIndex: 0,
        totalPages: 1,
        items: [...items],
        isFirstPage: true,
        isLastPage: true,
        hasFooter: true
      }
    ];
  }

  // Multi-page distribution
  const pages: { items: T[]; hasFooter: boolean }[] = [];
  let currentIndex = 0;
  let isFirst = true;

  while (currentIndex < items.length) {
    const isContinuation = !isFirst;
    const headerH = isFirst ? config.page1HeaderHeight : config.continuationHeaderHeight;
    const availableHeightWithoutFooter =
      config.totalPageHeight - headerH - config.tableHeaderHeight - config.pageNumberHeight;
    const availableHeightWithFooter = availableHeightWithoutFooter - config.footerHeight;

    // Check if ALL remaining items can fit on this page WITH the footer
    let remainingHeight = 0;
    for (let i = currentIndex; i < items.length; i++) {
      remainingHeight += itemHeights[i];
    }

    if (remainingHeight <= availableHeightWithFooter) {
      // All remaining items and the footer fit on this page!
      pages.push({
        items: items.slice(currentIndex),
        hasFooter: true
      });
      break;
    }

    // Not everything fits with footer. Pack as many items as possible on this page.
    let currentHeight = 0;
    let itemsForThisPage: T[] = [];
    let nextIndex = currentIndex;

    while (nextIndex < items.length) {
      const h = itemHeights[nextIndex];
      if (currentHeight + h > availableHeightWithoutFooter && itemsForThisPage.length > 0) {
        break;
      }
      currentHeight += h;
      itemsForThisPage.push(items[nextIndex]);
      nextIndex++;
    }

    // Safety check: ensure at least 1 item is placed to prevent infinite loop
    if (itemsForThisPage.length === 0 && nextIndex < items.length) {
      itemsForThisPage.push(items[nextIndex]);
      nextIndex++;
    }

    pages.push({
      items: itemsForThisPage,
      hasFooter: false
    });

    currentIndex = nextIndex;
    isFirst = false;
  }

  // If the last page does not have the footer, add a final page for the footer
  if (pages.length > 0 && !pages[pages.length - 1].hasFooter) {
    pages.push({
      items: [],
      hasFooter: true
    });
  }

  const totalPages = pages.length;

  return pages.map((page, idx) => ({
    pageIndex: idx,
    totalPages,
    items: page.items,
    isFirstPage: idx === 0,
    isLastPage: idx === totalPages - 1,
    hasFooter: page.hasFooter
  }));
}
