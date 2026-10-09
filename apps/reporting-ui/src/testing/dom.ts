// Helpers for reading rendered templates in tests. Not part of the application build.

// What an element says, one space between every piece of text. The compiled
// template drops the whitespace between elements, so textContent alone would
// run neighbours together.
export function text(element: Element): string {
  const parts: string[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const part = walker.currentNode.textContent!.replace(/\s+/g, ' ').trim();
    if (part) {
      parts.push(part);
    }
  }
  return parts.join(' ');
}

// The text of each child of a row, cell by cell.
export function cells(row: Element): string[] {
  return Array.from(row.children).map(text);
}
