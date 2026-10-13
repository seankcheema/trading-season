// Puts text on the clipboard and says whether it got there. navigator.clipboard
// exists only on a secure origin, so a plain-http address on the network takes
// the older selection-based copy instead of failing silently.
export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    );
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  let copied: boolean;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  field.remove();
  return Promise.resolve(copied);
}
