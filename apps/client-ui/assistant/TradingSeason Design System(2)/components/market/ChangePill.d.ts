/** ChangePill — rounded-full market change badge (+5.20%) or uppercase side tag (BUY / SELL / DEPOSIT). */
export interface ChangePillProps {
  /** Signed percent; sets tone automatically and renders "+5.20%" when no children */
  value?: number;
  tone?: 'gain' | 'loss' | 'primary' | 'muted';
  /** 10px uppercase tag style at 15% tint */
  tag?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function ChangePill(props: ChangePillProps): JSX.Element;
