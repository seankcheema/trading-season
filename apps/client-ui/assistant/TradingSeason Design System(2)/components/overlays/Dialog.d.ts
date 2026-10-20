import * as React from 'react';

/**
 * Dialog — modal shell (app-dashboard-dialog / order-submission). Also exports CloseButton.
 * @startingPoint section="Overlays" subtitle="Modal with bordered header and close" viewport="700x320"
 */
export interface DialogProps {
  title: React.ReactNode;
  onClose?: () => void;
  /** max-width px: 448 (form dialogs) or 896 (New Order) */
  width?: number;
  /** 20px body padding; false for split layouts that pad their own columns */
  padded?: boolean;
  closeLabel?: string;
  /** Render without the fixed scrim (for docs / embedding) */
  inline?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export function Dialog(props: DialogProps): JSX.Element;
export function CloseButton(props: { onClick?: () => void; label?: string }): JSX.Element;
