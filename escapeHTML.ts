const escapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
/** escape HTML special characters */
export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (m) => escapeMap[m as "&" | "<" | ">" | '"' | "'"]);
