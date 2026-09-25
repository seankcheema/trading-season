/* @ds-bundle: {"format":4,"namespace":"TradingSeasonDesignSystem_86c3eb","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"CardHeader","sourcePath":"components/core/Card.jsx"},{"name":"CardTitle","sourcePath":"components/core/Card.jsx"},{"name":"CardDescription","sourcePath":"components/core/Card.jsx"},{"name":"CardContent","sourcePath":"components/core/Card.jsx"},{"name":"CardFooter","sourcePath":"components/core/Card.jsx"},{"name":"DashCard","sourcePath":"components/core/DashCard.jsx"},{"name":"DashLabel","sourcePath":"components/core/DashCard.jsx"},{"name":"DashLink","sourcePath":"components/core/DashCard.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"Separator","sourcePath":"components/core/Separator.jsx"},{"name":"Label","sourcePath":"components/core/Separator.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"FieldLabel","sourcePath":"components/forms/Field.jsx"},{"name":"FieldDescription","sourcePath":"components/forms/Field.jsx"},{"name":"FieldError","sourcePath":"components/forms/Field.jsx"},{"name":"FieldChecklist","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"NativeSelect","sourcePath":"components/forms/NativeSelect.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"ChangePill","sourcePath":"components/market/ChangePill.jsx"},{"name":"InstrumentSearch","sourcePath":"components/market/InstrumentSearch.jsx"},{"name":"PriceChart","sourcePath":"components/market/PriceChart.jsx"},{"name":"ShareSlider","sourcePath":"components/market/ShareSlider.jsx"},{"name":"Sparkline","sourcePath":"components/market/Sparkline.jsx"},{"name":"TimeframeToggle","sourcePath":"components/market/TimeframeToggle.jsx"},{"name":"SideToggle","sourcePath":"components/market/TimeframeToggle.jsx"},{"name":"CloseButton","sourcePath":"components/overlays/Dialog.jsx"},{"name":"Dialog","sourcePath":"components/overlays/Dialog.jsx"},{"name":"HeaderDropdown","sourcePath":"components/overlays/HeaderDropdown.jsx"},{"name":"MenuItem","sourcePath":"components/overlays/HeaderDropdown.jsx"}],"sourceHashes":{"components/core/Button.jsx":"9055c38a6431","components/core/Card.jsx":"e2d4b61e48d4","components/core/DashCard.jsx":"bf868f535123","components/core/Icon.jsx":"7e2edb8d8ff9","components/core/Separator.jsx":"15476ee8c5b2","components/forms/Field.jsx":"b33e69531a74","components/forms/Input.jsx":"2869fc11a6e5","components/forms/NativeSelect.jsx":"b1d4f2dafa1c","components/forms/Select.jsx":"d42b4b7292d6","components/market/ChangePill.jsx":"13054a102ce0","components/market/InstrumentSearch.jsx":"a4f70c440b50","components/market/PriceChart.jsx":"524ccf695ab5","components/market/ShareSlider.jsx":"61d0cd00e0ca","components/market/Sparkline.jsx":"b878618471c4","components/market/TimeframeToggle.jsx":"39b8641689fb","components/overlays/Dialog.jsx":"f18b521e6f72","components/overlays/HeaderDropdown.jsx":"bb2dbbf8959c","ui_kits/_shared/AppHeader.jsx":"60927f1d40ad","ui_kits/_shared/OrderTicket.jsx":"4f7b4556ce61","ui_kits/_shared/market-data.js":"dc5bdd44abdb","ui_kits/client-ui/AuthScreens.jsx":"9fab357dfc85","ui_kits/client-ui/Dashboard.jsx":"021c53e1935a","ui_kits/client-ui/Dialogs.jsx":"bc78428288ee","ui_kits/client-ui/Landing.jsx":"5e4c5847b18e","ui_kits/client-ui/ViewAllDialogs.jsx":"f20a92b48a6d","ui_kits/instrument-view/CandleChart.jsx":"e47da83eb483","ui_kits/instrument-view/InstrumentView.jsx":"d469b956842e","ui_kits/reporting-ui/ActivityScreen.jsx":"70da7e972bcc","ui_kits/reporting-ui/CustomersScreen.jsx":"7c22a95079e2","ui_kits/reporting-ui/OrdersScreen.jsx":"44b755de7ced","ui_kits/reporting-ui/ReportingShell.jsx":"8177ff0753b8","ui_kits/reporting-ui/reporting-data.js":"686e3d24db11"},"inlinedExternals":[],"unexposedExports":[{"name":"controlStyle","sourcePath":"components/forms/Input.jsx"},{"name":"formatSignedPercent","sourcePath":"components/market/ChangePill.jsx"},{"name":"mockSeries","sourcePath":"components/market/PriceChart.jsx"}]} */

(() => {

const __ds_ns = (window.TradingSeasonDesignSystem_86c3eb = window.TradingSeasonDesignSystem_86c3eb || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// hlmCard: ring-1 foreground/10, bg-card, rounded-xl, --card-spacing 16px (12px when size="sm").
function Card({
  size = 'default',
  radius = 12,
  children,
  style,
  ...rest
}) {
  const sp = size === 'sm' ? 12 : 16;
  const hasFooter = React.Children.toArray(children).some(c => c && c.type === CardFooter);
  return /*#__PURE__*/React.createElement("div", _extends({
    "data-size": size,
    style: {
      '--card-spacing': sp + 'px',
      display: 'flex',
      flexDirection: 'column',
      gap: sp,
      paddingTop: sp,
      paddingBottom: hasFooter ? 0 : sp,
      overflow: 'hidden',
      background: 'var(--card)',
      color: 'var(--card-foreground)',
      borderRadius: radius,
      boxShadow: '0 0 0 1px var(--foreground-10)',
      fontSize: 14,
      ...style
    }
  }, rest), children);
}
function CardHeader({
  children,
  style,
  align,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'grid',
      gap: 4,
      padding: '0 var(--card-spacing)',
      textAlign: align,
      ...style
    }
  }, rest), children);
}
function CardTitle({
  as: Tag = 'h3',
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      margin: 0,
      fontSize: 16,
      lineHeight: 1.375,
      fontWeight: 500,
      ...style
    }
  }, rest), children);
}
function CardDescription({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("p", _extends({
    style: {
      margin: 0,
      fontSize: 14,
      color: 'var(--muted-foreground)',
      ...style
    }
  }, rest), children);
}
function CardContent({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      padding: '0 var(--card-spacing)',
      ...style
    }
  }, rest), children);
}
function CardFooter({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: 'var(--card-spacing)',
      background: 'rgba(26,26,26,.5)',
      borderTop: '1px solid var(--border)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/DashCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// .dash-card and .net-worth-card from dashboard.component.css
function DashCard({
  variant = 'default',
  padding = 20,
  as: Tag = 'section',
  children,
  style,
  ...rest
}) {
  const nw = variant === 'net-worth';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      border: '1px solid ' + (nw ? 'rgba(0,187,255,.2)' : 'var(--border)'),
      borderRadius: 14,
      background: nw ? 'var(--gradient-net-worth)' : 'var(--card)',
      padding,
      minWidth: 0,
      ...style
    }
  }, rest), children);
}

// .dash-label: quiet uppercase section label
function DashLabel({
  as: Tag = 'h2',
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      margin: 0,
      color: 'var(--muted-foreground)',
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      ...style
    }
  }, rest), children);
}

// .dash-link: muted 12px text button that turns cyan on hover
function DashLink({
  children,
  style,
  onClick,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      background: 'none',
      border: 0,
      padding: 0,
      cursor: 'pointer',
      fontSize: 12,
      color: h ? 'var(--primary)' : 'var(--muted-foreground)',
      transition: 'color 150ms',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { DashCard, DashLabel, DashLink });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/DashCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const LUCIDE_BASE = 'https://unpkg.com/lucide-static@0.469.0/icons/';

// Lucide glyph rendered as a currentColor mask so it inherits text color like ng-icon does.
function Icon({
  name,
  size = 16,
  color,
  style,
  label,
  ...rest
}) {
  const url = 'url(' + LUCIDE_BASE + name + '.svg)';
  return /*#__PURE__*/React.createElement("span", _extends({
    role: label ? 'img' : undefined,
    "aria-label": label,
    "aria-hidden": label ? undefined : true,
    style: {
      display: 'inline-block',
      flexShrink: 0,
      width: size,
      height: size,
      backgroundColor: color || 'currentColor',
      WebkitMask: url + ' center / contain no-repeat',
      mask: url + ' center / contain no-repeat',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
const SIZES = {
  xs: {
    height: 24,
    padding: '0 8px',
    fontSize: 12,
    gap: 4,
    borderRadius: 6,
    icon: 12
  },
  sm: {
    height: 28,
    padding: '0 10px',
    fontSize: '0.8rem',
    gap: 4,
    borderRadius: 6,
    icon: 14
  },
  default: {
    height: 32,
    padding: '0 10px',
    fontSize: 14,
    gap: 6,
    borderRadius: 8,
    icon: 16
  },
  lg: {
    height: 36,
    padding: '0 10px',
    fontSize: 14,
    gap: 6,
    borderRadius: 8,
    icon: 16
  },
  cta: {
    height: 48,
    padding: '0 32px',
    fontSize: 16,
    gap: 8,
    borderRadius: 5,
    fontWeight: 600,
    icon: 16
  },
  icon: {
    width: 32,
    height: 32,
    padding: 0,
    borderRadius: 8,
    icon: 16
  },
  'icon-sm': {
    width: 28,
    height: 28,
    padding: 0,
    borderRadius: 6,
    icon: 14
  },
  'icon-lg': {
    width: 36,
    height: 36,
    padding: 0,
    borderRadius: 8,
    icon: 16
  }
};
function variantStyle(variant, hover) {
  switch (variant) {
    case 'outline':
      return {
        background: hover ? 'var(--input-50)' : 'var(--input-30)',
        borderColor: 'var(--input)',
        color: 'var(--foreground)'
      };
    case 'secondary':
      return {
        background: hover ? 'rgba(26,26,26,.8)' : 'var(--secondary)',
        color: 'var(--secondary-foreground)'
      };
    case 'ghost':
      return {
        background: hover ? 'rgba(26,26,26,.5)' : 'transparent',
        color: 'var(--foreground)'
      };
    case 'destructive':
      return {
        background: hover ? 'rgba(255,0,55,.3)' : 'rgba(255,0,55,.2)',
        color: 'var(--destructive)'
      };
    case 'sell':
      return {
        background: hover ? 'var(--loss-85)' : 'var(--color-loss)',
        color: '#fff'
      };
    case 'glass':
      return {
        background: hover ? 'rgba(238,250,255,.12)' : 'rgba(238,250,255,.06)',
        borderColor: 'rgba(238,250,255,.12)',
        color: 'var(--foreground)'
      };
    case 'link':
      return {
        background: 'transparent',
        color: 'var(--primary)',
        textDecoration: hover ? 'underline' : 'none',
        textUnderlineOffset: 4
      };
    default:
      return {
        background: hover ? 'var(--primary-80)' : 'var(--primary)',
        color: 'var(--primary-foreground)'
      };
  }
}
function Button({
  variant = 'default',
  size = 'default',
  radius,
  icon,
  iconEnd,
  fullWidth,
  disabled,
  loading,
  children,
  style,
  onClick,
  type = 'button',
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const s = SIZES[size] || SIZES.default;
  const {
    icon: iconSize,
    ...box
  } = s;
  const off = disabled || loading;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: off,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      border: '1px solid transparent',
      backgroundClip: 'padding-box',
      fontFamily: 'inherit',
      fontWeight: 500,
      cursor: off ? 'not-allowed' : 'pointer',
      transition: 'all 150ms',
      outline: 'none',
      userSelect: 'none',
      opacity: off ? 0.5 : 1,
      transform: press && !off ? 'translateY(1px)' : 'none',
      width: fullWidth ? '100%' : box.width,
      ...box,
      ...(radius != null ? {
        borderRadius: radius
      } : null),
      ...variantStyle(variant, hover && !off),
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSize
  }) : null, children, iconEnd ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconEnd,
    size: iconSize
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Separator.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Separator({
  orientation = 'horizontal',
  style,
  ...rest
}) {
  const v = orientation === 'vertical';
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "separator",
    "aria-orientation": orientation,
    style: {
      flexShrink: 0,
      background: 'var(--border)',
      width: v ? 1 : '100%',
      height: v ? 'auto' : 1,
      alignSelf: v ? 'stretch' : undefined,
      ...style
    }
  }, rest));
}
function Label({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      lineHeight: 1,
      fontWeight: 500,
      userSelect: 'none',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Separator, Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Separator.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// hlmField: vertical stack, gap 8, label + control + description/error.
function Field({
  label,
  htmlFor,
  description,
  error,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "group",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: '100%',
      ...style
    }
  }, rest), label ? /*#__PURE__*/React.createElement(FieldLabel, {
    htmlFor: htmlFor
  }, label) : null, children, description && !error ? /*#__PURE__*/React.createElement(FieldDescription, null, description) : null, error ? /*#__PURE__*/React.createElement(FieldError, null, error) : null);
}
function FieldLabel({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: 'flex',
      width: 'fit-content',
      gap: 8,
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1.375,
      color: 'var(--foreground)',
      userSelect: 'none',
      ...style
    }
  }, rest), children);
}
function FieldDescription({
  children,
  size = 'sm',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("p", _extends({
    style: {
      margin: 0,
      fontSize: size === 'xs' ? 12 : 14,
      lineHeight: 1.5,
      color: 'var(--muted-foreground)',
      ...style
    }
  }, rest), children);
}
function FieldError({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("p", _extends({
    role: "alert",
    style: {
      margin: 0,
      fontSize: 14,
      color: 'var(--destructive)',
      ...style
    }
  }, rest), children);
}
// Password rule checklist from register.component.html
function FieldChecklist({
  items = [],
  style
}) {
  return /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: '4px 0 0',
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      ...style
    }
  }, items.map(it => /*#__PURE__*/React.createElement("li", {
    key: it.label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: it.met ? '#33FF00' : 'var(--muted-foreground)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: it.met ? 'check' : 'x',
    size: 12
  }), it.label)));
}
Object.assign(__ds_scope, { Field, FieldLabel, FieldDescription, FieldError, FieldChecklist });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
function controlStyle({
  focus,
  invalid,
  disabled,
  radius = 8,
  height = 32
}) {
  return {
    height,
    width: '100%',
    minWidth: 0,
    borderRadius: radius,
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--foreground)',
    background: disabled ? 'rgba(238,250,255,.12)' : 'var(--input-30)',
    border: '1px solid ' + (invalid ? 'rgba(255,0,55,.5)' : focus ? 'var(--ring)' : 'var(--input)'),
    boxShadow: focus ? '0 0 0 3px ' + (invalid ? 'rgba(255,0,55,.4)' : 'var(--ring-50)') : 'none',
    outline: 'none',
    transition: 'border-color 150ms, box-shadow 150ms',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : undefined
  };
}
function Input({
  icon,
  reveal,
  type = 'text',
  radius = 8,
  height = 32,
  invalid,
  disabled,
  style,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}) {
  const [focus, setFocus] = useState(false);
  const [shown, setShown] = useState(false);
  const [hov, setHov] = useState(false);
  const realType = reveal ? shown ? 'text' : 'password' : type;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: '100%',
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--muted-foreground)',
      pointerEvents: 'none'
    }
  }) : null, /*#__PURE__*/React.createElement("input", _extends({
    type: realType,
    disabled: disabled,
    "aria-invalid": invalid || undefined,
    onFocus: e => {
      setFocus(true);
      onFocus && onFocus(e);
    },
    onBlur: e => {
      setFocus(false);
      onBlur && onBlur(e);
    },
    style: {
      ...controlStyle({
        focus,
        invalid,
        disabled,
        radius,
        height
      }),
      padding: '4px ' + (reveal ? 32 : 10) + 'px 4px ' + (icon ? 32 : 10) + 'px',
      ...inputStyle
    }
  }, rest)), reveal ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": shown ? 'Hide password' : 'Show password',
    onClick: () => setShown(!shown),
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      position: 'absolute',
      right: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      background: 'transparent',
      border: 0,
      padding: 0,
      cursor: 'pointer',
      color: hov ? 'var(--foreground)' : 'var(--muted-foreground)',
      transition: 'color 150ms'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: shown ? 'eye-off' : 'eye',
    size: 16
  })) : null);
}
Object.assign(__ds_scope, { controlStyle, Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/NativeSelect.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
// hlm-native-select: real <select> with a chevron-down overlay.
function NativeSelect({
  options = [],
  value,
  onChange,
  radius = 8,
  size = 'default',
  invalid,
  disabled,
  style,
  id,
  ...rest
}) {
  const [focus, setFocus] = useState(false);
  const h = size === 'sm' ? 28 : 32;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: '100%',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: id,
    value: value,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.value, e),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      ...__ds_scope.controlStyle({
        focus,
        invalid,
        radius,
        height: h
      }),
      appearance: 'none',
      WebkitAppearance: 'none',
      padding: '4px 32px 4px 10px',
      cursor: 'pointer'
    }
  }, rest), options.map(o => {
    const opt = typeof o === 'object' ? o : {
      value: o,
      label: o
    };
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value,
      style: {
        background: 'var(--popover)'
      }
    }, opt.label);
  })), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 16,
    style: {
      position: 'absolute',
      right: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--muted-foreground)',
      pointerEvents: 'none'
    }
  }));
}
Object.assign(__ds_scope, { NativeSelect });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/NativeSelect.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
const {
  useState,
  useRef,
  useEffect
} = React;
// hlm-select: custom trigger + popover listbox with a check on the active item.
function Select({
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  size = 'default',
  width,
  disabled,
  style
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const ref = useRef(null);
  useEffect(() => {
    const close = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const cur = opts.find(o => o.value === value);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: 'relative',
      width: width || 'fit-content',
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: disabled,
    onClick: () => setOpen(!open),
    style: {
      ...__ds_scope.controlStyle({
        focus: open,
        disabled,
        height: size === 'sm' ? 28 : 32,
        radius: size === 'sm' ? 6 : 8
      }),
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      padding: '0 8px 0 10px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      color: cur ? 'var(--foreground)' : 'var(--muted-foreground)'
    }
  }, /*#__PURE__*/React.createElement("span", null, cur ? cur.label : placeholder), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 16,
    style: {
      color: 'var(--muted-foreground)'
    }
  })), open ? /*#__PURE__*/React.createElement("div", {
    role: "listbox",
    style: {
      position: 'absolute',
      top: 'calc(100% + 4px)',
      left: 0,
      minWidth: '100%',
      zIndex: 40,
      background: 'var(--popover)',
      color: 'var(--popover-foreground)',
      borderRadius: 8,
      boxShadow: '0 0 0 1px var(--foreground-10), var(--shadow-md)',
      padding: 4,
      maxHeight: 288,
      overflowY: 'auto',
      animation: 'ts-pop-in 100ms ease-out'
    }
  }, opts.map((o, i) => /*#__PURE__*/React.createElement("div", {
    key: o.value,
    role: "option",
    "aria-selected": o.value === value,
    onMouseEnter: () => setHi(i),
    onMouseLeave: () => setHi(-1),
    onClick: () => {
      onChange && onChange(o.value);
      setOpen(false);
    },
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 32px 4px 6px',
      borderRadius: 6,
      fontSize: 14,
      cursor: 'default',
      whiteSpace: 'nowrap',
      background: hi === i ? 'var(--accent)' : 'transparent'
    }
  }, o.label, o.value === value ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 16,
    style: {
      position: 'absolute',
      right: 8
    }
  }) : null))) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/market/ChangePill.jsx
try { (() => {
function formatSignedPercent(v) {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

// Rounded-full change badge: gain/loss at 10%, or an uppercase 10px tag (buy / sell / deposit / withdrawal) at 15%.
function ChangePill({
  value,
  tone,
  tag,
  children,
  style
}) {
  const t = tone || (value == null ? 'primary' : value >= 0 ? 'gain' : 'loss');
  const map = {
    gain: ['var(--color-gain)', tag ? 'var(--gain-15)' : 'var(--gain-10)'],
    loss: ['var(--color-loss)', tag ? 'var(--loss-15)' : 'var(--loss-10)'],
    primary: ['var(--primary)', 'var(--primary-15)'],
    muted: ['var(--muted-foreground)', 'var(--muted)']
  };
  const [fg, bg] = map[t] || map.primary;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      borderRadius: 9999,
      padding: '2px 8px',
      fontSize: tag ? 10 : 12,
      fontWeight: 500,
      textTransform: tag ? 'uppercase' : 'none',
      fontVariantNumeric: 'tabular-nums',
      color: fg,
      background: bg,
      whiteSpace: 'nowrap',
      ...style
    }
  }, children != null ? children : formatSignedPercent(value));
}
Object.assign(__ds_scope, { formatSignedPercent, ChangePill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/market/ChangePill.jsx", error: String((e && e.message) || e) }); }

// components/market/InstrumentSearch.jsx
try { (() => {
const {
  useState
} = React;
const money = v => '$' + v.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const pct = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

// app-instrument-search: combobox with symbol/name/price/change rows.
function InstrumentSearch({
  instruments = [],
  onSelect,
  size = 'md',
  placeholder = 'Search',
  style
}) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const term = q.trim().toLowerCase();
  const results = term ? instruments.filter(i => i.symbol.toLowerCase().includes(term) || i.name.toLowerCase().includes(term)) : [];
  const open = focus && term.length > 0;
  const lg = size === 'lg';
  const pick = i => {
    setQ('');
    onSelect && onSelect(i);
  };
  const key = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      results.length && setActive((active + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      results.length && setActive((active - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') setQ('');
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'block',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: lg ? 24 : 16,
    style: {
      position: 'absolute',
      left: 16,
      top: lg ? 35 : 22,
      transform: 'translateY(-50%)',
      color: 'var(--muted-foreground)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "search",
    role: "combobox",
    "aria-expanded": open,
    autoComplete: "off",
    placeholder: placeholder,
    value: q,
    onChange: e => {
      setQ(e.target.value);
      setActive(0);
    },
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    onKeyDown: key,
    style: {
      width: '100%',
      height: lg ? 70 : 44,
      padding: lg ? '0 16px 0 56px' : '0 16px 0 44px',
      fontSize: lg ? 24 : 14,
      borderRadius: 12,
      border: '1px solid ' + (focus ? 'var(--ring)' : 'var(--border)'),
      background: 'var(--card)',
      color: 'var(--foreground)',
      outline: 'none',
      transition: 'border-color 150ms'
    }
  }), open ? /*#__PURE__*/React.createElement("ul", {
    role: "listbox",
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '100%',
      zIndex: 20,
      marginTop: 4,
      maxHeight: 320,
      overflowY: 'auto',
      listStyle: 'none',
      padding: '4px 0',
      borderRadius: 5,
      border: '1px solid var(--border)',
      background: 'var(--popover)',
      boxShadow: 'var(--shadow-lg)'
    }
  }, results.length ? results.map((i, idx) => /*#__PURE__*/React.createElement("li", {
    key: i.symbol,
    role: "option",
    "aria-selected": idx === active,
    onMouseDown: e => e.preventDefault(),
    onMouseEnter: () => setActive(idx),
    onClick: () => pick(i),
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '8px 16px',
      cursor: 'pointer',
      background: idx === active ? 'var(--muted)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontWeight: 600,
      fontSize: 14
    }
  }, i.symbol), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--muted-foreground)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, i.name)), /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      textAlign: 'right',
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block'
    }
  }, money(i.price)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 12,
      color: i.changePercent >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
    }
  }, pct(i.changePercent))))) : /*#__PURE__*/React.createElement("li", {
    style: {
      padding: '8px 16px',
      fontSize: 14,
      color: 'var(--muted-foreground)'
    }
  }, "No instruments match \"", q, "\"")) : null);
}
Object.assign(__ds_scope, { InstrumentSearch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/market/InstrumentSearch.jsx", error: String((e && e.message) || e) }); }

// components/market/PriceChart.jsx
try { (() => {
const {
  useState,
  useRef
} = React;
const W = 100,
  H = 40,
  PAD = 2;
let chartId = 0;
function smooth(c) {
  if (!c.length) return '';
  let d = 'M ' + c[0].x.toFixed(2) + ',' + c[0].y.toFixed(2);
  for (let i = 0; i < c.length - 1; i++) {
    const p = c[i - 1] || c[i],
      cur = c[i],
      n = c[i + 1],
      a = c[i + 2] || n;
    d += ' C ' + (cur.x + (n.x - p.x) / 6).toFixed(2) + ',' + (cur.y + (n.y - p.y) / 6).toFixed(2) + ' ' + (n.x - (a.x - cur.x) / 6).toFixed(2) + ',' + (n.y - (a.y - cur.y) / 6).toFixed(2) + ' ' + n.x.toFixed(2) + ',' + n.y.toFixed(2);
  }
  return d;
}
const money0 = v => '$' + Math.round(v).toLocaleString('en-US');
const money2 = v => '$' + v.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// app-price-chart: smooth gain/loss line, optional area fill, y-axis on the right, hover crosshair + label row.
function PriceChart({
  points = [],
  labels = [],
  area,
  height = 224,
  style
}) {
  const [hover, setHover] = useState(null);
  const plot = useRef(null);
  const [gid] = useState(() => 'ts-pc-' + chartId++);
  if (!points.length) return /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      ...style
    }
  });
  const min = Math.min(...points),
    max = Math.max(...points);
  const range = max - min || 1;
  const yPct = v => (H - PAD - (v - min) / range * (H - PAD * 2)) / H * 100;
  const last = Math.max(points.length - 1, 1);
  const coords = points.map((v, i) => ({
    x: i / last * 100,
    y: yPct(v)
  }));
  const svg = coords.map(c => ({
    x: c.x / 100 * W,
    y: c.y / 100 * H
  }));
  const line = smooth(svg);
  const up = points[points.length - 1] >= points[0];
  const color = up ? 'var(--color-gain)' : 'var(--color-loss)';
  const yTicks = [0, 1, 2, 3, 4].map(i => {
    const v = max - range / 4 * i;
    return {
      v,
      y: yPct(v)
    };
  });
  const xTicks = labels.length ? labels.map((l, i) => ({
    l,
    x: labels.length === 1 ? 0 : i / (labels.length - 1) * 100
  })) : [];
  const edge = x => x < 12 ? 'translateX(0)' : x > 88 ? 'translateX(-100%)' : 'translateX(-50%)';
  const hp = hover != null ? coords[hover] : null;
  const endPt = coords[coords.length - 1];
  const move = e => {
    const r = plot.current.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(t * last));
  };
  const pct = hover != null ? (points[hover] - points[0]) / points[0] * 100 : 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 4.75rem',
      gridTemplateRows: '1.25rem minmax(0,1fr) 1rem',
      columnGap: 12,
      rowGap: 8,
      height,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      minWidth: 0
    }
  }, hp ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: hp.x + '%',
      transform: edge(hp.x),
      whiteSpace: 'nowrap',
      fontSize: 13,
      lineHeight: '20px',
      fontVariantNumeric: 'tabular-nums',
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, money2(points[hover])), /*#__PURE__*/React.createElement("span", {
    style: {
      color: pct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
    }
  }, (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'), labels.length ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--muted-foreground)'
    }
  }, "\xB7 ", labels[Math.round(hover / last * (labels.length - 1))]) : null) : null), /*#__PURE__*/React.createElement("div", null), /*#__PURE__*/React.createElement("div", {
    ref: plot,
    onPointerMove: move,
    onPointerLeave: () => setHover(null),
    style: {
      position: 'relative',
      minHeight: 0,
      borderRadius: 2,
      touchAction: 'pan-y'
    }
  }, hp ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: hp.x + '%',
      width: 1,
      background: 'var(--foreground-40)',
      pointerEvents: 'none'
    }
  }) : null, /*#__PURE__*/React.createElement("svg", {
    viewBox: '0 0 ' + W + ' ' + H,
    preserveAspectRatio: "none",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      overflow: 'visible',
      pointerEvents: 'none'
    },
    "aria-hidden": "true"
  }, area ? /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: gid,
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: up ? '#33ff00' : '#ff0037',
    stopOpacity: "0.28"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: up ? '#33ff00' : '#ff0037',
    stopOpacity: "0"
  }))) : null, yTicks.map(t => /*#__PURE__*/React.createElement("line", {
    key: t.v,
    x1: "0",
    x2: W,
    y1: t.y / 100 * H,
    y2: t.y / 100 * H,
    stroke: "rgba(238,250,255,.09)",
    strokeWidth: "0.5",
    vectorEffect: "non-scaling-stroke"
  })), xTicks.map(t => /*#__PURE__*/React.createElement("line", {
    key: t.l + t.x,
    x1: t.x,
    x2: t.x,
    y1: "0",
    y2: H,
    stroke: "rgba(238,250,255,.0525)",
    strokeWidth: "0.5",
    vectorEffect: "non-scaling-stroke"
  })), /*#__PURE__*/React.createElement("line", {
    x1: "0",
    x2: W,
    y1: H,
    y2: H,
    stroke: "var(--border)",
    strokeWidth: "0.5",
    vectorEffect: "non-scaling-stroke"
  }), area ? /*#__PURE__*/React.createElement("path", {
    d: line + ' L ' + W + ',' + H + ' L 0,' + H + ' Z',
    fill: 'url(#' + gid + ')'
  }) : null, /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke"
  })), hp || endPt ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      zIndex: 10,
      left: (hp || endPt).x + '%',
      top: Math.min(98, Math.max(2, (hp || endPt).y)) + '%',
      width: hp ? 10 : 8,
      height: hp ? 10 : 8,
      borderRadius: '50%',
      transform: 'translate(-50%,-50%)',
      background: color,
      boxShadow: '0 0 0 2px var(--card)',
      pointerEvents: 'none'
    }
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      minHeight: 0,
      borderLeft: '1px solid rgba(238,250,255,.105)',
      textAlign: 'right',
      fontSize: 11,
      color: 'var(--muted-foreground)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, yTicks.map(t => /*#__PURE__*/React.createElement("span", {
    key: t.v,
    style: {
      position: 'absolute',
      right: 0,
      top: t.y + '%',
      transform: 'translateY(-50%)',
      whiteSpace: 'nowrap'
    }
  }, money0(t.v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 16,
      fontSize: 12,
      color: 'var(--muted-foreground)'
    }
  }, xTicks.map(t => /*#__PURE__*/React.createElement("span", {
    key: t.l + t.x,
    style: {
      position: 'absolute',
      top: 0,
      left: t.x + '%',
      transform: edge(t.x),
      whiteSpace: 'nowrap'
    }
  }, t.l))), /*#__PURE__*/React.createElement("div", null));
}

// Deterministic fake series ending at endValue (port of mockPriceSeries).
function mockSeries(seed, count, endValue) {
  let s = 0;
  for (const ch of seed) s = s * 31 + ch.charCodeAt(0) >>> 0;
  const walk = [];
  let v = 100;
  for (let i = 0; i < count; i++) {
    s = s * 1664525 + 1013904223 >>> 0;
    v += (s / 2 ** 32 - 0.45) * 20 / Math.sqrt(count);
    walk.push(v);
  }
  const k = endValue / walk[walk.length - 1];
  return walk.map(w => w * k);
}
Object.assign(__ds_scope, { PriceChart, mockSeries });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/market/PriceChart.jsx", error: String((e && e.message) || e) }); }

// components/market/ShareSlider.jsx
try { (() => {
let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.textContent = '.ts-slider{--fill:0%;--slider-color:var(--primary);appearance:none;-webkit-appearance:none;width:100%;height:16px;background:transparent;cursor:pointer;margin:0}' + '.ts-slider:disabled{cursor:not-allowed;opacity:.5}' + '.ts-slider::-webkit-slider-runnable-track{height:4px;border-radius:9999px;background:linear-gradient(to right,var(--slider-color) var(--fill),var(--muted) var(--fill))}' + '.ts-slider::-moz-range-track{height:4px;border-radius:9999px;background:var(--muted)}.ts-slider::-moz-range-progress{height:4px;border-radius:9999px;background:var(--slider-color)}' + '.ts-slider::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-6px;border:3px solid var(--card);border-radius:9999px;background:var(--slider-color);box-shadow:0 0 0 1px var(--slider-color)}' + '.ts-slider::-moz-range-thumb{width:10px;height:10px;border:3px solid var(--card);border-radius:9999px;background:var(--slider-color);box-shadow:0 0 0 1px var(--slider-color)}';
  document.head.appendChild(s);
}

// Order-ticket share slider; fill is the chosen share of max.
function ShareSlider({
  value = 0,
  max = 0,
  onChange,
  tone = 'buy',
  disabled,
  style
}) {
  inject();
  const fill = max ? value / max * 100 : 0;
  return /*#__PURE__*/React.createElement("input", {
    type: "range",
    "aria-label": "Shares",
    className: "ts-slider",
    min: "0",
    max: max,
    step: "1",
    value: value,
    disabled: disabled || max === 0,
    onChange: e => onChange && onChange(Number(e.target.value)),
    style: {
      '--fill': fill + '%',
      '--slider-color': tone === 'sell' ? 'var(--color-loss)' : 'var(--primary)',
      ...style
    }
  });
}
Object.assign(__ds_scope, { ShareSlider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/market/ShareSlider.jsx", error: String((e && e.message) || e) }); }

// components/market/Sparkline.jsx
try { (() => {
const W = 100,
  H = 24,
  P = 3;

// app-daily-sparkline: dashed baseline at the first value, gain/loss line and end dot.
function Sparkline({
  points = [],
  height = 24,
  style
}) {
  if (!points.length) return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      height,
      ...style
    }
  });
  const base = points[0];
  const min = Math.min(...points, base),
    max = Math.max(...points, base);
  const range = max - min || 1;
  const y = v => H - P - (v - min) / range * (H - P * 2);
  const last = Math.max(points.length - 1, 1);
  const xy = points.map((v, i) => [i / last * W, y(v)]);
  const up = points[points.length - 1] >= base;
  const c = up ? 'var(--color-gain)' : 'var(--color-loss)';
  const d = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
  const end = xy[xy.length - 1];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      height,
      width: '100%',
      minWidth: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: '0 0 ' + W + ' ' + H,
    preserveAspectRatio: "none",
    style: {
      display: 'block',
      width: '100%',
      height: '100%',
      overflow: 'visible'
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "0",
    x2: W,
    y1: y(base),
    y2: y(base),
    stroke: "rgba(238,250,255,.105)",
    strokeWidth: "1",
    strokeDasharray: "3 3",
    vectorEffect: "non-scaling-stroke"
  }), /*#__PURE__*/React.createElement("path", {
    d: d,
    fill: "none",
    stroke: c,
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: end[0],
    cy: end[1],
    r: "1.8",
    fill: c
  })));
}
Object.assign(__ds_scope, { Sparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/market/Sparkline.jsx", error: String((e && e.message) || e) }); }

// components/market/TimeframeToggle.jsx
try { (() => {
const {
  useState
} = React;
const TIMEFRAMES = ['1D', '5D', '1M', '1Y'];
function TimeframeToggle({
  value = '1D',
  onChange,
  options = TIMEFRAMES,
  style
}) {
  const [hov, setHov] = useState(null);
  return /*#__PURE__*/React.createElement("div", {
    role: "group",
    "aria-label": "Chart timeframe",
    style: {
      display: 'flex',
      gap: 2,
      padding: 2,
      borderRadius: 8,
      background: 'var(--muted)',
      width: 'fit-content',
      ...style
    }
  }, options.map(o => {
    const on = o === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o,
      type: "button",
      "aria-pressed": on,
      onClick: () => onChange && onChange(o),
      onMouseEnter: () => setHov(o),
      onMouseLeave: () => setHov(null),
      style: {
        cursor: 'pointer',
        border: 0,
        borderRadius: 6,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 500,
        transition: 'color 150ms, background 150ms',
        background: on ? 'var(--primary)' : 'transparent',
        color: on ? 'var(--primary-foreground)' : hov === o ? 'var(--foreground)' : 'var(--muted-foreground)'
      }
    }, o);
  }));
}

// Buy / Sell order-side segment from order-submission.component.html
function SideToggle({
  value = 'buy',
  onChange,
  style
}) {
  const [hov, setHov] = useState(null);
  return /*#__PURE__*/React.createElement("div", {
    role: "group",
    "aria-label": "Order side",
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 4,
      padding: 4,
      borderRadius: 12,
      background: 'var(--muted)',
      ...style
    }
  }, ['buy', 'sell'].map(o => {
    const on = o === value;
    const bg = on ? o === 'buy' ? 'var(--primary)' : 'var(--color-loss)' : 'transparent';
    const fg = on ? o === 'buy' ? 'var(--primary-foreground)' : '#fff' : hov === o ? 'var(--foreground)' : 'var(--muted-foreground)';
    return /*#__PURE__*/React.createElement("button", {
      key: o,
      type: "button",
      "aria-pressed": on,
      onClick: () => onChange && onChange(o),
      onMouseEnter: () => setHov(o),
      onMouseLeave: () => setHov(null),
      style: {
        height: 36,
        cursor: 'pointer',
        border: 0,
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        textTransform: 'capitalize',
        background: bg,
        color: fg,
        transition: 'color 150ms, background 150ms'
      }
    }, o);
  }));
}
Object.assign(__ds_scope, { TimeframeToggle, SideToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/market/TimeframeToggle.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Dialog.jsx
try { (() => {
const {
  useEffect,
  useState
} = React;
function CloseButton({
  onClick,
  label = 'Close dialog'
}) {
  const [h, setH] = useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 0,
      borderRadius: 8,
      cursor: 'pointer',
      transition: 'all 150ms',
      background: h ? 'var(--muted)' : 'transparent',
      color: h ? 'var(--foreground)' : 'var(--muted-foreground)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 18
  }));
}

// app-dashboard-dialog: blurred scrim, 16px-radius card, bordered header, Escape closes.
function Dialog({
  title,
  onClose,
  width = 448,
  padded = true,
  closeLabel,
  inline,
  children,
  style
}) {
  useEffect(() => {
    const k = e => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  const card = /*#__PURE__*/React.createElement("section", {
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      maxWidth: width,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      boxShadow: 'var(--shadow-dialog)',
      animation: 'ts-pop-in 200ms cubic-bezier(0.16,1,0.3,1) both',
      ...style
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '12px 20px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 14,
      fontWeight: 600
    }
  }, title), /*#__PURE__*/React.createElement(CloseButton, {
    onClick: onClose,
    label: closeLabel
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: padded ? 20 : 0
    }
  }, children));
  if (inline) return card;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflowY: 'auto',
      padding: '48px 16px',
      background: 'var(--scrim)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      animation: 'ts-fade-in 150ms ease-out both'
    }
  }, card);
}
Object.assign(__ds_scope, { CloseButton, Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/overlays/HeaderDropdown.jsx
try { (() => {
const {
  useState,
  useRef,
  useEffect
} = React;
// app-dashboard-header-dropdown: bordered trigger (icon · label · chevron) with a floating panel.
function HeaderDropdown({
  icon,
  label,
  trigger,
  triggerStyle,
  width = 240,
  panelWidth,
  panelStyle,
  open: openProp,
  onOpenChange,
  children,
  style,
  ariaLabel
}) {
  const [inner, setInner] = useState(false);
  const [h, setH] = useState(false);
  const open = openProp != null ? openProp : inner;
  const set = v => {
    setInner(v);
    onOpenChange && onOpenChange(v);
  };
  const ref = useRef(null);
  useEffect(() => {
    const c = e => {
      if (ref.current && !ref.current.contains(e.target)) set(false);
    };
    document.addEventListener('mousedown', c);
    return () => document.removeEventListener('mousedown', c);
  });
  const custom = !!trigger;
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: 'relative',
      minWidth: 0,
      width: custom ? undefined : width,
      flexShrink: custom ? 0 : undefined,
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": ariaLabel,
    "aria-expanded": open,
    onClick: () => set(!open),
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: custom ? {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      borderRadius: 9999,
      border: 0,
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--primary)',
      background: h || open ? 'var(--primary-25)' : 'var(--primary-15)',
      transition: 'background 150ms',
      ...triggerStyle
    } : {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      height: 36,
      padding: '0 12px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      cursor: 'pointer',
      fontSize: 14,
      background: h || open ? 'var(--muted)' : 'var(--card)',
      transition: 'background 150ms',
      ...triggerStyle
    }
  }, custom ? trigger : /*#__PURE__*/React.createElement(React.Fragment, null, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      whiteSpace: 'nowrap',
      textAlign: 'left',
      lineHeight: 1.25,
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, label), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 14,
    style: {
      color: 'var(--muted-foreground)'
    }
  }))), open ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 44,
      right: 0,
      zIndex: 30,
      width: panelWidth || (custom ? 192 : '100%'),
      overflow: 'hidden',
      padding: 4,
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--card)',
      boxShadow: 'var(--shadow-xl)',
      ...panelStyle
    }
  }, typeof children === 'function' ? children(() => set(false)) : children) : null);
}
function MenuItem({
  icon,
  tone,
  children,
  trailing,
  onClick,
  style
}) {
  const [h, setH] = useState(false);
  const danger = tone === 'danger';
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "menuitem",
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      minHeight: 36,
      padding: '6px 8px',
      borderRadius: 8,
      border: 0,
      textAlign: 'left',
      fontSize: 14,
      cursor: 'pointer',
      transition: 'background 150ms',
      color: danger ? 'var(--color-loss)' : tone === 'primary' ? 'var(--primary)' : 'var(--foreground)',
      background: h ? danger ? 'var(--loss-10)' : 'var(--muted)' : 'transparent',
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, children), trailing);
}
Object.assign(__ds_scope, { HeaderDropdown, MenuItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/HeaderDropdown.jsx", error: String((e && e.message) || e) }); }

// ui_kits/_shared/AppHeader.jsx
try { (() => {
(() => {
  const {
    HeaderDropdown,
    MenuItem,
    Icon,
    Button
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    ACCOUNTS,
    money
  } = window.TSData;
  function AppHeader({
    accountId = 1,
    onAccount,
    onSettings,
    onSignOut,
    onLogo,
    left,
    hideLogo,
    clock = 'Sep 14, 2026 · 3:45 PM CT'
  }) {
    const acct = ACCOUNTS.find(a => a.id === accountId) || ACCOUNTS[0];
    return /*#__PURE__*/React.createElement("header", {
      style: {
        display: 'flex',
        minHeight: 64,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }
    }, hideLogo ? null : /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: onLogo,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'none',
        border: 0,
        padding: 0,
        cursor: onLogo ? 'pointer' : 'default'
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/2b-waves.svg",
      alt: "",
      style: {
        width: 32,
        height: 32
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, "TradingSeason")), left), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(HeaderDropdown, {
      icon: "calendar-clock",
      label: clock,
      ariaLabel: "Change simulated market time",
      panelStyle: {
        padding: 12
      }
    }, close => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 500
      },
      className: "tabular-nums"
    }, clock), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, "Range: Jan 2 \u2013 Sep 14, 2026"), /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'block',
        marginTop: 12,
        color: 'var(--muted-foreground)',
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase'
      }
    }, "Simulated time"), /*#__PURE__*/React.createElement("input", {
      type: "datetime-local",
      defaultValue: "2026-09-14T15:45",
      style: {
        marginTop: 8,
        height: 36,
        width: '100%',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--background)',
        padding: '0 12px',
        fontSize: 14,
        colorScheme: 'dark'
      }
    }), /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      fullWidth: true,
      style: {
        marginTop: 12
      },
      onClick: close
    }, "Apply time"))), /*#__PURE__*/React.createElement(HeaderDropdown, {
      icon: "briefcase-business",
      label: acct.name,
      ariaLabel: "Select account"
    }, close => /*#__PURE__*/React.createElement("div", {
      role: "menu"
    }, ACCOUNTS.map(a => /*#__PURE__*/React.createElement(MenuItem, {
      key: a.id,
      onClick: () => {
        onAccount && onAccount(a.id);
        close();
      },
      trailing: a.id === accountId ? /*#__PURE__*/React.createElement(Icon, {
        name: "check",
        color: "var(--primary)"
      }) : null
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block'
      }
    }, a.name), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, "Portfolio ", money(a.id === 1 ? 7604.68 : 21380.4)))), /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: '1px solid var(--border)',
        margin: '4px 0'
      }
    }), /*#__PURE__*/React.createElement(MenuItem, {
      tone: "primary",
      icon: "plus",
      onClick: close
    }, "New account"))), /*#__PURE__*/React.createElement(HeaderDropdown, {
      trigger: "SC",
      ariaLabel: "Open profile menu"
    }, close => /*#__PURE__*/React.createElement("div", {
      role: "menu"
    }, /*#__PURE__*/React.createElement(MenuItem, {
      icon: "settings",
      onClick: () => {
        close();
        onSettings && onSettings();
      }
    }, "Settings"), /*#__PURE__*/React.createElement(MenuItem, {
      icon: "log-out",
      tone: "danger",
      onClick: () => {
        close();
        onSignOut && onSignOut();
      }
    }, "Log out")))));
  }
  window.AppHeader = AppHeader;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/_shared/AppHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/_shared/OrderTicket.jsx
try { (() => {
(() => {
  const {
    SideToggle,
    ShareSlider
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    money,
    POSITIONS
  } = window.TSData;

  // Order ticket column from order-submission.component.html
  function OrderTicket({
    instrument,
    cash = 4820.55,
    onSubmit,
    style
  }) {
    const [side, setSide] = React.useState('buy');
    const [shares, setShares] = React.useState(1);
    const held = (POSITIONS[instrument.symbol] || {}).shares || 0;
    const max = side === 'buy' ? Math.floor(cash / instrument.price) : held;
    const n = Math.min(shares, max);
    const value = n * instrument.price;
    const after = side === 'buy' ? cash - value : cash + value;
    const row = (k, v, strong) => /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        ...(strong ? {
          borderTop: '1px solid var(--border)',
          paddingTop: 8,
          fontWeight: 600
        } : null)
      }
    }, /*#__PURE__*/React.createElement("dt", {
      style: {
        color: strong ? undefined : 'var(--muted-foreground)'
      }
    }, k), /*#__PURE__*/React.createElement("dd", {
      style: {
        margin: 0
      },
      className: "tabular-nums"
    }, v));
    const can = n > 0;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        minWidth: 0,
        flexDirection: 'column',
        ...style
      }
    }, /*#__PURE__*/React.createElement(SideToggle, {
      value: side,
      onChange: s => {
        setSide(s);
        setShares(1);
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("label", {
      htmlFor: "order-shares",
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.025em',
        textTransform: 'uppercase'
      }
    }, "Shares"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 12
      },
      className: "tabular-nums"
    }, max === 0 ? side === 'buy' ? 'Insufficient cash' : 'No shares held' : 'Max ' + max)), /*#__PURE__*/React.createElement("input", {
      id: "order-shares",
      type: "number",
      min: "0",
      max: max,
      value: n,
      disabled: max === 0,
      onChange: e => setShares(Math.max(0, Math.min(max, Number(e.target.value) || 0))),
      style: {
        marginTop: 4,
        width: '100%',
        background: 'transparent',
        border: 0,
        outline: 'none',
        fontSize: 36,
        fontWeight: 600,
        letterSpacing: '-0.025em',
        fontVariantNumeric: 'tabular-nums',
        opacity: max === 0 ? 0.5 : 1
      }
    }), /*#__PURE__*/React.createElement(ShareSlider, {
      value: n,
      max: max,
      tone: side,
      onChange: setShares,
      style: {
        marginTop: 12
      }
    })), /*#__PURE__*/React.createElement("dl", {
      style: {
        margin: '16px 0 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        borderRadius: 12,
        padding: 16,
        fontSize: 14,
        background: 'rgba(26,26,26,.6)'
      }
    }, row('Market price', money(instrument.price)), row('Shares', n), row('Cash before', money(cash)), row('Cash after', money(after)), row('Estimated ' + (side === 'buy' ? 'cost' : 'proceeds'), money(value), true)), /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: 16,
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      disabled: !can,
      onClick: () => onSubmit && onSubmit({
        side,
        shares: n,
        symbol: instrument.symbol
      }),
      style: {
        height: 44,
        width: '100%',
        border: 0,
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        cursor: can ? 'pointer' : 'not-allowed',
        opacity: can ? 1 : 0.4,
        transition: 'background 150ms',
        background: side === 'buy' ? 'var(--primary)' : 'var(--color-loss)',
        color: side === 'buy' ? 'var(--primary-foreground)' : '#fff'
      }
    }, (side === 'buy' ? 'Buy' : 'Sell') + ' ' + n + ' ' + instrument.symbol));
  }
  // Symbol tile from order-submission.component.html
  function InstrumentBadge({
    symbol,
    size = 40
  }) {
    return /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        background: 'var(--primary-15)',
        color: 'var(--primary)',
        fontSize: 12,
        fontWeight: 600
      }
    }, symbol.slice(0, 4));
  }
  Object.assign(window, {
    OrderTicket,
    InstrumentBadge
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/_shared/OrderTicket.jsx", error: String((e && e.message) || e) }); }

// ui_kits/_shared/market-data.js
try { (() => {
// Mock market + account data shared by the UI kits. Instruments and transactions mirror
// apps/client-ui/src/app/dashboard/mock-data.ts; the rest is illustrative.
(function () {
  const INSTRUMENTS = [{
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 316.59,
    change: 15.65,
    changePercent: 5.2
  }, {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    price: 512.3,
    change: 6.12,
    changePercent: 1.21
  }, {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    price: 184.77,
    change: -3.41,
    changePercent: -1.81
  }, {
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    price: 231.05,
    change: 2.88,
    changePercent: 1.26
  }, {
    symbol: 'GOOGL',
    name: 'Alphabet Inc. Class A',
    price: 208.44,
    change: -1.02,
    changePercent: -0.49
  }, {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    price: 347.12,
    change: 12.4,
    changePercent: 3.7
  }, {
    symbol: 'META',
    name: 'Meta Platforms, Inc.',
    price: 741.9,
    change: -9.33,
    changePercent: -1.24
  }, {
    symbol: 'SPCX',
    name: 'Space Exploration Holdings',
    price: 127.43,
    change: 6.3,
    changePercent: 5.2
  }, {
    symbol: 'JPM',
    name: 'JPMorgan Chase & Co.',
    price: 289.61,
    change: 0.84,
    changePercent: 0.29
  }, {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    price: 648.2,
    change: 3.15,
    changePercent: 0.49
  }];
  const TRANSACTIONS = [{
    kind: 'trade',
    symbol: 'TSLA',
    side: 'buy',
    shares: 1,
    price: 301.8,
    date: 'Sep 12'
  }, {
    kind: 'cash',
    reason: 'DEPOSIT',
    value: 2500,
    date: 'Sep 11'
  }, {
    kind: 'trade',
    symbol: 'SPY',
    side: 'buy',
    shares: 3,
    price: 610.5,
    date: 'Sep 10'
  }, {
    kind: 'trade',
    symbol: 'META',
    side: 'sell',
    shares: 2,
    price: 752.1,
    date: 'Sep 8'
  }, {
    kind: 'trade',
    symbol: 'MSFT',
    side: 'buy',
    shares: 2,
    price: 455.0,
    date: 'Sep 3'
  }, {
    kind: 'cash',
    reason: 'WITHDRAWAL',
    value: 800,
    date: 'Aug 30'
  }, {
    kind: 'trade',
    symbol: 'NVDA',
    side: 'buy',
    shares: 10,
    price: 190.25,
    date: 'Aug 28'
  }, {
    kind: 'trade',
    symbol: 'AAPL',
    side: 'buy',
    shares: 4,
    price: 280.1,
    date: 'Aug 21'
  }];
  const POSITIONS = {
    AAPL: {
      shares: 4,
      cost: 280.1
    },
    NVDA: {
      shares: 10,
      cost: 190.25
    },
    MSFT: {
      shares: 2,
      cost: 455.0
    },
    SPY: {
      shares: 3,
      cost: 610.5
    },
    TSLA: {
      shares: 1,
      cost: 301.8
    }
  };
  const ACCOUNTS = [{
    id: 1,
    name: 'Growth'
  }, {
    id: 2,
    name: 'Retirement'
  }];
  function series(seed, count, endValue) {
    let s = 0;
    for (const ch of seed) s = s * 31 + ch.charCodeAt(0) >>> 0;
    const w = [];
    let v = 100;
    for (let i = 0; i < count; i++) {
      s = s * 1664525 + 1013904223 >>> 0;
      v += (s / 2 ** 32 - 0.45) * 20 / Math.sqrt(count);
      w.push(v);
    }
    const k = endValue / w[w.length - 1];
    return w.map(x => x * k);
  }
  function candles(seed, count, endClose) {
    const closes = series(seed, count + 1, endClose);
    let s = 7;
    for (const ch of seed) s = s * 17 + ch.charCodeAt(0) >>> 0;
    const rnd = () => {
      s = s * 1664525 + 1013904223 >>> 0;
      return s / 2 ** 32;
    };
    return closes.slice(1).map((c, i) => {
      const o = closes[i];
      const hi = Math.max(o, c) * (1 + rnd() * 0.006),
        lo = Math.min(o, c) * (1 - rnd() * 0.006);
      return {
        open: o,
        high: hi,
        low: lo,
        close: c,
        volume: Math.round(400000 + rnd() * 1600000)
      };
    });
  }
  const LABELS = {
    '1D': ['9:30 AM', '11:00 AM', '12:30 PM', '2:00 PM', '3:30 PM'],
    '5D': ['Mon 8', 'Tue 9', 'Wed 10', 'Thu 11', 'Fri 12'],
    '1M': ['Aug 18', 'Aug 25', 'Sep 1', 'Sep 8', 'Sep 14'],
    '1Y': ["Oct '25", "Jan '26", "Apr '26", "Jul '26", "Sep '26"]
  };
  const COUNTS = {
    '1D': 27,
    '5D': 35,
    '1M': 22,
    '1Y': 53
  };
  const money = (v, d = 2) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });
  const pct = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  const find = sym => INSTRUMENTS.find(i => i.symbol === sym);
  window.TSData = {
    INSTRUMENTS,
    TRANSACTIONS,
    POSITIONS,
    ACCOUNTS,
    series,
    candles,
    LABELS,
    COUNTS,
    money,
    pct,
    find
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/_shared/market-data.js", error: String((e && e.message) || e) }); }

// ui_kits/client-ui/AuthScreens.jsx
try { (() => {
(() => {
  const {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
    Field,
    FieldChecklist,
    Input,
    NativeSelect,
    Button
  } = window.TradingSeasonDesignSystem_86c3eb;
  function AuthShell({
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 16px',
        background: 'var(--background)'
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/2b-waves-lockup-reversed.svg",
      alt: "TradingSeason",
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 10,
        height: 144,
        width: 'auto'
      }
    }), children);
  }
  const FooterLink = ({
    q,
    link,
    onClick
  }) => /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      color: 'var(--muted-foreground)'
    }
  }, q, " ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onClick();
    },
    style: {
      fontWeight: 500
    }
  }, link));
  function Login({
    go,
    timedOut
  }) {
    const [email, setEmail] = React.useState('');
    const [touched, setTouched] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const bad = touched && !/^\S+@\S+\.\S+$/.test(email);
    const submit = e => {
      e.preventDefault();
      setTouched(true);
      if (!/^\S+@\S+\.\S+$/.test(email)) return;
      setLoading(true);
      setTimeout(() => go('dashboard'), 700);
    };
    return /*#__PURE__*/React.createElement(AuthShell, null, /*#__PURE__*/React.createElement(Card, {
      radius: 10,
      style: {
        width: '100%',
        maxWidth: 384
      }
    }, /*#__PURE__*/React.createElement(CardHeader, {
      align: "center"
    }, /*#__PURE__*/React.createElement(CardTitle, {
      as: "h1",
      style: {
        fontSize: 20
      }
    }, "Welcome back"), /*#__PURE__*/React.createElement(CardDescription, null, "Sign in to your Trading Season account")), /*#__PURE__*/React.createElement(CardContent, null, timedOut ? /*#__PURE__*/React.createElement("p", {
      role: "status",
      style: {
        margin: '0 0 20px',
        padding: '8px 12px',
        borderRadius: 5,
        background: 'var(--muted)',
        fontSize: 14
      }
    }, "You were signed out after a period of inactivity. Sign in again to continue.") : null, /*#__PURE__*/React.createElement("form", {
      onSubmit: submit,
      noValidate: true,
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Email",
      htmlFor: "email",
      error: bad && 'Enter a valid email address.'
    }, /*#__PURE__*/React.createElement(Input, {
      id: "email",
      icon: "mail",
      type: "email",
      radius: 5,
      placeholder: "you@example.com",
      value: email,
      invalid: bad,
      onChange: e => setEmail(e.target.value),
      onBlur: () => setTouched(true)
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Password",
      htmlFor: "password"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "password",
      icon: "lock",
      reveal: true,
      radius: 5,
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      defaultValue: "season2026!"
    })), /*#__PURE__*/React.createElement(Button, {
      type: "submit",
      icon: "log-in",
      radius: 5,
      fullWidth: true,
      loading: loading,
      style: {
        marginTop: 4,
        opacity: loading ? 0.7 : 1
      }
    }, loading ? 'Signing in...' : 'Sign in'))), /*#__PURE__*/React.createElement(CardFooter, {
      style: {
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(FooterLink, {
      q: "Don't have an account?",
      link: "Create one",
      onClick: () => go('register')
    }))));
  }
  function Register({
    go
  }) {
    const [pw, setPw] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const two = {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    };
    return /*#__PURE__*/React.createElement(AuthShell, null, /*#__PURE__*/React.createElement(Card, {
      radius: 10,
      style: {
        width: '100%',
        maxWidth: 448
      }
    }, /*#__PURE__*/React.createElement(CardHeader, {
      align: "center"
    }, /*#__PURE__*/React.createElement(CardTitle, {
      as: "h1",
      style: {
        fontSize: 20
      }
    }, "Create an account"), /*#__PURE__*/React.createElement(CardDescription, null, "Join Trading Season to get started")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("form", {
      onSubmit: e => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => go('dashboard'), 700);
      },
      noValidate: true,
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: two
    }, /*#__PURE__*/React.createElement(Field, {
      label: "First name",
      htmlFor: "fn"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "fn",
      radius: 5,
      placeholder: "Jane"
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Middle name",
      htmlFor: "mn"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "mn",
      radius: 5,
      placeholder: "Optional"
    }))), /*#__PURE__*/React.createElement(Field, {
      label: "Last name",
      htmlFor: "ln"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "ln",
      radius: 5,
      placeholder: "Doe"
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Email",
      htmlFor: "em"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "em",
      icon: "mail",
      type: "email",
      radius: 5,
      placeholder: "you@example.com"
    })), /*#__PURE__*/React.createElement("div", {
      style: two
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Date of birth",
      htmlFor: "dob"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "dob",
      type: "date",
      radius: 5,
      inputStyle: {
        colorScheme: 'dark'
      }
    })), /*#__PURE__*/React.createElement(Field, {
      label: "SSN",
      htmlFor: "ssn"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "ssn",
      reveal: true,
      radius: 5,
      placeholder: "XXX-XX-XXXX",
      maxLength: 11,
      inputStyle: {
        paddingLeft: 10
      }
    }))), /*#__PURE__*/React.createElement(Field, {
      label: "Address",
      htmlFor: "addr"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "addr",
      icon: "map-pin",
      radius: 5,
      placeholder: "123 Main St, Springfield"
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Trader level",
      htmlFor: "lvl"
    }, /*#__PURE__*/React.createElement(NativeSelect, {
      id: "lvl",
      radius: 5,
      options: ['Beginner', 'Intermediate', 'Advanced']
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Available funds",
      htmlFor: "funds"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "funds",
      icon: "dollar-sign",
      type: "number",
      radius: 5,
      placeholder: "5000"
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, "This is just a starting point, not a commitment \u2014 you can deposit or withdraw later. A minimum of $5,000 is required to open an account.")), /*#__PURE__*/React.createElement(Field, {
      label: "Password",
      htmlFor: "pw"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "pw",
      icon: "lock",
      reveal: true,
      radius: 5,
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      value: pw,
      onChange: e => setPw(e.target.value)
    }), /*#__PURE__*/React.createElement(FieldChecklist, {
      items: [{
        label: 'At least 8 characters',
        met: pw.length >= 8
      }, {
        label: 'At least 1 number',
        met: /\d/.test(pw)
      }, {
        label: 'At least 1 special character',
        met: /[^\w\s]/.test(pw)
      }]
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Confirm password",
      htmlFor: "pw2"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "pw2",
      icon: "lock",
      reveal: true,
      radius: 5,
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
    })), /*#__PURE__*/React.createElement(Button, {
      type: "submit",
      icon: "user-plus",
      radius: 5,
      fullWidth: true,
      loading: loading,
      style: {
        marginTop: 4,
        opacity: loading ? 0.7 : 1
      }
    }, loading ? 'Creating account...' : 'Create account'))), /*#__PURE__*/React.createElement(CardFooter, {
      style: {
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(FooterLink, {
      q: "Already have an account?",
      link: "Sign in",
      onClick: () => go('login')
    }))));
  }
  Object.assign(window, {
    Login,
    Register
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui/AuthScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client-ui/Dashboard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
(() => {
  const {
    DashCard,
    DashLabel,
    DashLink,
    InstrumentSearch,
    ChangePill,
    TimeframeToggle,
    PriceChart,
    Sparkline,
    Button
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    INSTRUMENTS,
    TRANSACTIONS,
    POSITIONS,
    series,
    LABELS,
    COUNTS,
    money,
    pct,
    find
  } = window.TSData;
  const head = {
    borderBottom: '1px solid var(--border)',
    paddingBottom: 8,
    color: 'var(--muted-foreground)',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  };
  const COLS = 'minmax(0,1fr) minmax(0,.8fr) minmax(0,.6fr) minmax(0,.9fr) minmax(0,.9fr) minmax(0,.85fr) minmax(0,.75fr) minmax(0,1fr) minmax(0,1fr)';
  const cell = {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };
  const gl = v => ({
    color: v >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
  });
  function Hover({
    children,
    style,
    onClick,
    ...rest
  }) {
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", _extends({
      type: "button",
      onClick: onClick,
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        border: 0,
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
        transition: 'background 150ms',
        background: h ? 'var(--muted)' : 'transparent',
        ...style
      }
    }, rest), children);
  }
  function Dashboard({
    openOrder,
    openCash,
    accountId,
    openAllTransactions,
    openAllAssets
  }) {
    const [tf, setTf] = React.useState('1D');
    const cash = 4820.55;
    const holdings = Object.entries(POSITIONS).map(([sym, p]) => {
      const i = find(sym);
      return {
        i,
        ...p,
        value: p.shares * i.price,
        gl: p.shares * (i.price - p.cost)
      };
    });
    const invested = holdings.reduce((a, h) => a + h.value, 0);
    const pv = accountId === 1 ? invested : 21380.4;
    const alloc = invested / (invested + cash) * 100;
    return /*#__PURE__*/React.createElement("main", {
      style: {
        display: 'grid',
        gap: 12,
        flex: 1,
        minHeight: 0,
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,2.25fr)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        minWidth: 0,
        flexDirection: 'column',
        gap: 12,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement(InstrumentSearch, {
      instruments: INSTRUMENTS,
      onSelect: i => openOrder(i.symbol)
    }), /*#__PURE__*/React.createElement(DashCard, {
      variant: "net-worth",
      style: {
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(DashLabel, null, "Net Worth"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 36,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(invested + cash + 21380.4, 0)), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 20,
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        fontSize: 12
      }
    }, /*#__PURE__*/React.createElement(DashLabel, {
      as: "h3"
    }, "Allocation"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, alloc.toFixed(0), "% invested")), /*#__PURE__*/React.createElement("div", {
      role: "meter",
      "aria-valuenow": alloc.toFixed(0),
      style: {
        marginTop: 8,
        height: 6,
        overflow: 'hidden',
        borderRadius: 9999,
        background: 'rgba(255,255,255,.1)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        width: alloc + '%',
        borderRadius: 9999,
        background: 'var(--primary)'
      }
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '8px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, /*#__PURE__*/React.createElement("span", null, "Invested ", money(invested)), /*#__PURE__*/React.createElement("span", null, "Cash ", money(cash))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 20,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      onClick: () => openCash('deposit')
    }, "Deposit"), /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      variant: "glass",
      onClick: () => openCash('withdraw')
    }, "Withdraw"))), /*#__PURE__*/React.createElement(DashCard, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Recent Transactions"), /*#__PURE__*/React.createElement(DashLink, {
      onClick: openAllTransactions
    }, "View all")), /*#__PURE__*/React.createElement("div", {
      style: {
        ...head,
        marginTop: 16,
        display: 'flex',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("span", null, "Asset"), /*#__PURE__*/React.createElement("span", null, "Value")), /*#__PURE__*/React.createElement("ul", {
      className: "ts-scroll",
      style: {
        listStyle: 'none',
        margin: 0,
        padding: 0,
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 2rem), transparent)'
      }
    }, TRANSACTIONS.map((t, k) => {
      const cashT = t.kind === 'cash';
      const dep = t.reason === 'DEPOSIT';
      return /*#__PURE__*/React.createElement("li", {
        key: k,
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '10px 0',
          fontSize: 14,
          borderBottom: '1px solid var(--border-60)'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 500
        }
      }, cashT ? 'Cash' : t.symbol), /*#__PURE__*/React.createElement(ChangePill, {
        tag: true,
        tone: cashT ? dep ? 'gain' : 'loss' : t.side === 'buy' ? 'primary' : 'loss',
        style: {
          marginLeft: 8
        }
      }, cashT ? dep ? 'deposit' : 'withdrawal' : t.side), /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'block',
          fontSize: 12,
          color: 'var(--muted-foreground)'
        }
      }, t.date)), /*#__PURE__*/React.createElement("span", {
        style: {
          flexShrink: 0,
          textAlign: 'right'
        },
        className: "tabular-nums"
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'block'
        }
      }, cashT ? (dep ? '+' : '-') + money(t.value) : money(t.shares * t.price)), /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'block',
          fontSize: 12,
          color: 'var(--muted-foreground)'
        }
      }, cashT ? 'Cash transfer' : t.shares + ' @ ' + money(t.price))));
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        minWidth: 0,
        flexDirection: 'column',
        gap: 12,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement(DashCard, {
      padding: 6,
      "aria-label": "Market ticker",
      style: {
        display: 'flex',
        height: 44,
        flexShrink: 0,
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 8,
        overflow: 'hidden'
      }
    }, INSTRUMENTS.map(i => /*#__PURE__*/React.createElement(Hover, {
      key: i.symbol,
      onClick: () => openOrder(i.symbol),
      style: {
        display: 'flex',
        height: '100%',
        flexShrink: 0,
        alignItems: 'center',
        gap: 6,
        borderRadius: 8,
        padding: '0 10px',
        fontSize: 14,
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)'
      }
    }, i.symbol), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 500
      },
      className: "tabular-nums"
    }, i.price.toFixed(2)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        ...gl(i.changePercent)
      },
      className: "tabular-nums"
    }, pct(i.changePercent))))), /*#__PURE__*/React.createElement(DashCard, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 2,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(DashLabel, null, "Portfolio Value ", /*#__PURE__*/React.createElement("span", {
      style: {
        textTransform: 'none',
        letterSpacing: 'normal'
      }
    }, "\xB7 ", accountId === 1 ? 'Growth' : 'Retirement')), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        display: 'flex',
        alignItems: 'center',
        columnGap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(pv, 0)), /*#__PURE__*/React.createElement(ChangePill, {
      value: 2.14
    }))), /*#__PURE__*/React.createElement(TimeframeToggle, {
      value: tf,
      onChange: setTf
    })), /*#__PURE__*/React.createElement(PriceChart, {
      area: true,
      points: series('portfolio' + accountId + tf, COUNTS[tf], pv),
      labels: LABELS[tf],
      height: "100%",
      style: {
        marginTop: 4,
        flex: 1,
        minHeight: 0
      }
    })), /*#__PURE__*/React.createElement(DashCard, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 3,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Assets"), /*#__PURE__*/React.createElement(DashLink, {
      onClick: openAllAssets
    }, "View all")), /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: {
        marginTop: 16,
        flex: 1,
        minHeight: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        paddingBottom: 4
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        ...head,
        display: 'grid',
        gridTemplateColumns: COLS,
        gap: 6,
        padding: '0 8px 8px',
        whiteSpace: 'nowrap',
        position: 'sticky',
        top: 0,
        background: 'var(--card)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: cell
    }, "Asset"), /*#__PURE__*/React.createElement("span", {
      style: cell
    }, "Today"), ['Shares', 'Avg Price', 'Price', 'Change', 'Change %', 'Value', 'Value $'].map(h => /*#__PURE__*/React.createElement("span", {
      key: h,
      style: {
        ...cell,
        textAlign: 'right'
      }
    }, h))), holdings.map(h => /*#__PURE__*/React.createElement(Hover, {
      key: h.i.symbol,
      "aria-label": 'Trade ' + h.i.symbol,
      onClick: () => openOrder(h.i.symbol),
      style: {
        display: 'grid',
        width: '100%',
        gridTemplateColumns: COLS,
        alignItems: 'center',
        gap: 6,
        borderRadius: 8,
        padding: '10px 8px',
        fontSize: 14,
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        fontWeight: 500
      }
    }, h.i.symbol), /*#__PURE__*/React.createElement(Sparkline, {
      points: series(h.i.symbol + 'today', 27, h.i.price).map((v, k) => h.i.change < 0 ? 2 * h.i.price - v : v)
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, h.shares), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(h.cost)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(h.i.price)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        ...gl(h.i.change)
      },
      className: "tabular-nums"
    }, (h.i.change >= 0 ? '+' : '') + money(h.i.change)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        ...gl(h.i.changePercent)
      },
      className: "tabular-nums"
    }, pct(h.i.changePercent)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(h.value)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        ...gl(h.gl)
      },
      className: "tabular-nums"
    }, (h.gl >= 0 ? '+' : '') + money(h.gl)))))))));
  }
  window.Dashboard = Dashboard;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client-ui/Dialogs.jsx
try { (() => {
(() => {
  const {
    Dialog,
    InstrumentSearch,
    ChangePill,
    TimeframeToggle,
    PriceChart,
    Field,
    Input,
    NativeSelect,
    Button
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    INSTRUMENTS,
    series,
    LABELS,
    COUNTS,
    money,
    find
  } = window.TSData;
  function OrderDialog({
    symbol,
    onClose,
    onSubmitted,
    onExpand
  }) {
    const [sym, setSym] = React.useState(symbol);
    const [tf, setTf] = React.useState('1D');
    const i = find(sym);
    return /*#__PURE__*/React.createElement(Dialog, {
      title: "New Order",
      width: 896,
      padded: false,
      closeLabel: "Close order submission",
      onClose: onClose
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        minWidth: 0,
        flexDirection: 'column',
        padding: 20,
        borderRight: '1px solid var(--border)'
      }
    }, /*#__PURE__*/React.createElement(InstrumentSearch, {
      instruments: INSTRUMENTS,
      onSelect: x => setSym(x.symbol)
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(InstrumentBadge, {
      symbol: i.symbol
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 18,
        lineHeight: 1.25,
        fontWeight: 600
      }
    }, i.symbol), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, i.name)), onExpand ? /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      iconEnd: "maximize-2",
      onClick: () => onExpand(i.symbol)
    }, "Full view") : null), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(i.price)), /*#__PURE__*/React.createElement(ChangePill, {
      tone: i.change >= 0 ? 'gain' : 'loss'
    }, (i.change >= 0 ? '+' : '') + money(i.change) + ' (' + (i.changePercent >= 0 ? '+' : '') + i.changePercent.toFixed(2) + '%)')), /*#__PURE__*/React.createElement(TimeframeToggle, {
      value: tf,
      onChange: setTf
    })), /*#__PURE__*/React.createElement(PriceChart, {
      points: series(i.symbol + tf, COUNTS[tf], i.price),
      labels: LABELS[tf],
      height: 224,
      style: {
        marginTop: 4
      }
    })), /*#__PURE__*/React.createElement(OrderTicket, {
      instrument: i,
      style: {
        padding: 20
      },
      onSubmit: o => {
        onSubmitted && onSubmitted(o);
        onClose();
      }
    })));
  }
  function CashDialog({
    mode,
    onClose,
    cash
  }) {
    const dep = mode === 'deposit';
    const [amt, setAmt] = React.useState('');
    const [touched, setTouched] = React.useState(false);
    const v = Number(amt);
    const err = !amt || v <= 0 ? 'Enter an amount greater than $0.' : !dep && v > cash ? "That's more than your available cash." : '';
    return /*#__PURE__*/React.createElement(Dialog, {
      title: dep ? 'Deposit funds' : 'Withdraw funds',
      closeLabel: dep ? 'Close deposit' : 'Close withdrawal',
      onClose: onClose
    }, /*#__PURE__*/React.createElement("form", {
      noValidate: true,
      onSubmit: e => {
        e.preventDefault();
        setTouched(true);
        if (!err) onClose();
      },
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Amount",
      htmlFor: "cashAmount",
      error: touched && err,
      description: /*#__PURE__*/React.createElement("span", {
        className: "tabular-nums"
      }, "Available cash: ", money(cash))
    }, /*#__PURE__*/React.createElement(Input, {
      id: "cashAmount",
      type: "number",
      placeholder: "0.00",
      radius: 5,
      value: amt,
      onChange: e => setAmt(e.target.value),
      invalid: touched && !!err
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      radius: 5,
      onClick: onClose
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      type: "submit",
      radius: 5
    }, dep ? 'Deposit' : 'Withdraw'))));
  }
  function SettingsDialog({
    onClose
  }) {
    return /*#__PURE__*/React.createElement(Dialog, {
      title: "Settings",
      closeLabel: "Close settings",
      onClose: onClose
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Security"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "Control how long you stay signed in on this browser.")), /*#__PURE__*/React.createElement(Field, {
      label: "Sign out after inactivity",
      htmlFor: "idle",
      description: "You will be signed out automatically when there is no mouse, keyboard or touch input for this long. Changes apply immediately."
    }, /*#__PURE__*/React.createElement(NativeSelect, {
      id: "idle",
      radius: 5,
      value: "15",
      options: [{
        value: '5',
        label: '5 minutes'
      }, {
        value: '15',
        label: '15 minutes (default)'
      }, {
        value: '30',
        label: '30 minutes'
      }, {
        value: '60',
        label: '60 minutes'
      }]
    }))));
  }
  Object.assign(window, {
    OrderDialog,
    CashDialog,
    SettingsDialog
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui/Dialogs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client-ui/Landing.jsx
try { (() => {
(() => {
  const {
    Button
  } = window.TradingSeasonDesignSystem_86c3eb;

  // Decorative stock graph from landing.component.html (fixed path instead of generated series).
  function LandingGraph() {
    const d = 'M0 330 C90 322 150 300 220 306 S340 262 420 272 S540 236 610 250 S720 196 800 206 S930 150 1000 164 S1110 110 1180 98';
    const ghost = 'M0 350 C120 344 200 330 300 318 S460 300 560 286 S760 262 880 240 S1060 214 1180 190 S1350 170 1440 160';
    return /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        position: 'relative',
        marginTop: 'auto',
        height: '45vh',
        minHeight: 240,
        marginLeft: -32,
        marginRight: -32
      }
    }, /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 1440 420",
      preserveAspectRatio: "none",
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 25%), linear-gradient(to bottom, #000 75%, transparent)',
        WebkitMaskComposite: 'source-in',
        maskImage: 'linear-gradient(to right, transparent, #000 25%), linear-gradient(to bottom, #000 75%, transparent)',
        maskComposite: 'intersect',
        animation: 'ts-reveal 1.6s cubic-bezier(0.65,0,0.35,1) both'
      }
    }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "lg-area",
      x1: "0",
      x2: "0",
      y1: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#00bbff",
      stopOpacity: "0.28"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#00bbff",
      stopOpacity: "0"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "lg-line",
      gradientUnits: "userSpaceOnUse",
      x1: "0",
      x2: "1440",
      y1: "0",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#c6e8f5"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "0.45",
      stopColor: "#58c9f4"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "0.82",
      stopColor: "#00bbff"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "lg-fade",
      gradientUnits: "userSpaceOnUse",
      x1: "940",
      x2: "1180",
      y1: "0",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#fff"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#fff",
      stopOpacity: "0"
    })), /*#__PURE__*/React.createElement("mask", {
      id: "lg-mask",
      maskUnits: "userSpaceOnUse",
      x: "0",
      y: "0",
      width: "1440",
      height: "420"
    }, /*#__PURE__*/React.createElement("rect", {
      width: "1440",
      height: "420",
      fill: "url(#lg-fade)"
    })), /*#__PURE__*/React.createElement("filter", {
      id: "lg-glow",
      x: "-10%",
      y: "-50%",
      width: "120%",
      height: "200%"
    }, /*#__PURE__*/React.createElement("feGaussianBlur", {
      stdDeviation: "6"
    }))), [70, 140, 210, 280, 350].map(y => /*#__PURE__*/React.createElement("line", {
      key: y,
      x1: "0",
      x2: "1440",
      y1: y,
      y2: y,
      stroke: "#eefaff",
      strokeOpacity: "0.06",
      strokeDasharray: "2 6",
      vectorEffect: "non-scaling-stroke"
    })), /*#__PURE__*/React.createElement("path", {
      d: ghost,
      fill: "none",
      stroke: "#58c9f4",
      strokeOpacity: "0.22",
      strokeWidth: "1.5",
      strokeLinejoin: "round",
      vectorEffect: "non-scaling-stroke"
    }), /*#__PURE__*/React.createElement("path", {
      d: d + ' L1180 420 L0 420 Z',
      fill: "url(#lg-area)",
      mask: "url(#lg-mask)"
    }), /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: "#00bbff",
      strokeOpacity: "0.5",
      strokeWidth: "6",
      strokeLinejoin: "round",
      filter: "url(#lg-glow)"
    }), /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: "url(#lg-line)",
      strokeWidth: "2.5",
      strokeLinejoin: "round",
      vectorEffect: "non-scaling-stroke"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 1180 / 1440 * 100 + '%',
        top: 98 / 420 * 100 + '%',
        width: 12,
        height: 12,
        transform: 'translate(-50%,-50%)',
        animation: 'ts-dot-in 0.5s ease-out 1.3s both'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: 'var(--primary)',
        animation: 'ts-pulse 2.4s ease-out infinite'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: 'var(--primary)',
        boxShadow: '0 0 0 4px var(--background)'
      }
    })));
  }
  function Landing({
    go
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '0 32px',
        background: 'var(--background)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '70vh',
        pointerEvents: 'none',
        background: 'var(--texture-hairlines)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 80% at 50% 30%, #000 20%, transparent 75%)',
        maskImage: 'radial-gradient(ellipse 60% 80% at 50% 30%, #000 20%, transparent 75%)'
      }
    }), /*#__PURE__*/React.createElement("header", {
      style: {
        position: 'relative',
        margin: '0 auto',
        display: 'flex',
        height: 112,
        width: '100%',
        maxWidth: 1152,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/2b-waves.svg",
      alt: "",
      style: {
        width: 56,
        height: 56
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, "TradingSeason"))), /*#__PURE__*/React.createElement("main", {
      style: {
        position: 'relative',
        display: 'flex',
        flex: 1,
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement("section", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '80px 8px 0',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: 96,
        lineHeight: 1,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, "Ride the market."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '24px 0 0',
        maxWidth: 576,
        fontSize: 18,
        color: 'var(--muted-foreground)',
        textWrap: 'balance'
      }
    }, "Live prices, instant trades, smarter portfolios. Stay ahead of the market."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 40,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "cta",
      onClick: () => go('register')
    }, "Get started"), /*#__PURE__*/React.createElement(Button, {
      size: "cta",
      variant: "outline",
      radius: 5,
      style: {
        fontWeight: 400,
        background: 'var(--background)',
        borderColor: 'var(--border)'
      },
      onClick: () => go('login')
    }, "Sign in"))), /*#__PURE__*/React.createElement(LandingGraph, null)));
  }
  window.Landing = Landing;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui/Landing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client-ui/ViewAllDialogs.jsx
try { (() => {
(() => {
  const {
    Dialog,
    ChangePill,
    Sparkline,
    Input,
    TimeframeToggle,
    Icon
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    TRANSACTIONS,
    POSITIONS,
    series,
    money,
    pct,
    find
  } = window.TSData;
  const head = {
    color: 'var(--muted-foreground)',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--border)',
    paddingBottom: 8
  };
  const cell = {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };
  const gl = v => ({
    color: v >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
  });
  const dateNum = d => {
    const [m, day] = d.split(' ');
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m) * 100 + +day;
  };
  function Sort({
    k,
    sort,
    setSort,
    align,
    children
  }) {
    const on = sort.key === k;
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setSort({
        key: k,
        dir: on && sort.dir === 'desc' ? 'asc' : 'desc'
      }),
      style: {
        ...cell,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        background: 'none',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        font: 'inherit',
        letterSpacing: 'inherit',
        textTransform: 'inherit',
        color: on ? 'var(--foreground)' : 'inherit'
      }
    }, children, /*#__PURE__*/React.createElement(Icon, {
      name: on ? sort.dir === 'asc' ? 'chevron-up' : 'chevron-down' : 'chevrons-up-down',
      size: 12,
      style: {
        opacity: on ? 1 : 0.6,
        color: on ? 'var(--primary)' : undefined
      }
    }));
  }
  const sorted = (rows, sort, get) => {
    const r = rows.slice().sort((a, b) => {
      const x = get(a, sort.key),
        y = get(b, sort.key);
      return typeof x === 'string' ? x.localeCompare(y) : x - y;
    });
    return sort.dir === 'desc' ? r.reverse() : r;
  };
  function Row({
    children,
    cols,
    onClick
  }) {
    const [h, setH] = React.useState(false);
    const Tag = onClick ? 'button' : 'div';
    return /*#__PURE__*/React.createElement(Tag, {
      type: onClick ? 'button' : undefined,
      onClick: onClick,
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        display: 'grid',
        gridTemplateColumns: cols,
        gap: 8,
        alignItems: 'center',
        width: '100%',
        padding: '10px 8px',
        border: 0,
        borderRadius: 8,
        fontSize: 14,
        textAlign: 'left',
        color: 'inherit',
        cursor: onClick ? 'pointer' : 'default',
        background: h && onClick ? 'var(--muted)' : 'transparent',
        transition: 'background 150ms'
      }
    }, children);
  }
  const Empty = ({
    children
  }) => /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      padding: '32px 8px',
      textAlign: 'center',
      fontSize: 14,
      color: 'var(--muted-foreground)'
    }
  }, children);
  const listBox = {
    maxHeight: 'min(60vh, 520px)',
    overflowY: 'auto'
  };

  // Full transaction history: type filter, search, sortable columns.
  function AllTransactionsDialog({
    onClose,
    openOrder
  }) {
    const [kind, setKind] = React.useState('All');
    const [q, setQ] = React.useState('');
    const [sort, setSort] = React.useState({
      key: 'date',
      dir: 'desc'
    });
    const COLS = 'minmax(0,1fr) minmax(0,.9fr) minmax(0,.9fr) minmax(0,.7fr) minmax(0,.9fr) minmax(0,1fr)';
    const rows = TRANSACTIONS.map(t => ({
      ...t,
      label: t.kind === 'cash' ? 'Cash' : t.symbol,
      type: t.kind === 'cash' ? t.reason === 'DEPOSIT' ? 'deposit' : 'withdrawal' : t.side,
      amount: t.kind === 'cash' ? t.reason === 'DEPOSIT' ? t.value : -t.value : t.shares * t.price
    })).filter(t => (kind === 'All' || (kind === 'Trades' ? t.kind === 'trade' : t.kind === 'cash')) && (!q || t.label.toLowerCase().includes(q.toLowerCase())));
    const list = sorted(rows, sort, (t, k) => k === 'date' ? dateNum(t.date) : k === 'amount' ? Math.abs(t.amount) : k === 'shares' ? t.shares || 0 : k === 'price' ? t.price || 0 : t[k]);
    const tone = t => t.kind === 'cash' ? t.reason === 'DEPOSIT' ? 'gain' : 'loss' : t.side === 'buy' ? 'primary' : 'loss';
    const H = (k, l, a) => /*#__PURE__*/React.createElement(Sort, {
      k: k,
      sort: sort,
      setSort: setSort,
      align: a
    }, l);
    return /*#__PURE__*/React.createElement(Dialog, {
      title: "Transactions",
      width: 880,
      closeLabel: "Close transactions",
      onClose: onClose
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(TimeframeToggle, {
      value: kind,
      onChange: setKind,
      options: ['All', 'Trades', 'Cash']
    }), /*#__PURE__*/React.createElement(Input, {
      icon: "search",
      placeholder: "Filter by symbol",
      value: q,
      onChange: e => setQ(e.target.value),
      style: {
        maxWidth: 220
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, list.length, " transactions")), /*#__PURE__*/React.createElement("div", {
      style: {
        ...head,
        display: 'grid',
        gridTemplateColumns: COLS,
        gap: 8,
        padding: '0 8px 8px'
      }
    }, H('date', 'Date'), H('label', 'Asset'), H('type', 'Type'), H('shares', 'Shares', 'right'), H('price', 'Price', 'right'), H('amount', 'Value', 'right')), /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: listBox
    }, list.length ? list.map((t, k) => /*#__PURE__*/React.createElement(Row, {
      key: k,
      cols: COLS,
      onClick: t.kind === 'trade' ? () => {
        onClose();
        openOrder(t.symbol);
      } : undefined
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, t.date, ", 2026"), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        fontWeight: 500
      }
    }, t.label), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(ChangePill, {
      tag: true,
      tone: tone(t)
    }, t.type)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, t.kind === 'trade' ? t.shares : '—'), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, t.kind === 'trade' ? money(t.price) : '—'), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, t.kind === 'cash' ? (t.amount >= 0 ? '+' : '-') + money(Math.abs(t.amount)) : money(t.amount)))) : /*#__PURE__*/React.createElement(Empty, null, "No transactions match these filters.")));
  }

  // All holdings with totals, sortable columns and allocation share.
  function AllAssetsDialog({
    onClose,
    openOrder
  }) {
    const [sort, setSort] = React.useState({
      key: 'value',
      dir: 'desc'
    });
    const COLS = 'minmax(0,1.4fr) minmax(0,.9fr) minmax(0,.55fr) minmax(0,.85fr) minmax(0,.85fr) minmax(0,.8fr) minmax(0,.95fr) minmax(0,.95fr) minmax(0,.8fr) minmax(0,.9fr)';
    const rows = Object.entries(POSITIONS).map(([sym, p]) => {
      const i = find(sym);
      return {
        sym,
        name: i.name,
        i,
        shares: p.shares,
        cost: p.cost,
        price: i.price,
        change: i.changePercent,
        value: p.shares * i.price,
        gl: p.shares * (i.price - p.cost),
        glPct: (i.price - p.cost) / p.cost * 100
      };
    });
    const total = rows.reduce((a, r) => a + r.value, 0),
      totalGl = rows.reduce((a, r) => a + r.gl, 0),
      totalCost = rows.reduce((a, r) => a + r.shares * r.cost, 0);
    const list = sorted(rows, sort, (r, k) => k === 'weight' ? r.value : r[k]);
    const H = (k, l, a) => /*#__PURE__*/React.createElement(Sort, {
      k: k,
      sort: sort,
      setSort: setSort,
      align: a
    }, l);
    return /*#__PURE__*/React.createElement(Dialog, {
      title: "Assets",
      width: 1120,
      closeLabel: "Close assets",
      onClose: onClose
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
        gap: 12,
        marginBottom: 20
      }
    }, [['Market value', money(total)], ['Cost basis', money(totalCost)], ['Unrealized', (totalGl >= 0 ? '+' : '') + money(totalGl), gl(totalGl).color], ['Positions', rows.length]].map(([k, v, c]) => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 14px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase'
      }
    }, k), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: '-0.025em',
        color: c
      },
      className: "tabular-nums"
    }, v)))), /*#__PURE__*/React.createElement("div", {
      style: {
        ...head,
        display: 'grid',
        gridTemplateColumns: COLS,
        gap: 8,
        padding: '0 8px 8px'
      }
    }, H('sym', 'Asset'), /*#__PURE__*/React.createElement("span", {
      style: cell
    }, "Today"), H('shares', 'Shares', 'right'), H('cost', 'Avg Price', 'right'), H('price', 'Price', 'right'), H('change', 'Change %', 'right'), H('value', 'Value', 'right'), H('gl', 'Value $', 'right'), H('glPct', 'Return', 'right'), H('weight', 'Weight', 'right')), /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: listBox
    }, list.map(r => /*#__PURE__*/React.createElement(Row, {
      key: r.sym,
      cols: COLS,
      onClick: () => {
        onClose();
        openOrder(r.sym);
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontWeight: 500
      }
    }, r.sym), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--muted-foreground)',
        ...cell
      }
    }, r.name)), /*#__PURE__*/React.createElement(Sparkline, {
      points: series(r.sym + 'today', 27, r.price).map(v => r.i.change < 0 ? 2 * r.price - v : v)
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, r.shares), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(r.cost)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(r.price)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right',
        ...gl(r.change)
      },
      className: "tabular-nums"
    }, pct(r.change)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(r.value)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right',
        ...gl(r.gl)
      },
      className: "tabular-nums"
    }, (r.gl >= 0 ? '+' : '') + money(r.gl)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right',
        ...gl(r.glPct)
      },
      className: "tabular-nums"
    }, pct(r.glPct)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8
      },
      className: "tabular-nums"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 36,
        height: 4,
        borderRadius: 9999,
        background: 'rgba(255,255,255,.1)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        height: '100%',
        width: r.value / total * 100 + '%',
        background: 'var(--primary)'
      }
    })), (r.value / total * 100).toFixed(1), "%")))));
  }
  Object.assign(window, {
    AllTransactionsDialog,
    AllAssetsDialog
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui/ViewAllDialogs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/instrument-view/CandleChart.jsx
try { (() => {
(() => {
  const {
    money
  } = window.TSData;
  const {
    Icon
  } = window.TradingSeasonDesignSystem_86c3eb;
  const W = 1000,
    H = 100;
  const MIN_BARS = 20;

  // Bar timestamps for axis labels, per interval, ending at Sep 14 2026 3:55 PM.
  function barLabel(interval, idxFromEnd) {
    const end = Date.UTC(2026, 8, 14, 15, 55);
    const step = {
      '1m': 60e3,
      '5m': 300e3,
      '1h': 3600e3,
      '1D': 86400e3
    }[interval] || 300e3;
    const d = new Date(end - idxFromEnd * step);
    const h = d.getUTCHours(),
      m = d.getUTCMinutes();
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    const time = (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
    if (interval === '1D') return mon + ' ' + d.getUTCDate();
    if (interval === '1h') return mon + ' ' + d.getUTCDate() + ', ' + time;
    return time;
  }
  function ZoomBtn({
    icon,
    label,
    onClick,
    disabled
  }) {
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": label,
      title: label,
      disabled: disabled,
      onClick: onClick,
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 0,
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        background: h && !disabled ? 'var(--muted)' : 'transparent',
        color: h && !disabled ? 'var(--foreground)' : 'var(--muted-foreground)',
        transition: 'all 150ms'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 14
    }));
  }

  // OHLC candles + volume, with wheel/pinch zoom, drag pan, and zoom controls. Styled like PriceChart.
  function CandleChart({
    data: all,
    mode = 'candles',
    ma = true,
    volume = true,
    interval = '5m',
    onHover
  }) {
    const N = all.length;
    const [view, setView] = React.useState(() => ({
      start: Math.max(0, N - 78),
      count: Math.min(78, N)
    }));
    const [hi, setHi] = React.useState(null);
    const [drag, setDrag] = React.useState(null);
    const ref = React.useRef(null);
    const clamp = (start, count) => {
      const c = Math.max(MIN_BARS, Math.min(N, Math.round(count)));
      return {
        start: Math.max(0, Math.min(N - c, Math.round(start))),
        count: c
      };
    };
    const zoomAt = (factor, anchor = 1) => setView(v => {
      const c = Math.max(MIN_BARS, Math.min(N, v.count * factor));
      return clamp(v.start + (v.count - c) * anchor, c);
    });
    React.useEffect(() => {
      const el = ref.current;
      const wheel = e => {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const anchor = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          setView(v => clamp(v.start + e.deltaX / r.width * v.count, v.count));
        } else {
          const f = Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
          setView(v => {
            const c = Math.max(MIN_BARS, Math.min(N, v.count * f));
            return clamp(v.start + (v.count - c) * anchor, c);
          });
        }
      };
      el.addEventListener('wheel', wheel, {
        passive: false
      });
      return () => el.removeEventListener('wheel', wheel);
    }, [N]);
    const data = all.slice(view.start, view.start + view.count);
    const n = data.length;
    const lo = Math.min(...data.map(d => d.low)),
      top = Math.max(...data.map(d => d.high));
    const pad = (top - lo) * 0.06,
      min = lo - pad,
      max = top + pad,
      range = max - min || 1;
    const priceH = volume ? 78 : 98;
    const y = v => (max - v) / range * priceH + 1;
    const step = W / n,
      bw = Math.max(0.6, step * 0.62);
    const vmax = Math.max(...data.map(d => d.volume));
    const maAll = all.map((d, i) => {
      const s = all.slice(Math.max(0, i - 19), i + 1);
      return s.reduce((a, b) => a + b.close, 0) / s.length;
    });
    const maPts = maAll.slice(view.start, view.start + view.count);
    const toPath = arr => arr.map((v, i) => (i ? 'L' : 'M') + (i * step + step / 2).toFixed(1) + ',' + y(v).toFixed(2)).join(' ');
    const ticks = [0, 1, 2, 3, 4].map(i => max - pad - (range - 2 * pad) / 4 * i);
    const up = data[n - 1].close >= data[0].open;
    const last = all[N - 1];
    const lastVisible = view.start + view.count === N;
    const labelIdx = [0, 0.25, 0.5, 0.75, 1].map(t => Math.min(n - 1, Math.round(t * (n - 1))));
    const barAt = clientX => {
      const r = ref.current.getBoundingClientRect();
      return Math.min(n - 1, Math.max(0, Math.floor((clientX - r.left) / r.width * n)));
    };
    const down = e => {
      ref.current.setPointerCapture(e.pointerId);
      setDrag({
        x: e.clientX,
        start: view.start
      });
    };
    const move = e => {
      if (drag) {
        const r = ref.current.getBoundingClientRect();
        setView(v => clamp(drag.start - (e.clientX - drag.x) / r.width * v.count, v.count));
        return;
      }
      const k = barAt(e.clientX);
      setHi(k);
      onHover && onHover(data[k]);
    };
    const up_ = () => setDrag(null);
    const leave = () => {
      if (!drag) {
        setHi(null);
        onHover && onHover(null);
      }
    };
    const key = e => {
      const map = {
        ArrowLeft: () => setView(v => clamp(v.start - Math.max(1, v.count * 0.1), v.count)),
        ArrowRight: () => setView(v => clamp(v.start + Math.max(1, v.count * 0.1), v.count)),
        '+': () => zoomAt(0.8),
        '=': () => zoomAt(0.8),
        '-': () => zoomAt(1.25),
        '0': () => setView(clamp(N - 78, 78))
      };
      if (map[e.key]) {
        e.preventDefault();
        map[e.key]();
      }
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 4.75rem',
        gridTemplateRows: 'minmax(0,1fr) 1rem',
        columnGap: 12,
        rowGap: 8,
        height: '100%',
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      ref: ref,
      tabIndex: 0,
      role: "group",
      "aria-label": "Price chart. Scroll to zoom, drag to pan, arrow keys to move, plus and minus to zoom.",
      onPointerDown: down,
      onPointerMove: move,
      onPointerUp: up_,
      onPointerCancel: up_,
      onPointerLeave: leave,
      onKeyDown: key,
      onDoubleClick: () => setView(clamp(N - 78, 78)),
      style: {
        position: 'relative',
        minHeight: 0,
        cursor: drag ? 'grabbing' : 'crosshair',
        touchAction: 'none',
        outline: 'none',
        borderRadius: 2,
        userSelect: 'none'
      }
    }, /*#__PURE__*/React.createElement("svg", {
      viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: "none",
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      },
      "aria-hidden": "true"
    }, ticks.map(t => /*#__PURE__*/React.createElement("line", {
      key: t,
      x1: "0",
      x2: W,
      y1: y(t),
      y2: y(t),
      stroke: "rgba(238,250,255,.09)",
      strokeWidth: "0.5",
      vectorEffect: "non-scaling-stroke"
    })), labelIdx.map((k, j) => /*#__PURE__*/React.createElement("line", {
      key: 'x' + j,
      x1: k * step + step / 2,
      x2: k * step + step / 2,
      y1: "0",
      y2: H,
      stroke: "rgba(238,250,255,.0525)",
      strokeWidth: "0.5",
      vectorEffect: "non-scaling-stroke"
    })), volume ? /*#__PURE__*/React.createElement("line", {
      x1: "0",
      x2: W,
      y1: priceH + 2,
      y2: priceH + 2,
      stroke: "var(--border)",
      strokeWidth: "0.5",
      vectorEffect: "non-scaling-stroke"
    }) : null, /*#__PURE__*/React.createElement("line", {
      x1: "0",
      x2: W,
      y1: H,
      y2: H,
      stroke: "var(--border)",
      strokeWidth: "0.5",
      vectorEffect: "non-scaling-stroke"
    }), volume ? data.map((d, i) => {
      const h = d.volume / vmax * (H - priceH - 5);
      return /*#__PURE__*/React.createElement("rect", {
        key: 'v' + i,
        x: i * step + (step - bw) / 2,
        y: H - h,
        width: bw,
        height: h,
        fill: d.close >= d.open ? 'rgba(51,255,0,.28)' : 'rgba(255,0,55,.3)'
      });
    }) : null, mode === 'candles' ? data.map((d, i) => {
      const c = d.close >= d.open ? '#33ff00' : '#ff0037';
      const x = i * step + step / 2;
      const bt = y(Math.max(d.open, d.close)),
        bb = y(Math.min(d.open, d.close));
      return /*#__PURE__*/React.createElement("g", {
        key: i,
        opacity: hi == null || hi === i ? 1 : 0.55
      }, /*#__PURE__*/React.createElement("line", {
        x1: x,
        x2: x,
        y1: y(d.high),
        y2: y(d.low),
        stroke: c,
        strokeWidth: "1",
        vectorEffect: "non-scaling-stroke"
      }), /*#__PURE__*/React.createElement("rect", {
        x: x - bw / 2,
        y: bt,
        width: bw,
        height: Math.max(0.25, bb - bt),
        fill: c
      }));
    }) : /*#__PURE__*/React.createElement("path", {
      d: toPath(data.map(d => d.close)),
      fill: "none",
      stroke: up ? 'var(--color-gain)' : 'var(--color-loss)',
      strokeWidth: "2",
      strokeLinejoin: "round",
      vectorEffect: "non-scaling-stroke"
    }), ma ? /*#__PURE__*/React.createElement("path", {
      d: toPath(maPts),
      fill: "none",
      stroke: "#58c9f4",
      strokeWidth: "1.5",
      strokeOpacity: "0.9",
      vectorEffect: "non-scaling-stroke"
    }) : null, last.close >= min && last.close <= max ? /*#__PURE__*/React.createElement("line", {
      x1: "0",
      x2: W,
      y1: y(last.close),
      y2: y(last.close),
      stroke: last.close >= all[0].open ? '#33ff00' : '#ff0037',
      strokeOpacity: "0.5",
      strokeDasharray: "3 4",
      strokeWidth: "1",
      vectorEffect: "non-scaling-stroke"
    }) : null), hi != null && !drag ? /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: (hi + 0.5) / n * 100 + '%',
        width: 1,
        background: 'var(--foreground-40)',
        pointerEvents: 'none'
      }
    }) : null, /*#__PURE__*/React.createElement("div", {
      onPointerDown: e => e.stopPropagation(),
      style: {
        position: 'absolute',
        top: 6,
        left: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        borderRadius: 8,
        background: 'rgba(20,20,20,.85)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(4px)'
      }
    }, /*#__PURE__*/React.createElement(ZoomBtn, {
      icon: "zoom-out",
      label: "Zoom out",
      disabled: view.count >= N,
      onClick: () => zoomAt(1.25)
    }), /*#__PURE__*/React.createElement(ZoomBtn, {
      icon: "zoom-in",
      label: "Zoom in",
      disabled: view.count <= MIN_BARS,
      onClick: () => zoomAt(0.8)
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 1,
        height: 14,
        background: 'var(--border)',
        margin: '0 2px'
      }
    }), /*#__PURE__*/React.createElement(ZoomBtn, {
      icon: "chevron-left",
      label: "Pan left",
      disabled: view.start === 0,
      onClick: () => setView(v => clamp(v.start - v.count * 0.25, v.count))
    }), /*#__PURE__*/React.createElement(ZoomBtn, {
      icon: "chevron-right",
      label: "Pan right",
      disabled: lastVisible,
      onClick: () => setView(v => clamp(v.start + v.count * 0.25, v.count))
    }), /*#__PURE__*/React.createElement(ZoomBtn, {
      icon: "rotate-ccw",
      label: "Reset view",
      onClick: () => setView(clamp(N - 78, 78))
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        padding: '0 6px',
        fontSize: 11,
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, view.count, " bars")), !lastVisible ? /*#__PURE__*/React.createElement("button", {
      type: "button",
      onPointerDown: e => e.stopPropagation(),
      onClick: () => setView(v => clamp(N - v.count, v.count)),
      style: {
        position: 'absolute',
        right: 8,
        bottom: volume ? '24%' : 8,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 26,
        padding: '0 10px',
        borderRadius: 9999,
        border: '1px solid rgba(0,187,255,.4)',
        background: 'var(--primary-15)',
        color: 'var(--primary)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer'
      }
    }, "Latest ", /*#__PURE__*/React.createElement(Icon, {
      name: "chevrons-right",
      size: 12
    })) : null), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        borderLeft: '1px solid rgba(238,250,255,.105)',
        fontSize: 11,
        color: 'var(--muted-foreground)',
        textAlign: 'right',
        overflow: 'hidden'
      },
      className: "tabular-nums"
    }, ticks.map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      style: {
        position: 'absolute',
        right: 0,
        top: y(t) + '%',
        transform: 'translateY(-50%)'
      }
    }, money(t))), last.close >= min && last.close <= max ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        right: 0,
        top: y(last.close) + '%',
        transform: 'translateY(-50%)',
        padding: '1px 5px',
        borderRadius: 4,
        fontWeight: 600,
        color: 'var(--primary-foreground)',
        background: last.close >= all[0].open ? 'var(--color-gain)' : 'var(--color-loss)'
      }
    }, last.close.toFixed(2)) : null, volume ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        right: 0,
        top: priceH + 4 + '%'
      }
    }, "Vol") : null), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        height: 16,
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, labelIdx.map((k, j) => {
      const x = (k + 0.5) / n * 100;
      return /*#__PURE__*/React.createElement("span", {
        key: j,
        style: {
          position: 'absolute',
          left: x + '%',
          transform: x < 12 ? 'none' : x > 88 ? 'translateX(-100%)' : 'translateX(-50%)',
          whiteSpace: 'nowrap'
        }
      }, barLabel(interval, N - 1 - (view.start + k)));
    })), /*#__PURE__*/React.createElement("div", null));
  }
  window.CandleChart = CandleChart;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instrument-view/CandleChart.jsx", error: String((e && e.message) || e) }); }

// ui_kits/instrument-view/InstrumentView.jsx
try { (() => {
(() => {
  const {
    DashCard,
    DashLabel,
    DashLink,
    ChangePill,
    TimeframeToggle,
    Button,
    Icon,
    InstrumentSearch
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    INSTRUMENTS,
    POSITIONS,
    candles,
    money,
    pct,
    find
  } = window.TSData;
  const head = {
    color: 'var(--muted-foreground)',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  };
  const vol = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : (v / 1e3).toFixed(0) + 'K';
  function Stat({
    k,
    v,
    tone
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: head
    }, k), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 14,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        color: tone
      },
      className: "tabular-nums"
    }, v));
  }
  function Toggle({
    on,
    children,
    onClick
  }) {
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-pressed": on,
      onClick: onClick,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 26,
        padding: '0 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        border: '1px solid ' + (on ? 'rgba(0,187,255,.4)' : 'var(--border)'),
        background: on ? 'var(--primary-10)' : 'transparent',
        color: on ? 'var(--primary)' : 'var(--muted-foreground)',
        transition: 'all 150ms'
      }
    }, children);
  }
  function Meter({
    label,
    value,
    hint
  }) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)'
      }
    }, label), /*#__PURE__*/React.createElement("span", {
      className: "tabular-nums"
    }, value.toFixed(2), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 12
      }
    }, "\xB7 ", hint))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        height: 6,
        borderRadius: 9999,
        background: 'rgba(255,255,255,.1)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: value * 100 + '%',
        height: '100%',
        borderRadius: 9999,
        background: 'var(--primary)'
      }
    })));
  }
  function InstrumentView({
    symbol,
    setSymbol
  }) {
    const i = find(symbol);
    const [iv, setIv] = React.useState('5m');
    const [mode, setMode] = React.useState('Candles');
    const [ma, setMa] = React.useState(true);
    const [showVol, setShowVol] = React.useState(true);
    const [hover, setHover] = React.useState(null);
    const data = React.useMemo(() => candles(symbol + iv, 240, i.price), [symbol, iv]);
    const day = data.slice(-78);
    const o = hover || data[data.length - 1];
    const open = day[0].open,
      high = Math.max(...day.map(d => d.high)),
      low = Math.min(...day.map(d => d.low));
    const totalVol = day.reduce((a, d) => a + d.volume, 0);
    const spread = Math.max(0.01, i.price * 0.0004);
    const bid = i.price - spread / 2,
      ask = i.price + spread / 2;
    const pos = POSITIONS[symbol];
    const behaviors = [{
      type: 'Momentum burst',
      start: '2:58 PM',
      dur: '420s',
      strength: 0.72,
      tone: 'gain'
    }, {
      type: 'Volume spike',
      start: '1:12 PM',
      dur: '180s',
      strength: 0.55,
      tone: 'primary'
    }, {
      type: 'Mean reversion',
      start: '11:40 AM',
      dur: '900s',
      strength: 0.38,
      tone: 'loss'
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement(DashCard, {
      padding: 16,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(InstrumentBadge, {
      symbol: i.symbol,
      size: 44
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, i.symbol), /*#__PURE__*/React.createElement(ChangePill, {
      tag: true,
      tone: "muted"
    }, "Equity"), /*#__PURE__*/React.createElement(ChangePill, {
      tag: true,
      tone: "muted"
    }, "SIM")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, i.name))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(i.price)), /*#__PURE__*/React.createElement(ChangePill, {
      tone: i.change >= 0 ? 'gain' : 'loss'
    }, (i.change >= 0 ? '+' : '') + money(i.change) + ' (' + pct(i.changePercent) + ')')), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(6, auto)',
        columnGap: 28,
        marginLeft: 'auto'
      }
    }, /*#__PURE__*/React.createElement(Stat, {
      k: "Bid",
      v: money(bid),
      tone: "var(--color-gain)"
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Ask",
      v: money(ask),
      tone: "var(--color-loss)"
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Spread",
      v: money(spread, 3)
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Day range",
      v: low.toFixed(2) + ' – ' + high.toFixed(2)
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Volume",
      v: vol(totalVol)
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Trend",
      v: "Uptrend",
      tone: "var(--color-gain)"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 360px',
        gap: 12,
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(DashCard, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(TimeframeToggle, {
      value: mode,
      onChange: setMode,
      options: ['Candles', 'Line']
    }), /*#__PURE__*/React.createElement(Toggle, {
      on: ma,
      onClick: () => setMa(!ma)
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 2,
        background: '#58c9f4',
        borderRadius: 1
      }
    }), "MA 20"), /*#__PURE__*/React.createElement(Toggle, {
      on: showVol,
      onClick: () => setShowVol(!showVol)
    }, "Volume")), /*#__PURE__*/React.createElement(TimeframeToggle, {
      value: iv,
      onChange: setIv,
      options: ['1m', '5m', '1h', '1D']
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '12px 0 8px',
        display: 'flex',
        gap: 16,
        fontSize: 13,
        color: 'var(--muted-foreground)',
        minHeight: 20
      },
      className: "tabular-nums"
    }, [['O', o.open], ['H', o.high], ['L', o.low], ['C', o.close]].map(([k, v]) => /*#__PURE__*/React.createElement("span", {
      key: k
    }, k, " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: o.close >= o.open ? 'var(--color-gain)' : 'var(--color-loss)'
      }
    }, v.toFixed(2)))), /*#__PURE__*/React.createElement("span", null, "Vol ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--foreground)'
      }
    }, vol(o.volume))), hover ? null : /*#__PURE__*/React.createElement("span", null, "\xB7 latest bar"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontSize: 12
      }
    }, "Scroll to zoom \xB7 drag to pan \xB7 double-click to reset")), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement(CandleChart, {
      key: symbol + iv,
      data: data,
      mode: mode === 'Candles' ? 'candles' : 'line',
      ma: ma,
      volume: showVol,
      interval: iv,
      onHover: setHover
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(DashCard, null, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Key stats"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        rowGap: 14,
        columnGap: 12
      }
    }, /*#__PURE__*/React.createElement(Stat, {
      k: "Open",
      v: money(open)
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Prev close",
      v: money(i.price - i.change)
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "High",
      v: money(high)
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Low",
      v: money(low)
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Avg volume",
      v: vol(totalVol * 0.86)
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Base volatility",
      v: "0.021"
    }))), /*#__PURE__*/React.createElement(DashCard, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Market state"), /*#__PURE__*/React.createElement(ChangePill, {
      tag: true,
      tone: "gain"
    }, "Uptrend")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Meter, {
      label: "Volatility",
      value: 0.34,
      hint: "moderate"
    }), /*#__PURE__*/React.createElement(Meter, {
      label: "Liquidity",
      value: 0.81,
      hint: "deep"
    }), /*#__PURE__*/React.createElement(Meter, {
      label: "Momentum",
      value: 0.62,
      hint: "building"
    }))), /*#__PURE__*/React.createElement(DashCard, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Market behaviors"), /*#__PURE__*/React.createElement(DashLabel, {
      as: "span",
      style: {
        fontSize: 11
      }
    }, "Today")), /*#__PURE__*/React.createElement("ul", {
      style: {
        listStyle: 'none',
        margin: '10px 0 0',
        padding: 0
      }
    }, behaviors.map(b => /*#__PURE__*/React.createElement("li", {
      key: b.type,
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid var(--border-60)',
        fontSize: 14
      }
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontWeight: 500
      }
    }, b.type), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, b.start, " \xB7 ", b.dur)), /*#__PURE__*/React.createElement(ChangePill, {
      tone: b.tone
    }, 'Strength ' + b.strength.toFixed(2)))))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement(DashCard, {
      padding: 16,
      style: {
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Your position"), /*#__PURE__*/React.createElement(DashLabel, {
      as: "span",
      style: {
        fontSize: 11
      }
    }, "Growth")), pos ? /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        rowGap: 12
      }
    }, /*#__PURE__*/React.createElement(Stat, {
      k: "Shares",
      v: pos.shares
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Avg price",
      v: money(pos.cost)
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Market value",
      v: money(pos.shares * i.price)
    }), /*#__PURE__*/React.createElement(Stat, {
      k: "Unrealized",
      v: (i.price >= pos.cost ? '+' : '') + money(pos.shares * (i.price - pos.cost)),
      tone: i.price >= pos.cost ? 'var(--color-gain)' : 'var(--color-loss)'
    })) : /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '12px 0 0',
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "You don't hold ", i.symbol, " in this account.")), /*#__PURE__*/React.createElement(DashCard, {
      padding: 16,
      style: {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement(OrderTicket, {
      key: symbol,
      instrument: i,
      style: {
        flex: 1
      }
    })))));
  }
  window.InstrumentView = InstrumentView;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instrument-view/InstrumentView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/reporting-ui/ActivityScreen.jsx
try { (() => {
(() => {
  const {
    DashCard,
    DashLabel,
    DashLink,
    ChangePill,
    TimeframeToggle,
    PriceChart,
    Sparkline,
    Button,
    Icon
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    series,
    money
  } = window.TSData;
  const {
    FEED,
    STATUS,
    TOP
  } = window.TSReport;
  const RANGE_LABELS = {
    Today: ['9:30 AM', '11:00 AM', '12:30 PM', '2:00 PM', '3:30 PM'],
    '7D': ['Sep 8', 'Sep 9', 'Sep 10', 'Sep 11', 'Sep 14'],
    '30D': ['Aug 18', 'Aug 25', 'Sep 1', 'Sep 8', 'Sep 14'],
    '90D': ['Jun 16', 'Jul 14', 'Aug 11', 'Sep 8', 'Sep 14']
  };
  const FEED_ICON = {
    fill: ['arrow-right-left', 'var(--primary)'],
    reject: ['circle-x', 'var(--color-loss)'],
    cash: ['wallet', 'var(--color-gain)'],
    lock: ['lock', 'var(--color-loss)']
  };
  function Kpi({
    label,
    value,
    delta,
    note
  }) {
    return /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, /*#__PURE__*/React.createElement(DashLabel, null, label), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '6px 0 0',
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, value), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, delta != null ? /*#__PURE__*/React.createElement(ChangePill, {
      value: delta
    }) : null, /*#__PURE__*/React.createElement("span", null, note)));
  }
  function ActivityScreen({
    go
  }) {
    const [range, setRange] = React.useState('Today');
    const total = STATUS.reduce((a, s) => a + s[1], 0);
    return /*#__PURE__*/React.createElement("div", {
      style: screenRoot
    }, /*#__PURE__*/React.createElement(PageHeader, {
      title: "Activity",
      sub: "Derived from order and cash ledgers \xB7 updated 3:45 PM CT \xB7 simulation session #12",
      right: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TimeframeToggle, {
        value: range,
        onChange: setRange,
        options: ['Today', '7D', '30D', '90D']
      }), /*#__PURE__*/React.createElement(ExportMenu, {
        onCsv: () => downloadCsv('activity-' + range, [['Status', s => s[0]], ['Orders', s => s[1]]], STATUS)
      }))
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0,1fr))',
        gap: 12,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Kpi, {
      label: "Orders",
      value: "1,424",
      delta: 8.4,
      note: "vs prior period"
    }), /*#__PURE__*/React.createElement(Kpi, {
      label: "Fill rate",
      value: "90.2%",
      delta: -1.1,
      note: "1,284 filled"
    }), /*#__PURE__*/React.createElement(Kpi, {
      label: "Rejected",
      value: "67",
      note: "41 insufficient cash"
    }), /*#__PURE__*/React.createElement(Kpi, {
      label: "Net cash flow",
      value: "+$84,210",
      delta: 3.2,
      note: "deposits \u2013 withdrawals"
    }), /*#__PURE__*/React.createElement(Kpi, {
      label: "Active traders",
      value: "312",
      delta: 4.7,
      note: "placed \u2265 1 order"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)',
        gap: 12,
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement(DashCard, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement(DashLabel, null, "Notional traded"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, "$6,043,598"), /*#__PURE__*/React.createElement(ChangePill, {
      value: 8.4
    })), /*#__PURE__*/React.createElement(PriceChart, {
      area: true,
      points: series('notional' + range, 27, 6043598),
      labels: RANGE_LABELS[range],
      height: "100%",
      style: {
        marginTop: 4,
        flex: 1,
        minHeight: 0
      }
    })), /*#__PURE__*/React.createElement(DashCard, {
      style: {
        minHeight: 0,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Orders by status"), /*#__PURE__*/React.createElement(DashLink, {
      onClick: () => go('orders')
    }, "Open orders")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, STATUS.map(([s, n, tone]) => /*#__PURE__*/React.createElement("div", {
      key: s
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 14
      }
    }, /*#__PURE__*/React.createElement(StatusPill, {
      status: s
    }), /*#__PURE__*/React.createElement("span", {
      className: "tabular-nums"
    }, n.toLocaleString(), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 12
      }
    }, (n / total * 100).toFixed(1), "%"))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        height: 6,
        borderRadius: 9999,
        background: 'rgba(255,255,255,.1)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        width: n / total * 100 + '%',
        borderRadius: 9999,
        background: {
          gain: 'var(--color-gain)',
          primary: 'var(--primary)',
          loss: 'var(--color-loss)',
          muted: 'var(--muted-foreground)'
        }[tone]
      }
    }))))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
        gap: 12,
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement(DashCard, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Live activity"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: 9999,
        background: 'var(--color-gain)'
      }
    }), "Streaming")), /*#__PURE__*/React.createElement("ul", {
      className: "ts-scroll",
      style: {
        listStyle: 'none',
        margin: '8px 0 0',
        padding: 0,
        ...scrollList
      }
    }, FEED.map((f, k) => /*#__PURE__*/React.createElement("li", {
      key: k,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: k < FEED.length - 1 ? '1px solid var(--border-60)' : 0,
        fontSize: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 28,
        height: 28,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--muted)',
        color: FEED_ICON[f.kind][1]
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: FEED_ICON[f.kind][0],
      size: 14
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, f.text, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, f.t)), /*#__PURE__*/React.createElement("span", {
      className: "tabular-nums",
      style: {
        flexShrink: 0
      }
    }, f.v))))), /*#__PURE__*/React.createElement(DashCard, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Most traded"), /*#__PURE__*/React.createElement("div", {
      style: {
        ...tableHead,
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 0.8fr 1fr',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", null, "Asset"), /*#__PURE__*/React.createElement("span", null, "Today"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Orders"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Notional")), /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: scrollList
    }, TOP.map(([s, n, v]) => /*#__PURE__*/React.createElement("div", {
      key: s,
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 0.8fr 1fr',
        gap: 8,
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid var(--border-60)',
        fontSize: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 500
      }
    }, s), /*#__PURE__*/React.createElement(Sparkline, {
      points: series(s + 'rep', 27, 100)
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, n), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(v, 0))))))));
  }
  window.ActivityScreen = ActivityScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/reporting-ui/ActivityScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/reporting-ui/CustomersScreen.jsx
try { (() => {
(() => {
  const {
    DashCard,
    DashLabel,
    Input,
    Button,
    Icon,
    ChangePill
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    money
  } = window.TSData;
  const {
    USERS,
    ORDERS
  } = window.TSReport;
  const UCOLS = '1.6fr 0.8fr 0.6fr 1fr 1fr 0.8fr 0.8fr';
  const lastMin = u => {
    const m = /(\d+):(\d+) (AM|PM)/.exec(u.last);
    return m ? (+m[1] % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + +m[2] : -1;
  };
  const USER_SORT = (u, k) => k === 'last' ? lastMin(u) : k === 'total' ? u.cash + u.portfolio : u[k];
  const EMPTY = {
    q: '',
    status: 'ALL',
    role: 'ALL',
    level: 'ALL',
    risk: 'ALL'
  };
  const ALL = label => ({
    value: 'ALL',
    label
  });
  function CustomersScreen({
    openCustomer
  }) {
    const [f, setF] = React.useState(EMPTY);
    const [sort, setSort] = React.useState({
      key: 'last',
      dir: 'desc'
    });
    const set = k => v => setF({
      ...f,
      [k]: v
    });
    const active = Object.keys(EMPTY).some(k => f[k] !== EMPTY[k]);
    const filtered = USERS.filter(u => (f.status === 'ALL' || u.status === f.status) && (f.role === 'ALL' || u.role === f.role) && (f.level === 'ALL' || u.level === f.level) && (f.risk === 'ALL' || (f.risk === 'failed' ? u.failed > 0 : f.risk === 'nocash' ? u.cash === 0 : u.accounts === 0)) && (!f.q || (u.name + u.email + u.id).toLowerCase().includes(f.q.toLowerCase())));
    const list = sortRows(filtered, sort, USER_SORT);
    const H = (k, label, align) => /*#__PURE__*/React.createElement(SortHead, {
      k: k,
      sort: sort,
      setSort: setSort,
      align: align
    }, label);
    const csv = () => downloadCsv('customers', [['User ID', u => u.id], ['Name', u => u.name], ['Email', u => u.email], ['Role', u => u.role], ['Status', u => u.status], ['Trader level', u => u.level], ['Accounts', u => u.accounts], ['Cash', u => u.cash], ['Portfolio', u => u.portfolio], ['Failed sign-ins', u => u.failed], ['Last active', u => u.last]], list);
    return /*#__PURE__*/React.createElement("div", {
      style: screenRoot
    }, /*#__PURE__*/React.createElement(PageHeader, {
      title: "Customers",
      sub: "Look up a trader to review activity and resolve support requests",
      right: /*#__PURE__*/React.createElement(ExportMenu, {
        onCsv: csv
      })
    }), /*#__PURE__*/React.createElement(DashCard, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      "data-print-hide": "true",
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        alignItems: 'flex-end',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        flex: '1 1 240px',
        maxWidth: 320
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--muted-foreground)'
      }
    }, "Search"), /*#__PURE__*/React.createElement(Input, {
      icon: "search",
      placeholder: "Name, email or user ID",
      value: f.q,
      onChange: e => set('q')(e.target.value)
    })), /*#__PURE__*/React.createElement(FilterSelect, {
      label: "Status",
      value: f.status,
      onChange: set('status'),
      width: 140,
      options: [ALL('All statuses'), 'ACTIVE', 'LOCKED', 'SUSPENDED']
    }), /*#__PURE__*/React.createElement(FilterSelect, {
      label: "Role",
      value: f.role,
      onChange: set('role'),
      width: 120,
      options: [ALL('All roles'), 'TRADER', 'ADMIN']
    }), /*#__PURE__*/React.createElement(FilterSelect, {
      label: "Trader level",
      value: f.level,
      onChange: set('level'),
      width: 150,
      options: [ALL('All levels'), 'Beginner', 'Intermediate', 'Advanced']
    }), /*#__PURE__*/React.createElement(FilterSelect, {
      label: "Flags",
      value: f.risk,
      onChange: set('risk'),
      width: 170,
      options: [ALL('No flag filter'), {
        value: 'failed',
        label: 'Failed sign-ins'
      }, {
        value: 'nocash',
        label: 'No cash'
      }, {
        value: 'noacct',
        label: 'No accounts'
      }]
    }), active ? /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      icon: "x",
      onClick: () => setF(EMPTY)
    }, "Clear filters") : null, /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        alignSelf: 'center',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, list.length, " of ", USERS.length, " customers")), /*#__PURE__*/React.createElement("div", {
      style: {
        ...tableHead,
        display: 'grid',
        gridTemplateColumns: UCOLS,
        gap: 8,
        padding: '0 8px 8px'
      }
    }, H('name', 'Customer'), H('status', 'Status'), H('accounts', 'Accounts', 'right'), H('cash', 'Cash', 'right'), H('portfolio', 'Portfolio', 'right'), H('failed', 'Failed sign-ins', 'right'), H('last', 'Last active', 'right')), /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: scrollList
    }, list.length ? null : /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        padding: '24px 8px',
        textAlign: 'center',
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "No customers match these filters."), list.map(u => /*#__PURE__*/React.createElement(RowButton, {
      key: u.id,
      onClick: () => openCustomer(u.id),
      style: {
        display: 'grid',
        gridTemplateColumns: UCOLS,
        gap: 8,
        alignItems: 'center',
        padding: '10px 8px',
        fontSize: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--primary-15)',
        color: 'var(--primary)',
        fontSize: 12,
        fontWeight: 600
      }
    }, u.initials), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontWeight: 500
      }
    }, u.name), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--muted-foreground)',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, u.email))), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(StatusPill, {
      status: u.status
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, u.accounts), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(u.cash)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(u.portfolio)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        color: u.failed >= 3 ? 'var(--color-loss)' : undefined
      },
      className: "tabular-nums"
    }, u.failed), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, u.last))))));
  }
  function Info({
    k,
    v,
    tone
  }) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(DashLabel, {
      as: "div",
      style: {
        fontSize: 11
      }
    }, k), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 14,
        color: tone
      },
      className: "tabular-nums"
    }, v));
  }
  function CustomerDetail({
    userId,
    back
  }) {
    const base = USERS.find(u => u.id === userId) || USERS[0];
    const [u, setU] = React.useState(base);
    const [open, setOpen] = React.useState(null);
    const orders = ORDERS.filter(o => o.user === u.name);
    const accts = u.name === 'Sean Cheema' ? [['Growth', 7604.68], ['Retirement', 21380.4]] : u.accounts ? [['Primary', u.portfolio]] : [];
    const locked = u.status === 'LOCKED';
    return /*#__PURE__*/React.createElement("div", {
      style: screenRoot
    }, /*#__PURE__*/React.createElement("header", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "icon-lg",
      icon: "chevron-left",
      "aria-label": "Back to customers",
      onClick: back
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 40,
        height: 40,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--primary-15)',
        color: 'var(--primary)',
        fontSize: 14,
        fontWeight: 600
      }
    }, u.initials), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, u.name), /*#__PURE__*/React.createElement(StatusPill, {
      status: u.status
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '2px 0 0',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, u.email, " \xB7 ", u.id, " \xB7 ", u.role.toLowerCase())), /*#__PURE__*/React.createElement(ExportMenu, null), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "lg",
      icon: "mail"
    }, "Email customer")), locked ? /*#__PURE__*/React.createElement("div", {
      role: "status",
      style: {
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid rgba(255,0,55,.3)',
        background: 'var(--loss-10)',
        fontSize: 14
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 16,
      color: "var(--color-loss)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, "Account locked after ", u.failed, " failed sign-in attempts. Unlocks automatically ", u.locked, "."), /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      radius: 5,
      icon: "lock-open",
      onClick: () => setU({
        ...u,
        status: 'ACTIVE',
        failed: 0,
        locked: null
      })
    }, "Unlock now")) : null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
        gap: 12,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(DashCard, null, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Profile"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        rowGap: 14
      }
    }, /*#__PURE__*/React.createElement(Info, {
      k: "Trader level",
      v: u.level
    }), /*#__PURE__*/React.createElement(Info, {
      k: "Role",
      v: u.role
    }), /*#__PURE__*/React.createElement(Info, {
      k: "Last active",
      v: u.last
    }), /*#__PURE__*/React.createElement(Info, {
      k: "Member since",
      v: "Jan 2, 2026"
    }))), /*#__PURE__*/React.createElement(DashCard, null, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Security"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        rowGap: 14
      }
    }, /*#__PURE__*/React.createElement(Info, {
      k: "Account status",
      v: u.status,
      tone: locked ? 'var(--color-loss)' : undefined
    }), /*#__PURE__*/React.createElement(Info, {
      k: "Failed attempts",
      v: u.failed,
      tone: u.failed >= 3 ? 'var(--color-loss)' : undefined
    }), /*#__PURE__*/React.createElement(Info, {
      k: "Locked until",
      v: u.locked || '—'
    }), /*#__PURE__*/React.createElement(Info, {
      k: "Idle timeout",
      v: "15 minutes"
    }))), /*#__PURE__*/React.createElement(DashCard, {
      variant: "net-worth"
    }, /*#__PURE__*/React.createElement(DashLabel, null, "Total balance"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(u.cash + u.portfolio, 0)), /*#__PURE__*/React.createElement("ul", {
      style: {
        listStyle: 'none',
        margin: '12px 0 0',
        padding: 0,
        fontSize: 14
      }
    }, /*#__PURE__*/React.createElement("li", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid rgba(238,250,255,.12)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)'
      }
    }, "Cash (shared)"), /*#__PURE__*/React.createElement("span", {
      className: "tabular-nums"
    }, money(u.cash))), accts.map(([n, v]) => /*#__PURE__*/React.createElement("li", {
      key: n,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid rgba(238,250,255,.12)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)'
      }
    }, n), /*#__PURE__*/React.createElement("span", {
      className: "tabular-nums"
    }, money(v))))))), /*#__PURE__*/React.createElement(DashCard, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Orders"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, "Select an order to see its audit trail")), orders.length ? /*#__PURE__*/React.createElement(OrderTable, {
      orders: orders,
      onOpen: setOpen,
      showUser: false
    }) : /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        padding: '24px 8px',
        textAlign: 'center',
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "This customer hasn't placed any orders yet.")), open ? /*#__PURE__*/React.createElement(OrderDetail, {
      order: open,
      onClose: () => setOpen(null)
    }) : null);
  }
  Object.assign(window, {
    CustomersScreen,
    CustomerDetail
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/reporting-ui/CustomersScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/reporting-ui/OrdersScreen.jsx
try { (() => {
(() => {
  const {
    DashCard,
    DashLabel,
    Input,
    Select,
    Button,
    Icon,
    Dialog,
    ChangePill
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    money
  } = window.TSData;
  const {
    USERS,
    ORDERS,
    AUDIT
  } = window.TSReport;
  const OCOLS = '0.7fr 1fr 1.3fr 0.9fr 0.7fr 0.6fr 0.5fr 0.9fr 0.9fr';
  function AuditTimeline({
    order
  }) {
    const events = AUDIT[order.id] || [['ORDER_RECEIVED', order.time], ['VALIDATED', order.time], ['FILLED', order.time]];
    return /*#__PURE__*/React.createElement("ol", {
      style: {
        listStyle: 'none',
        margin: 0,
        padding: 0
      }
    }, events.map(([e, t], k) => {
      const bad = /FAIL|REJECT/.test(e),
        done = /FILLED|UPDATED/.test(e);
      const c = bad ? 'var(--color-loss)' : done ? 'var(--color-gain)' : 'var(--primary)';
      return /*#__PURE__*/React.createElement("li", {
        key: k,
        style: {
          display: 'grid',
          gridTemplateColumns: '16px 1fr',
          gap: 12,
          paddingBottom: k < events.length - 1 ? 14 : 0,
          position: 'relative'
        }
      }, k < events.length - 1 ? /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'absolute',
          left: 7,
          top: 14,
          bottom: 0,
          width: 1,
          background: 'var(--border)'
        }
      }) : null, /*#__PURE__*/React.createElement("span", {
        style: {
          marginTop: 4,
          width: 9,
          height: 9,
          marginLeft: 3,
          borderRadius: 9999,
          background: c,
          boxShadow: '0 0 0 3px var(--card)'
        }
      }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'block',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.02em'
        }
      }, e), /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'block',
          fontSize: 12,
          color: 'var(--muted-foreground)'
        },
        className: "tabular-nums"
      }, t)));
    }));
  }
  function OrderRow({
    o,
    onClick,
    showUser = true
  }) {
    return /*#__PURE__*/React.createElement(RowButton, {
      onClick: onClick,
      style: {
        display: 'grid',
        gridTemplateColumns: OCOLS,
        gap: 8,
        alignItems: 'center',
        padding: '10px 8px',
        fontSize: 14,
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "tabular-nums",
      style: {
        color: 'var(--muted-foreground)'
      }
    }, "#", o.id), /*#__PURE__*/React.createElement("span", {
      className: "tabular-nums"
    }, o.time), /*#__PURE__*/React.createElement("span", {
      style: {
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, showUser ? o.user : o.account, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)'
      }
    }, showUser ? ' · ' + o.account : '')), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 500
      }
    }, o.symbol), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(ChangePill, {
      tag: true,
      tone: o.side === 'buy' ? 'primary' : 'loss'
    }, o.side)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, o.qty), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 12
      }
    }, o.type), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, o.price ? money(o.price) : '—'), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement(StatusPill, {
      status: o.status
    })));
  }
  const ORDER_SORT = (o, k) => k === 'time' || k === 'id' ? o.id : k === 'price' ? o.price || 0 : k === 'value' ? (o.price || 0) * o.qty : o[k];
  function OrderTable({
    orders,
    onOpen,
    showUser,
    sort: sortProp,
    setSort: setSortProp
  }) {
    const [own, setOwn] = React.useState({
      key: 'time',
      dir: 'desc'
    });
    const sort = sortProp || own,
      setSort = setSortProp || setOwn;
    const rows = sortRows(orders, sort, ORDER_SORT);
    const H = (k, label, align) => /*#__PURE__*/React.createElement(SortHead, {
      k: k,
      sort: sort,
      setSort: setSort,
      align: align
    }, label);
    return /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: {
        overflow: 'auto',
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 880
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...tableHead,
        display: 'grid',
        gridTemplateColumns: OCOLS,
        gap: 8,
        padding: '0 8px 8px',
        position: 'sticky',
        top: 0,
        background: 'var(--card)',
        zIndex: 1
      }
    }, H('id', 'Order'), H('time', 'Time'), showUser ? H('user', 'Customer') : H('account', 'Account'), H('symbol', 'Asset'), H('side', 'Side'), H('qty', 'Qty', 'right'), /*#__PURE__*/React.createElement("span", null, "Type"), H('price', 'Fill price', 'right'), H('status', 'Status', 'right')), rows.map(o => /*#__PURE__*/React.createElement(OrderRow, {
      key: o.id,
      o: o,
      showUser: showUser,
      onClick: () => onOpen(o)
    }))));
  }
  const STATUS_NOTE = {
    FILLED: 'Executed at the locked quote; holdings and cash posted.',
    PENDING: 'Validated and waiting for a market quote.',
    REJECTED: 'Failed validation; no fill, cash or holdings were posted.',
    CANCELLED: 'Cancelled before execution; nothing was posted.'
  };
  const USER_EMAIL = name => (window.TSReport.USERS.find(u => u.name === name) || {}).email || '—';
  function Section({
    title,
    right,
    children,
    style
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        ...style
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement(DashLabel, {
      as: "h3"
    }, title), right), children);
  }
  function KV({
    rows,
    cols = 2
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(' + cols + ', minmax(0,1fr))',
        rowGap: 12,
        columnGap: 16,
        fontSize: 14
      }
    }, rows.filter(Boolean).map(([k, v, tone]) => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase'
      }
    }, k), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        color: tone,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      },
      className: "tabular-nums"
    }, v))));
  }
  function OrderDetail({
    order,
    onClose
  }) {
    const inst = window.TSData.find(order.symbol);
    const filled = order.status === 'FILLED';
    const quote = order.price || inst.price;
    const spread = Math.max(0.01, quote * 0.0004);
    const bid = quote - spread / 2,
      ask = quote + spread / 2;
    const value = order.qty * quote;
    const buy = order.side === 'buy';
    const cashBefore = {
      'Sean Cheema': 6086.91,
      'Priya Natarajan': 5499.67,
      'Marcus Lee': 12040.1
    }[order.user] || 5000;
    const cashAfter = filled ? cashBefore + (buy ? -value : value) : cashBefore;
    const heldBefore = {
      AAPL: 0,
      NVDA: 25,
      MSFT: 0,
      SPY: 0,
      GOOGL: 12,
      META: 0,
      TSLA: 0,
      AMZN: 10
    }[order.symbol] || 0;
    const heldAfter = filled ? heldBefore + (buy ? order.qty : -order.qty) : heldBefore;
    const fillId = 88000 + order.id % 1000;
    const copy = t => {
      try {
        navigator.clipboard.writeText(t);
      } catch (e) {}
    };
    return /*#__PURE__*/React.createElement(Dialog, {
      title: 'Order #' + order.id,
      width: 960,
      closeLabel: "Close order detail",
      onClose: onClose
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(InstrumentTile, {
      symbol: order.symbol
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: '-0.025em',
        textTransform: 'capitalize'
      }
    }, order.side, " ", order.qty, " ", order.symbol), /*#__PURE__*/React.createElement(StatusPill, {
      status: order.status
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, inst.name, " \xB7 ", order.type.toLowerCase(), " order \xB7 Sep 14, 2026 ", order.time, " CT")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: 'auto',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase'
      }
    }, filled ? buy ? 'Cost' : 'Proceeds' : 'Est. value'), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(value)))), /*#__PURE__*/React.createElement("p", {
      role: "status",
      style: {
        margin: '0 0 16px',
        padding: '8px 12px',
        borderRadius: 5,
        fontSize: 14,
        background: order.status === 'REJECTED' ? 'var(--loss-10)' : 'var(--muted)',
        color: order.status === 'REJECTED' ? 'var(--color-loss)' : 'var(--foreground)'
      }
    }, order.reason ? 'Rejected: ' + order.reason + '. ' : '', STATUS_NOTE[order.status]), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(Section, {
      title: "Customer"
    }, /*#__PURE__*/React.createElement(KV, {
      cols: 3,
      rows: [['Name', order.user], ['Email', USER_EMAIL(order.user)], ['Account', order.account]]
    })), /*#__PURE__*/React.createElement(Section, {
      title: "Execution"
    }, /*#__PURE__*/React.createElement(KV, {
      cols: 3,
      rows: [['Quantity', order.qty], ['Fill price', order.price ? money(order.price) : '—'], ['Fill ID', filled ? '#' + fillId : '—'], ['Bid at submit', money(bid), 'var(--color-gain)'], ['Ask at submit', money(ask), 'var(--color-loss)'], ['Spread', money(spread, 3)], ['Market price now', money(inst.price)], ['Slippage', filled ? money(0) : '—'], ['Session', '#12 · replay']]
    })), /*#__PURE__*/React.createElement(Section, {
      title: "Ledger impact",
      right: filled ? null : /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: 'var(--muted-foreground)'
        }
      }, "Nothing posted")
    }, /*#__PURE__*/React.createElement(KV, {
      cols: 3,
      rows: [['Cash before', money(cashBefore)], ['Cash change', filled ? (buy ? '-' : '+') + money(value) : '—', filled ? buy ? 'var(--color-loss)' : 'var(--color-gain)' : undefined], ['Cash after', money(cashAfter)], [order.symbol + ' before', heldBefore + ' sh'], ['Holding change', filled ? (buy ? '+' : '-') + order.qty + ' sh' : '—'], [order.symbol + ' after', heldAfter + ' sh']]
    })), /*#__PURE__*/React.createElement(Section, {
      title: "References"
    }, /*#__PURE__*/React.createElement(KV, {
      cols: 2,
      rows: [['Client reference', order.ref], ['Order type', order.type], ['Cash transaction', filled ? '#' + (fillId + 4100) : '—'], ['Holding movement', filled ? '#' + (fillId + 7300) : '—']]
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      icon: "copy",
      onClick: () => copy(order.ref)
    }, "Copy reference"), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      icon: "copy",
      onClick: () => copy(String(order.id))
    }, "Copy order ID")))), /*#__PURE__*/React.createElement(Section, {
      title: "Audit trail",
      right: /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: 'var(--muted-foreground)'
        }
      }, "audit_trail"),
      style: {
        alignSelf: 'start'
      }
    }, /*#__PURE__*/React.createElement(AuditTimeline, {
      order: order
    }))));
  }
  function InstrumentTile({
    symbol
  }) {
    return /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        width: 44,
        height: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        background: 'var(--primary-15)',
        color: 'var(--primary)',
        fontSize: 12,
        fontWeight: 600
      }
    }, symbol.slice(0, 4));
  }
  const uniq = k => Array.from(new Set(ORDERS.map(o => o[k]))).sort();
  const ALL = label => ({
    value: 'ALL',
    label
  });
  const EMPTY = {
    q: '',
    status: 'ALL',
    side: 'ALL',
    symbol: 'ALL',
    user: 'ALL',
    fill: 'ALL'
  };
  function OrdersScreen() {
    const [f, setF] = React.useState(EMPTY);
    const [sort, setSort] = React.useState({
      key: 'time',
      dir: 'desc'
    });
    const [open, setOpen] = React.useState(null);
    const set = k => v => setF({
      ...f,
      [k]: v
    });
    const active = Object.keys(EMPTY).some(k => f[k] !== EMPTY[k]);
    const list = ORDERS.filter(o => (f.status === 'ALL' || o.status === f.status) && (f.side === 'ALL' || o.side === f.side) && (f.symbol === 'ALL' || o.symbol === f.symbol) && (f.user === 'ALL' || o.user === f.user) && (f.fill === 'ALL' || (f.fill === 'priced' ? !!o.price : !o.price)) && (!f.q || (o.user + o.symbol + o.id + o.ref).toLowerCase().includes(f.q.toLowerCase())));
    const csv = () => downloadCsv('orders', [['Order', o => o.id], ['Time', o => o.time], ['Customer', o => o.user], ['Account', o => o.account], ['Asset', o => o.symbol], ['Side', o => o.side], ['Qty', o => o.qty], ['Type', o => o.type], ['Fill price', o => o.price || ''], ['Status', o => o.status], ['Client reference', o => o.ref]], sortRows(list, sort, ORDER_SORT));
    return /*#__PURE__*/React.createElement("div", {
      style: screenRoot
    }, /*#__PURE__*/React.createElement(PageHeader, {
      title: "Orders",
      sub: "All accounts \xB7 simulation session #12",
      right: /*#__PURE__*/React.createElement(ExportMenu, {
        onCsv: csv
      })
    }), /*#__PURE__*/React.createElement(DashCard, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      "data-print-hide": "true",
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        flexWrap: 'wrap',
        alignItems: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        flex: '1 1 240px',
        maxWidth: 300
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--muted-foreground)'
      }
    }, "Search"), /*#__PURE__*/React.createElement(Input, {
      icon: "search",
      placeholder: "Customer, symbol, order # or ref",
      value: f.q,
      onChange: e => set('q')(e.target.value)
    })), /*#__PURE__*/React.createElement(FilterSelect, {
      label: "Status",
      value: f.status,
      onChange: set('status'),
      width: 140,
      options: [ALL('All statuses'), 'FILLED', 'PENDING', 'REJECTED', 'CANCELLED']
    }), /*#__PURE__*/React.createElement(FilterSelect, {
      label: "Side",
      value: f.side,
      onChange: set('side'),
      width: 110,
      options: [ALL('Buy & sell'), {
        value: 'buy',
        label: 'Buy'
      }, {
        value: 'sell',
        label: 'Sell'
      }]
    }), /*#__PURE__*/React.createElement(FilterSelect, {
      label: "Asset",
      value: f.symbol,
      onChange: set('symbol'),
      width: 120,
      options: [ALL('All assets')].concat(uniq('symbol'))
    }), /*#__PURE__*/React.createElement(FilterSelect, {
      label: "Customer",
      value: f.user,
      onChange: set('user'),
      width: 170,
      options: [ALL('All customers')].concat(uniq('user'))
    }), /*#__PURE__*/React.createElement(FilterSelect, {
      label: "Fill",
      value: f.fill,
      onChange: set('fill'),
      width: 130,
      options: [ALL('Any'), {
        value: 'priced',
        label: 'Has fill price'
      }, {
        value: 'unfilled',
        label: 'No fill yet'
      }]
    }), active ? /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      icon: "x",
      onClick: () => setF(EMPTY)
    }, "Clear filters") : null, /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        alignSelf: 'center',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, list.length, " of ", ORDERS.length, " orders")), list.length ? /*#__PURE__*/React.createElement(OrderTable, {
      orders: list,
      onOpen: setOpen,
      showUser: true,
      sort: sort,
      setSort: setSort
    }) : /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        padding: '24px 8px',
        textAlign: 'center',
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "No orders match these filters.")), open ? /*#__PURE__*/React.createElement(OrderDetail, {
      order: open,
      onClose: () => setOpen(null)
    }) : null);
  }
  Object.assign(window, {
    OrdersScreen,
    OrderTable,
    OrderDetail,
    AuditTimeline
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/reporting-ui/OrdersScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/reporting-ui/ReportingShell.jsx
try { (() => {
(() => {
  const {
    Icon,
    ChangePill
  } = window.TradingSeasonDesignSystem_86c3eb;
  const NAV = [['activity', 'Activity', 'activity'], ['customers', 'Customers', 'users'], ['orders', 'Orders', 'list-ordered']];
  function NavItem({
    on,
    icon,
    children,
    onClick
  }) {
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: onClick,
      "aria-current": on ? 'page' : undefined,
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 36,
        width: '100%',
        padding: '0 10px',
        border: 0,
        borderRadius: 8,
        fontSize: 14,
        fontWeight: on ? 500 : 400,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 150ms',
        background: on ? 'var(--muted)' : h ? 'rgba(26,26,26,.5)' : 'transparent',
        color: on ? 'var(--foreground)' : h ? 'var(--foreground)' : 'var(--muted-foreground)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 16,
      style: {
        color: on ? 'var(--primary)' : undefined
      }
    }), children);
  }
  const STATUS_TONE = {
    ACTIVE: 'gain',
    LOCKED: 'loss',
    SUSPENDED: 'muted',
    FILLED: 'gain',
    PENDING: 'primary',
    REJECTED: 'loss',
    CANCELLED: 'muted'
  };
  function StatusPill({
    status
  }) {
    return /*#__PURE__*/React.createElement(ChangePill, {
      tag: true,
      tone: STATUS_TONE[status] || 'muted'
    }, status.toLowerCase());
  }
  function ReportingShell({
    screen,
    go,
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '232px minmax(0,1fr)',
        height: '100vh',
        background: 'var(--background)'
      }
    }, /*#__PURE__*/React.createElement("aside", {
      "data-print-hide": "true",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '0 12px 16px',
        background: 'var(--card)',
        borderRight: '1px solid rgba(238,250,255,.1)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 64,
        padding: '0 6px'
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/2b-waves.svg",
      alt: "",
      style: {
        width: 28,
        height: 28
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        lineHeight: 1.15
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, "TradingSeason"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--muted-foreground)'
      }
    }, "Reporting"))), NAV.map(([k, label, icon]) => /*#__PURE__*/React.createElement(NavItem, {
      key: k,
      on: screen === k || screen === 'customer' && k === 'customers',
      icon: icon,
      onClick: () => go(k)
    }, label)), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 8,
        borderTop: '1px solid rgba(238,250,255,.1)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 32,
        height: 32,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--primary-15)',
        color: 'var(--primary)',
        fontSize: 12,
        fontWeight: 600
      }
    }, "AB"), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0,
        lineHeight: 1.3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 14
      }
    }, "Ada Brooks"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, "Analyst \xB7 Admin")))), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 24px 16px'
      }
    }, children));
  }
  function PageHeader({
    title,
    sub,
    right
  }) {
    return /*#__PURE__*/React.createElement("header", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        minHeight: 64,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, title), sub ? /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '2px 0 0',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, sub) : null), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, right));
  }
  const tableHead = {
    color: 'var(--muted-foreground)',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--border)',
    paddingBottom: 8
  };
  function RowButton({
    children,
    style,
    onClick
  }) {
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: onClick,
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        width: '100%',
        border: 0,
        textAlign: 'left',
        color: 'inherit',
        cursor: 'pointer',
        borderRadius: 8,
        background: h ? 'var(--muted)' : 'transparent',
        transition: 'background 150ms',
        ...style
      }
    }, children);
  }
  const screenRoot = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    flex: 1,
    minHeight: 0
  };
  const scrollList = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 2rem), transparent)'
  };

  // Clickable column header: label + sort chevron. sort = { key, dir }.
  function SortHead({
    k,
    sort,
    setSort,
    align,
    children
  }) {
    const on = sort.key === k;
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setSort({
        key: k,
        dir: on && sort.dir === 'desc' ? 'asc' : 'desc'
      }),
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      "aria-sort": on ? sort.dir === 'asc' ? 'ascending' : 'descending' : 'none',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        background: 'none',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        font: 'inherit',
        letterSpacing: 'inherit',
        textTransform: 'inherit',
        color: on || h ? 'var(--foreground)' : 'inherit',
        transition: 'color 150ms'
      }
    }, children, /*#__PURE__*/React.createElement(Icon, {
      name: on ? sort.dir === 'asc' ? 'chevron-up' : 'chevron-down' : 'chevrons-up-down',
      size: 12,
      style: {
        opacity: on ? 1 : 0.6,
        color: on ? 'var(--primary)' : undefined
      }
    }));
  }
  function sortRows(rows, sort, get) {
    const out = rows.slice().sort((a, b) => {
      const x = get(a, sort.key),
        y = get(b, sort.key);
      return typeof x === 'string' ? x.localeCompare(y) : x - y;
    });
    return sort.dir === 'desc' ? out.reverse() : out;
  }
  function downloadCsv(name, cols, rows) {
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [cols.map(c => esc(c[0])).join(',')].concat(rows.map(r => cols.map(c => esc(c[1](r))).join(','))).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {
      type: 'text/csv'
    }));
    a.download = name + '.csv';
    a.click();
  }
  // Export dropdown: CSV of the current (filtered, sorted) rows, or PDF via the print dialog.
  function ExportMenu({
    onCsv
  }) {
    const {
      HeaderDropdown,
      MenuItem
    } = window.TradingSeasonDesignSystem_86c3eb;
    return /*#__PURE__*/React.createElement(HeaderDropdown, {
      icon: "download",
      label: "Export",
      width: 116,
      panelWidth: 176,
      ariaLabel: "Export this view"
    }, close => /*#__PURE__*/React.createElement("div", {
      role: "menu"
    }, onCsv ? /*#__PURE__*/React.createElement(MenuItem, {
      icon: "file-spreadsheet",
      onClick: () => {
        close();
        onCsv();
      }
    }, "Export CSV") : null, /*#__PURE__*/React.createElement(MenuItem, {
      icon: "file-text",
      onClick: () => {
        close();
        setTimeout(() => window.print(), 50);
      }
    }, "Export PDF")));
  }
  // Filter row control: tiny uppercase caption over a Select.
  function FilterSelect({
    label,
    value,
    onChange,
    options,
    width = 150
  }) {
    const {
      Select
    } = window.TradingSeasonDesignSystem_86c3eb;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--muted-foreground)'
      }
    }, label), /*#__PURE__*/React.createElement(Select, {
      value: value,
      onChange: onChange,
      width: width,
      options: options
    }));
  }
  Object.assign(window, {
    ReportingShell,
    PageHeader,
    StatusPill,
    tableHead,
    RowButton,
    screenRoot,
    scrollList,
    SortHead,
    sortRows,
    downloadCsv,
    ExportMenu,
    FilterSelect
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/reporting-ui/ReportingShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/reporting-ui/reporting-data.js
try { (() => {
// Mock reporting data shaped after the business schema (users, accounts, orders, fills, cash_transactions, audit_trail).
(function () {
  const USERS = [{
    id: 'u-7f3a',
    name: 'Sean Cheema',
    initials: 'SC',
    email: 'sean@example.com',
    role: 'TRADER',
    status: 'ACTIVE',
    level: 'Advanced',
    failed: 0,
    locked: null,
    accounts: 2,
    cash: 4820.55,
    portfolio: 28985.08,
    last: '3:44 PM'
  }, {
    id: 'u-12bd',
    name: 'Jane Doe',
    initials: 'JD',
    email: 'jane.doe@example.com',
    role: 'TRADER',
    status: 'LOCKED',
    level: 'Beginner',
    failed: 5,
    locked: 'Sep 14, 4:15 PM',
    accounts: 1,
    cash: 5000.0,
    portfolio: 0,
    last: '3:30 PM'
  }, {
    id: 'u-9c01',
    name: 'Marcus Lee',
    initials: 'ML',
    email: 'marcus.lee@example.com',
    role: 'TRADER',
    status: 'ACTIVE',
    level: 'Intermediate',
    failed: 1,
    locked: null,
    accounts: 3,
    cash: 12040.1,
    portfolio: 64210.77,
    last: '3:41 PM'
  }, {
    id: 'u-44e8',
    name: 'Priya Natarajan',
    initials: 'PN',
    email: 'priya.n@example.com',
    role: 'TRADER',
    status: 'ACTIVE',
    level: 'Advanced',
    failed: 0,
    locked: null,
    accounts: 2,
    cash: 880.42,
    portfolio: 118402.5,
    last: '3:39 PM'
  }, {
    id: 'u-0a77',
    name: 'Tom Alvarez',
    initials: 'TA',
    email: 'tom.alvarez@example.com',
    role: 'TRADER',
    status: 'SUSPENDED',
    level: 'Beginner',
    failed: 0,
    locked: null,
    accounts: 1,
    cash: 0,
    portfolio: 0,
    last: 'Sep 9'
  }, {
    id: 'u-3b5f',
    name: 'Ada Brooks',
    initials: 'AB',
    email: 'ada.brooks@example.com',
    role: 'ADMIN',
    status: 'ACTIVE',
    level: '—',
    failed: 0,
    locked: null,
    accounts: 0,
    cash: 0,
    portfolio: 0,
    last: '3:12 PM'
  }];
  const ORDERS = [{
    id: 10482,
    ref: '9f1c…a2e4',
    time: '3:44:12 PM',
    user: 'Sean Cheema',
    account: 'Growth',
    symbol: 'AAPL',
    side: 'buy',
    type: 'MARKET',
    qty: 4,
    price: 316.59,
    status: 'FILLED'
  }, {
    id: 10481,
    ref: '7b20…11fd',
    time: '3:43:58 PM',
    user: 'Priya Natarajan',
    account: 'Core',
    symbol: 'NVDA',
    side: 'sell',
    type: 'MARKET',
    qty: 25,
    price: 184.77,
    status: 'FILLED'
  }, {
    id: 10480,
    ref: 'c3e9…04b1',
    time: '3:42:31 PM',
    user: 'Marcus Lee',
    account: 'Swing',
    symbol: 'TSLA',
    side: 'buy',
    type: 'MARKET',
    qty: 40,
    price: null,
    status: 'REJECTED',
    reason: 'Insufficient cash'
  }, {
    id: 10479,
    ref: '2d88…9c7a',
    time: '3:41:05 PM',
    user: 'Marcus Lee',
    account: 'Income',
    symbol: 'SPY',
    side: 'buy',
    type: 'MARKET',
    qty: 6,
    price: 648.2,
    status: 'FILLED'
  }, {
    id: 10478,
    ref: 'e6a1…53d0',
    time: '3:39:47 PM',
    user: 'Priya Natarajan',
    account: 'Core',
    symbol: 'META',
    side: 'buy',
    type: 'MARKET',
    qty: 3,
    price: null,
    status: 'PENDING'
  }, {
    id: 10477,
    ref: '51f4…aa19',
    time: '3:37:20 PM',
    user: 'Sean Cheema',
    account: 'Retirement',
    symbol: 'MSFT',
    side: 'buy',
    type: 'MARKET',
    qty: 2,
    price: 512.3,
    status: 'FILLED'
  }, {
    id: 10476,
    ref: '0c6b…e8f2',
    time: '3:35:02 PM',
    user: 'Marcus Lee',
    account: 'Swing',
    symbol: 'AMZN',
    side: 'sell',
    type: 'MARKET',
    qty: 10,
    price: null,
    status: 'CANCELLED'
  }, {
    id: 10475,
    ref: 'a9d3…7710',
    time: '3:31:44 PM',
    user: 'Priya Natarajan',
    account: 'Core',
    symbol: 'GOOGL',
    side: 'sell',
    type: 'MARKET',
    qty: 12,
    price: 208.44,
    status: 'FILLED'
  }];
  const AUDIT = {
    10482: [['ORDER_RECEIVED', '3:44:12.084 PM'], ['VALIDATED', '3:44:12.091 PM'], ['QUOTE_LOCKED', '3:44:12.102 PM'], ['FILLED', '3:44:12.118 PM'], ['HOLDINGS_UPDATED', '3:44:12.121 PM']],
    10480: [['ORDER_RECEIVED', '3:42:31.402 PM'], ['VALIDATION_FAILED', '3:42:31.410 PM · Insufficient cash'], ['REJECTED', '3:42:31.411 PM']],
    10478: [['ORDER_RECEIVED', '3:39:47.220 PM'], ['VALIDATED', '3:39:47.231 PM'], ['AWAITING_QUOTE', '3:39:47.240 PM']],
    10476: [['ORDER_RECEIVED', '3:35:02.019 PM'], ['VALIDATED', '3:35:02.027 PM'], ['CANCELLED', '3:35:09.550 PM · by user']]
  };
  const FEED = [{
    t: '3:44 PM',
    kind: 'fill',
    text: 'Sean Cheema bought 4 AAPL',
    v: '$1,266.36'
  }, {
    t: '3:43 PM',
    kind: 'fill',
    text: 'Priya Natarajan sold 25 NVDA',
    v: '$4,619.25'
  }, {
    t: '3:42 PM',
    kind: 'reject',
    text: 'Order #10480 rejected — insufficient cash',
    v: 'TSLA'
  }, {
    t: '3:40 PM',
    kind: 'cash',
    text: 'Marcus Lee deposited cash',
    v: '+$2,500.00'
  }, {
    t: '3:30 PM',
    kind: 'lock',
    text: 'Jane Doe locked after 5 failed sign-ins',
    v: 'Security'
  }, {
    t: '3:12 PM',
    kind: 'cash',
    text: 'Priya Natarajan withdrew cash',
    v: '-$800.00'
  }];
  const STATUS = [['FILLED', 1284, 'gain'], ['PENDING', 42, 'primary'], ['REJECTED', 67, 'loss'], ['CANCELLED', 31, 'muted']];
  const TOP = [['NVDA', 312, 1840220], ['AAPL', 268, 1210450], ['TSLA', 201, 902118], ['SPY', 164, 1402800], ['MSFT', 120, 688010]];
  window.TSReport = {
    USERS,
    ORDERS,
    AUDIT,
    FEED,
    STATUS,
    TOP
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/reporting-ui/reporting-data.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardTitle = __ds_scope.CardTitle;

__ds_ns.CardDescription = __ds_scope.CardDescription;

__ds_ns.CardContent = __ds_scope.CardContent;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.DashCard = __ds_scope.DashCard;

__ds_ns.DashLabel = __ds_scope.DashLabel;

__ds_ns.DashLink = __ds_scope.DashLink;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Separator = __ds_scope.Separator;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.FieldLabel = __ds_scope.FieldLabel;

__ds_ns.FieldDescription = __ds_scope.FieldDescription;

__ds_ns.FieldError = __ds_scope.FieldError;

__ds_ns.FieldChecklist = __ds_scope.FieldChecklist;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.NativeSelect = __ds_scope.NativeSelect;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.ChangePill = __ds_scope.ChangePill;

__ds_ns.InstrumentSearch = __ds_scope.InstrumentSearch;

__ds_ns.PriceChart = __ds_scope.PriceChart;

__ds_ns.ShareSlider = __ds_scope.ShareSlider;

__ds_ns.Sparkline = __ds_scope.Sparkline;

__ds_ns.TimeframeToggle = __ds_scope.TimeframeToggle;

__ds_ns.SideToggle = __ds_scope.SideToggle;

__ds_ns.CloseButton = __ds_scope.CloseButton;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.HeaderDropdown = __ds_scope.HeaderDropdown;

__ds_ns.MenuItem = __ds_scope.MenuItem;

})();
