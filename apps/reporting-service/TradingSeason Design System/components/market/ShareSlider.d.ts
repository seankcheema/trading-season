/** ShareSlider — range input for share quantity on the order ticket; cyan for buy, red for sell. */
export interface ShareSliderProps {
  value: number;
  max: number;
  onChange?: (value: number) => void;
  tone?: 'buy' | 'sell';
  disabled?: boolean;
  style?: React.CSSProperties;
}
export function ShareSlider(props: ShareSliderProps): JSX.Element;
