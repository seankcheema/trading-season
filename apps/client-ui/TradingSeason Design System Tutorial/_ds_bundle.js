/* @ds-bundle: {"format":4,"namespace":"TradingSeasonDesignSystem_86c3eb","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"CardHeader","sourcePath":"components/core/Card.jsx"},{"name":"CardTitle","sourcePath":"components/core/Card.jsx"},{"name":"CardDescription","sourcePath":"components/core/Card.jsx"},{"name":"CardContent","sourcePath":"components/core/Card.jsx"},{"name":"CardFooter","sourcePath":"components/core/Card.jsx"},{"name":"DashCard","sourcePath":"components/core/DashCard.jsx"},{"name":"DashLabel","sourcePath":"components/core/DashCard.jsx"},{"name":"DashLink","sourcePath":"components/core/DashCard.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"Separator","sourcePath":"components/core/Separator.jsx"},{"name":"Label","sourcePath":"components/core/Separator.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"FieldLabel","sourcePath":"components/forms/Field.jsx"},{"name":"FieldDescription","sourcePath":"components/forms/Field.jsx"},{"name":"FieldError","sourcePath":"components/forms/Field.jsx"},{"name":"FieldChecklist","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"NativeSelect","sourcePath":"components/forms/NativeSelect.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"ChangePill","sourcePath":"components/market/ChangePill.jsx"},{"name":"InstrumentSearch","sourcePath":"components/market/InstrumentSearch.jsx"},{"name":"PriceChart","sourcePath":"components/market/PriceChart.jsx"},{"name":"ShareSlider","sourcePath":"components/market/ShareSlider.jsx"},{"name":"Sparkline","sourcePath":"components/market/Sparkline.jsx"},{"name":"TimeframeToggle","sourcePath":"components/market/TimeframeToggle.jsx"},{"name":"SideToggle","sourcePath":"components/market/TimeframeToggle.jsx"},{"name":"CloseButton","sourcePath":"components/overlays/Dialog.jsx"},{"name":"Dialog","sourcePath":"components/overlays/Dialog.jsx"},{"name":"HeaderDropdown","sourcePath":"components/overlays/HeaderDropdown.jsx"},{"name":"MenuItem","sourcePath":"components/overlays/HeaderDropdown.jsx"}],"sourceHashes":{"components/core/Button.jsx":"f1fa1eabb2a5","components/core/Card.jsx":"e2d4b61e48d4","components/core/DashCard.jsx":"bf868f535123","components/core/Icon.jsx":"7e2edb8d8ff9","components/core/Separator.jsx":"15476ee8c5b2","components/forms/Field.jsx":"6a782e83dcb4","components/forms/Input.jsx":"0be144125c64","components/forms/NativeSelect.jsx":"b1d4f2dafa1c","components/forms/Select.jsx":"d42b4b7292d6","components/market/ChangePill.jsx":"13054a102ce0","components/market/InstrumentSearch.jsx":"7c4db5cd52f3","components/market/PriceChart.jsx":"dcfd1f5e67d9","components/market/ShareSlider.jsx":"61d0cd00e0ca","components/market/Sparkline.jsx":"b878618471c4","components/market/TimeframeToggle.jsx":"39b8641689fb","components/overlays/Dialog.jsx":"f18b521e6f72","components/overlays/HeaderDropdown.jsx":"bb2dbbf8959c","ui_kits/_shared/AppHeader.jsx":"bf374d5290d4","ui_kits/_shared/OrderTicket.jsx":"2d7181ca4e71","ui_kits/_shared/market-data.js":"ad84319db63f","ui_kits/client-ui-mobile/MobileFlat.jsx":"7cef7d5d0f5a","ui_kits/client-ui-mobile/MobileLanding.jsx":"886d59e1c4a1","ui_kits/client-ui-mobile/MobileScreens.jsx":"0670995165b2","ui_kits/client-ui-mobile/MobileSheets.jsx":"a7a9e84927dd","ui_kits/client-ui-mobile/MobileShell.jsx":"67684a4f747b","ui_kits/client-ui/AuthScreens.jsx":"7a6f957ee7ab","ui_kits/client-ui/Dashboard.jsx":"5811e98f85be","ui_kits/client-ui/DashboardFlat.jsx":"ca371e727821","ui_kits/client-ui/Dialogs.jsx":"301fb571b057","ui_kits/client-ui/Landing.jsx":"150de82c91a6","ui_kits/client-ui/Tour.jsx":"15e6f159b1f4","ui_kits/client-ui/ViewAllDialogs.jsx":"f20a92b48a6d","ui_kits/instrument-view/MarketChart.jsx":"d2f7c46b2e43","ui_kits/instrument-view/MarketPage.jsx":"4b0af2f7b3da","ui_kits/instrument-view/MarketTools.jsx":"fa9f3a23d2ea","ui_kits/reporting-ui/ActivityScreen.jsx":"70da7e972bcc","ui_kits/reporting-ui/CustomersScreen.jsx":"501a2c27f8ee","ui_kits/reporting-ui/OrdersScreen.jsx":"44b755de7ced","ui_kits/reporting-ui/ReportingShell.jsx":"8177ff0753b8","ui_kits/reporting-ui/reporting-data.js":"686e3d24db11"},"inlinedExternals":[],"unexposedExports":[{"name":"controlStyle","sourcePath":"components/forms/Input.jsx"},{"name":"formatSignedPercent","sourcePath":"components/market/ChangePill.jsx"},{"name":"mockSeries","sourcePath":"components/market/PriceChart.jsx"}]} */

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
        background: hover ? 'rgba(255, 61, 90,.3)' : 'rgba(255, 61, 90,.2)',
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
      color: it.met ? '#25eb69' : 'var(--muted-foreground)'
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
    border: '1px solid ' + (invalid ? 'rgba(255, 61, 90,.5)' : focus ? 'var(--ring)' : 'var(--input)'),
    boxShadow: focus ? '0 0 0 3px ' + (invalid ? 'rgba(255, 61, 90,.4)' : 'var(--ring-50)') : 'none',
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
  useState,
  useRef,
  useEffect
} = React;
const money = v => '$' + v.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const pct = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
function Kbd({
  children
}) {
  return /*#__PURE__*/React.createElement("kbd", {
    style: {
      display: 'inline-flex',
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 5px',
      borderRadius: 5,
      border: '1px solid var(--border)',
      background: 'var(--muted)',
      color: 'var(--muted-foreground)',
      fontFamily: 'inherit',
      fontSize: 11,
      fontWeight: 500,
      lineHeight: 1
    }
  }, children);
}

// app-instrument-search: combobox with symbol/name/price/change rows.
// Optional: keyboard shortcut (/ and ⌘K) with hint, grouped suggestions when focused and empty, trailing Trade button.
function InstrumentSearch({
  instruments = [],
  onSelect,
  size = 'md',
  placeholder = 'Search',
  embedded,
  autoFocus,
  shortcut,
  suggestions,
  action,
  style
}) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const [btnHover, setBtnHover] = useState(false);
  const input = useRef(null);
  const term = q.trim().toLowerCase();
  const results = term ? instruments.filter(i => i.symbol.toLowerCase().includes(term) || i.name.toLowerCase().includes(term)) : [];
  const groups = !term && suggestions ? suggestions.filter(g => g.items && g.items.length) : [];
  const flat = term ? results : groups.flatMap(g => g.items);
  const open = focus && (term.length > 0 || groups.length > 0);
  const lg = size === 'lg';
  const pick = i => {
    setQ('');
    input.current && input.current.blur();
    onSelect && onSelect(i);
  };
  useEffect(() => {
    if (!shortcut) return;
    const k = e => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) || e.key === '/' && !typing) {
        e.preventDefault();
        input.current && input.current.focus();
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [shortcut]);
  const key = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      flat.length && setActive((active + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      flat.length && setActive((active - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter' && open && flat[active]) {
      e.preventDefault();
      pick(flat[active]);
    } else if (e.key === 'Escape') {
      if (q) setQ('');else input.current && input.current.blur();
    }
  };
  const row = (i, idx) => /*#__PURE__*/React.createElement("li", {
    key: (term ? 'r' : 's') + idx + i.symbol,
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
  }, pct(i.changePercent))));
  let n = 0;
  const showHint = shortcut && !focus && !q;
  const padRight = (action ? lg ? 92 : 84 : 16) + (showHint ? 64 : 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'block',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: lg ? 18 : 16,
    style: {
      position: 'absolute',
      left: 16,
      top: '50%',
      transform: 'translateY(-50%)',
      color: focus && action ? 'var(--primary)' : 'var(--muted-foreground)',
      pointerEvents: 'none',
      transition: 'color 150ms'
    }
  }), /*#__PURE__*/React.createElement("input", {
    ref: input,
    type: "search",
    autoFocus: autoFocus,
    role: "combobox",
    "aria-expanded": open,
    "aria-keyshortcuts": shortcut ? '/ Control+K Meta+K' : undefined,
    autoComplete: "off",
    placeholder: placeholder,
    value: q,
    onChange: e => {
      setQ(e.target.value);
      setActive(0);
    },
    onFocus: () => {
      setFocus(true);
      setActive(0);
    },
    onBlur: () => setFocus(false),
    onKeyDown: key,
    style: {
      width: '100%',
      height: lg ? 48 : 44,
      padding: lg ? '0 ' + padRight + 'px 0 48px' : '0 ' + padRight + 'px 0 44px',
      fontSize: lg ? 16 : 14,
      color: 'var(--foreground)',
      outline: 'none',
      transition: 'border-color 150ms, box-shadow 150ms',
      ...(embedded ? {
        border: 0,
        borderBottom: '1px solid var(--border)',
        borderRadius: 0,
        background: 'transparent'
      } : {
        borderRadius: 12,
        border: '1px solid ' + (focus ? 'var(--ring)' : 'var(--border)'),
        background: 'var(--card)',
        boxShadow: focus && action ? '0 0 0 3px var(--ring-50)' : 'none'
      })
    }
  }), showHint || action ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: lg ? 6 : 5,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, showHint ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'flex',
      gap: 4,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement(Kbd, null, isMac ? '⌘' : 'Ctrl'), /*#__PURE__*/React.createElement(Kbd, null, "K")) : null, action ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onMouseDown: e => e.preventDefault(),
    onMouseEnter: () => setBtnHover(true),
    onMouseLeave: () => setBtnHover(false),
    onClick: () => {
      if (term && results[0]) pick(results[0]);else {
        input.current && input.current.focus();
        action.onClick && action.onClick();
      }
    },
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: lg ? 36 : 34,
      padding: '0 14px',
      border: 0,
      borderRadius: 8,
      cursor: 'pointer',
      fontSize: 14,
      fontWeight: 600,
      background: btnHover ? 'var(--primary-80)' : 'var(--primary)',
      color: 'var(--primary-foreground)',
      transition: 'background 150ms'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: action.icon || 'arrow-right-left',
    size: 14
  }), action.label || 'Trade') : null) : null), open ? /*#__PURE__*/React.createElement("ul", {
    role: "listbox",
    style: embedded ? {
      maxHeight: 256,
      overflowY: 'auto',
      listStyle: 'none',
      margin: 0,
      padding: '4px 0'
    } : {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '100%',
      zIndex: 20,
      marginTop: 4,
      maxHeight: 360,
      overflowY: 'auto',
      listStyle: 'none',
      padding: '4px 0',
      borderRadius: 5,
      border: '1px solid var(--border)',
      background: 'var(--popover)',
      boxShadow: 'var(--shadow-lg)'
    }
  }, term ? results.length ? results.map((i, idx) => row(i, idx)) : /*#__PURE__*/React.createElement("li", {
    style: {
      padding: '8px 16px',
      fontSize: 14,
      color: 'var(--muted-foreground)'
    }
  }, "No instruments match \"", q, "\"") : groups.map((g, gi) => /*#__PURE__*/React.createElement("li", {
    key: g.label,
    role: "presentation",
    style: {
      borderTop: gi ? '1px solid var(--border-60)' : 0,
      marginTop: gi ? 4 : 0,
      paddingTop: gi ? 4 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 16px 4px',
      color: 'var(--muted-foreground)',
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, g.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: g.icon,
    size: 12
  }) : null, g.label), /*#__PURE__*/React.createElement("ul", {
    role: "group",
    "aria-label": g.label,
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0
    }
  }, g.items.map(i => row(i, n++)))))) : null);
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
    stopColor: up ? '#25eb69' : '#ff3d5a',
    stopOpacity: "0.28"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: up ? '#25eb69' : '#ff3d5a',
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
    onTour,
    layout,
    onLayout,
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
    }, onLayout ? /*#__PURE__*/React.createElement(MenuItem, {
      icon: layout === 'flat' ? 'layout-grid' : 'rows-3',
      onClick: () => {
        close();
        onLayout(layout === 'flat' ? 'cards' : 'flat');
      }
    }, layout === 'flat' ? 'Card layout' : 'Flat layout') : null, onTour ? /*#__PURE__*/React.createElement(MenuItem, {
      icon: "circle-help",
      onClick: () => {
        close();
        onTour();
      }
    }, "Take the tour") : null, /*#__PURE__*/React.createElement(MenuItem, {
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
  // app-watchlist-star: 32px ghost icon button; filled cyan star when watched.
  function WatchlistStar({
    symbol,
    size = 32
  }) {
    const {
      Icon
    } = window.TradingSeasonDesignSystem_86c3eb;
    const list = window.TSData.useWatchlist();
    const on = list.includes(symbol);
    const [h, setH] = React.useState(false);
    const url = 'url(https://unpkg.com/lucide-static@0.469.0/icons/star.svg)';
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-pressed": on,
      "aria-label": (on ? 'Remove ' : 'Add ') + symbol + (on ? ' from watchlist' : ' to watchlist'),
      onClick: () => window.TSData.watchlist.toggle(symbol),
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        display: 'inline-flex',
        width: size,
        height: size,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        border: 0,
        cursor: 'pointer',
        background: h ? 'var(--muted)' : 'transparent',
        color: on ? 'var(--primary)' : 'var(--foreground)',
        transition: 'background 150ms'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'relative',
        width: 16,
        height: 16
      }
    }, on ? /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: 'absolute',
        inset: 1,
        background: 'currentColor',
        clipPath: 'polygon(50% 4%, 62% 37%, 97% 37%, 69% 58%, 79% 92%, 50% 72%, 21% 92%, 31% 58%, 3% 37%, 38% 37%)'
      }
    }) : null, /*#__PURE__*/React.createElement(Icon, {
      name: "star",
      size: 16,
      style: {
        position: 'absolute',
        inset: 0
      }
    })));
  }
  Object.assign(window, {
    OrderTicket,
    InstrumentBadge,
    WatchlistStar
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

  // Watchlist store (mirrors WatchlistStore: /api/me/watchlist). Persisted locally for the mock.
  const WKEY = 'ts-watchlist';
  let watch = (() => {
    try {
      return JSON.parse(localStorage.getItem(WKEY)) || ['NVDA', 'TSLA', 'META', 'GOOGL', 'SPCX'];
    } catch (e) {
      return ['NVDA', 'TSLA', 'META', 'GOOGL', 'SPCX'];
    }
  })();
  const subs = new Set();
  const watchlist = {
    get: () => watch,
    has: s => watch.includes(s),
    toggle: s => {
      watch = watch.includes(s) ? watch.filter(x => x !== s) : watch.concat(s);
      localStorage.setItem(WKEY, JSON.stringify(watch));
      subs.forEach(f => f());
    },
    subscribe: f => {
      subs.add(f);
      return () => subs.delete(f);
    }
  };
  const useWatchlist = () => window.React.useSyncExternalStore(watchlist.subscribe, watchlist.get);

  // Recently viewed instruments (opened in New Order / market page).
  const RKEY = 'ts-recent';
  const recent = {
    get: () => {
      try {
        return JSON.parse(localStorage.getItem(RKEY)) || ['AAPL', 'MSFT'];
      } catch (e) {
        return ['AAPL', 'MSFT'];
      }
    },
    push: s => {
      const l = [s].concat(recent.get().filter(x => x !== s)).slice(0, 4);
      localStorage.setItem(RKEY, JSON.stringify(l));
    }
  };
  // Search suggestion groups shown when the dashboard search is focused and empty.
  const searchSuggestions = watched => {
    const f = l => l.map(s => INSTRUMENTS.find(i => i.symbol === s)).filter(Boolean);
    const trending = INSTRUMENTS.slice().sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 3);
    return [{
      label: 'Trending',
      icon: 'flame',
      items: trending
    }, {
      label: 'Your watch list',
      icon: 'star',
      items: f(watched).slice(0, 3)
    }, {
      label: 'Recently viewed',
      icon: 'history',
      items: f(recent.get()).slice(0, 3)
    }];
  };
  window.TSData = {
    watchlist,
    useWatchlist,
    recent,
    searchSuggestions,
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

// ui_kits/client-ui-mobile/MobileFlat.jsx
try { (() => {
(() => {
  // Flat (non-bento) layout: no card containers. Full-bleed hero + chart, then hairline-separated list sections.
  const {
    DashLabel,
    DashLink,
    ChangePill,
    TimeframeToggle,
    PriceChart,
    Button,
    Icon,
    MenuItem,
    NativeSelect
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    TRANSACTIONS,
    ACCOUNTS,
    series,
    LABELS,
    COUNTS,
    money
  } = window.TSData;
  const {
    CASH,
    holdingsOf
  } = window.MobileKit;
  const rule = {
    borderTop: '1px solid var(--border)'
  };
  function Section({
    title,
    action,
    onAction,
    children,
    first
  }) {
    return /*#__PURE__*/React.createElement("section", {
      style: {
        padding: '20px 16px 8px',
        ...(first ? null : rule)
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 32
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, title), action ? /*#__PURE__*/React.createElement(DashLink, {
      onClick: onAction,
      style: {
        minHeight: 32,
        fontSize: 13
      }
    }, action) : null), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4
      }
    }, children));
  }

  // Underlined text tabs instead of the boxed segment.
  function LineTabs({
    value,
    onChange,
    options
  }) {
    return /*#__PURE__*/React.createElement("div", {
      role: "tablist",
      style: {
        display: 'flex',
        gap: 20,
        padding: '0 16px',
        borderBottom: '1px solid var(--border)'
      }
    }, options.map(([k, label]) => {
      const on = value === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        type: "button",
        role: "tab",
        "aria-selected": on,
        onClick: () => onChange(k),
        style: {
          height: 44,
          padding: 0,
          border: 0,
          borderBottom: '2px solid ' + (on ? 'var(--primary)' : 'transparent'),
          marginBottom: -1,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600,
          color: on ? 'var(--foreground)' : 'var(--muted-foreground)',
          transition: 'color 150ms, border-color 150ms'
        }
      }, label);
    }));
  }
  function SearchField({
    onSearch
  }) {
    return /*#__PURE__*/React.createElement(Pressable, {
      onClick: onSearch,
      label: "Search a stock to buy or sell",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 48,
        padding: '0 16px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--card)',
        color: 'var(--muted-foreground)',
        fontSize: 16
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 18
    }), "Search a stock to buy or sell");
  }
  function FlatHome({
    accountId,
    openOrder,
    openCash,
    setTab,
    onSearch
  }) {
    const [tf, setTf] = React.useState('1D');
    const holdings = holdingsOf();
    const invested = holdings.reduce((a, h) => a + h.value, 0);
    const pv = accountId === 1 ? invested : 21380.4;
    const alloc = invested / (invested + CASH) * 100;
    const top = holdings.slice().sort((a, b) => b.value - a.value).slice(0, 4);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        paddingBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '20px 16px 0'
      }
    }, /*#__PURE__*/React.createElement(DashLabel, null, "Net Worth"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 40,
        lineHeight: 1.1,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(invested + CASH + 21380.4)), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '8px 0 0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: 'var(--muted-foreground)'
      }
    }, /*#__PURE__*/React.createElement(ChangePill, {
      value: 2.14
    }), /*#__PURE__*/React.createElement("span", null, accountId === 1 ? 'Growth' : 'Retirement', " \xB7 ", money(pv)))), /*#__PURE__*/React.createElement(PriceChart, {
      area: true,
      points: series('portfolio' + accountId + tf, COUNTS[tf], pv),
      labels: [LABELS[tf][0], LABELS[tf][2], LABELS[tf][4]],
      height: 210,
      style: {
        margin: '12px 16px 0',
        gridTemplateColumns: 'minmax(0,1fr) 3.5rem'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 16px 0'
      }
    }, /*#__PURE__*/React.createElement(TimeframeToggle, {
      value: tf,
      onChange: setTf,
      style: {
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '20px 16px 0'
      }
    }, /*#__PURE__*/React.createElement("div", {
      role: "meter",
      "aria-label": "Allocation",
      "aria-valuenow": alloc.toFixed(0),
      style: {
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
    }, /*#__PURE__*/React.createElement("span", null, "Invested ", money(invested)), /*#__PURE__*/React.createElement("span", null, "Cash ", money(CASH))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      style: {
        height: 44
      },
      onClick: () => openCash('deposit')
    }, "Deposit"), /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      variant: "outline",
      style: {
        height: 44
      },
      onClick: () => openCash('withdraw')
    }, "Withdraw")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(SearchField, {
      onSearch: onSearch
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 24
      }
    }), /*#__PURE__*/React.createElement(Section, {
      title: "Assets",
      action: "View all",
      onAction: () => setTab('assets')
    }, top.map((h, k) => /*#__PURE__*/React.createElement(AssetRow, {
      key: h.i.symbol,
      h: h,
      last: k === top.length - 1,
      onClick: () => openOrder(h.i.symbol)
    }))), /*#__PURE__*/React.createElement(Section, {
      title: "Watch List",
      action: "View all",
      onAction: () => setTab('assets', 'watchlist')
    }, /*#__PURE__*/React.createElement(WatchlistRows, {
      openOrder: openOrder,
      limit: 4
    })), /*#__PURE__*/React.createElement(Section, {
      title: "Recent Transactions",
      action: "View all",
      onAction: () => setTab('activity')
    }, /*#__PURE__*/React.createElement("ul", {
      style: {
        listStyle: 'none',
        margin: 0,
        padding: 0
      }
    }, TRANSACTIONS.slice(0, 4).map((t, k) => /*#__PURE__*/React.createElement(TxRow, {
      key: k,
      t: t,
      last: k === 3
    })))));
  }
  function FlatAssets({
    openOrder,
    view,
    setView
  }) {
    const [sort, setSort] = React.useState('Value');
    const holdings = holdingsOf();
    const invested = holdings.reduce((a, h) => a + h.value, 0);
    const gl = holdings.reduce((a, h) => a + h.gl, 0);
    const key = {
      Value: h => -h.value,
      'Today %': h => -h.i.changePercent,
      'Gain/Loss': h => -h.gl,
      Name: h => h.i.symbol
    };
    const rows = holdings.slice().sort((a, b) => {
      const x = key[sort](a),
        y = key[sort](b);
      return typeof x === 'string' ? x.localeCompare(y) : x - y;
    });
    return /*#__PURE__*/React.createElement("div", {
      style: {
        paddingBottom: 16
      }
    }, /*#__PURE__*/React.createElement(LineTabs, {
      value: view,
      onChange: setView,
      options: [['assets', 'Assets'], ['watchlist', 'Watch List']]
    }), view === 'watchlist' ? /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '8px 16px'
      }
    }, /*#__PURE__*/React.createElement(WatchlistRows, {
      openOrder: openOrder
    })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        padding: '20px 16px 16px'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(DashLabel, null, "Invested"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(invested))), /*#__PURE__*/React.createElement("div", {
      style: {
        paddingLeft: 16,
        borderLeft: '1px solid var(--border)'
      }
    }, /*#__PURE__*/React.createElement(DashLabel, null, "Unrealized"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: '-0.025em',
        color: gl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
      },
      className: "tabular-nums"
    }, (gl >= 0 ? '+' : '') + money(gl)))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '0 16px 8px'
      }
    }, /*#__PURE__*/React.createElement(Chips, {
      value: sort,
      onChange: setSort,
      options: ['Value', 'Today %', 'Gain/Loss', 'Name']
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '0 16px',
        ...rule
      }
    }, rows.map((h, k) => /*#__PURE__*/React.createElement("div", {
      key: h.i.symbol,
      style: {
        borderBottom: k === rows.length - 1 ? 0 : '1px solid var(--border-60)'
      }
    }, /*#__PURE__*/React.createElement(AssetRow, {
      h: h,
      last: true,
      onClick: () => openOrder(h.i.symbol)
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        padding: '0 0 10px 48px',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, /*#__PURE__*/React.createElement("span", null, "Avg ", money(h.cost)), /*#__PURE__*/React.createElement("span", null, (h.value / invested * 100).toFixed(1), "% of portfolio"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: h.gl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
      }
    }, (h.gl >= 0 ? '+' : '') + money(h.gl))))))));
  }
  function FlatActivity() {
    const [kind, setKind] = React.useState('all');
    const list = TRANSACTIONS.filter(t => kind === 'all' || (kind === 'trades' ? t.kind === 'trade' : t.kind === 'cash'));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        paddingBottom: 16
      }
    }, /*#__PURE__*/React.createElement(LineTabs, {
      value: kind,
      onChange: setKind,
      options: [['all', 'All'], ['trades', 'Trades'], ['cash', 'Cash']]
    }), /*#__PURE__*/React.createElement("ul", {
      style: {
        listStyle: 'none',
        margin: 0,
        padding: '4px 16px'
      }
    }, list.length ? list.map((t, k) => /*#__PURE__*/React.createElement(TxRow, {
      key: k,
      t: t,
      last: k === list.length - 1
    })) : /*#__PURE__*/React.createElement("li", {
      style: {
        padding: '24px 0',
        textAlign: 'center',
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "No transactions yet.")));
  }

  // Settings-style grouped rows separated by hairlines.
  function GroupLabel({
    children
  }) {
    return /*#__PURE__*/React.createElement(DashLabel, {
      as: "p",
      style: {
        margin: 0,
        padding: '24px 16px 8px'
      }
    }, children);
  }
  function FlatAccount({
    accountId,
    onPick,
    onSignOut
  }) {
    const row = {
      minHeight: 56,
      borderRadius: 0,
      padding: '8px 16px',
      borderBottom: '1px solid var(--border-60)'
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        paddingBottom: 24
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '24px 16px 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 56,
        height: 56,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--primary-15)',
        color: 'var(--primary)',
        fontSize: 18,
        fontWeight: 600
      }
    }, "SC"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, "Sean Cheema"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 13,
        color: 'var(--muted-foreground)'
      }
    }, "sean@example.com \xB7 Advanced"))), /*#__PURE__*/React.createElement(GroupLabel, null, "Accounts"), /*#__PURE__*/React.createElement("div", {
      style: rule
    }, ACCOUNTS.map(a => /*#__PURE__*/React.createElement(MenuItem, {
      key: a.id,
      style: row,
      onClick: () => onPick(a.id),
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
    }, "Portfolio ", money(a.id === 1 ? 7604.68 : 21380.4)))), /*#__PURE__*/React.createElement(MenuItem, {
      tone: "primary",
      icon: "plus",
      style: row
    }, "New account")), /*#__PURE__*/React.createElement(GroupLabel, null, "Security"), /*#__PURE__*/React.createElement("div", {
      style: {
        ...rule,
        padding: '16px 16px 0'
      }
    }, /*#__PURE__*/React.createElement("label", {
      htmlFor: "f-idle",
      style: {
        display: 'block',
        fontSize: 14,
        fontWeight: 500,
        marginBottom: 8
      }
    }, "Sign out after inactivity"), /*#__PURE__*/React.createElement(NativeSelect, {
      id: "f-idle",
      radius: 5,
      value: "15",
      style: {
        height: 44
      },
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
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '8px 0 0',
        fontSize: 13,
        lineHeight: 1.5,
        color: 'var(--muted-foreground)'
      }
    }, "You will be signed out automatically when there is no mouse, keyboard or touch input for this long. Changes apply immediately.")), /*#__PURE__*/React.createElement("div", {
      style: {
        ...rule,
        marginTop: 24
      }
    }, /*#__PURE__*/React.createElement(MenuItem, {
      icon: "log-out",
      tone: "danger",
      style: row,
      onClick: onSignOut
    }, "Log out")));
  }
  Object.assign(window, {
    FlatHome,
    FlatAssets,
    FlatActivity,
    FlatAccount
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui-mobile/MobileFlat.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client-ui-mobile/MobileLanding.jsx
try { (() => {
(() => {
  const {
    Button
  } = window.TradingSeasonDesignSystem_86c3eb;
  function MobileLanding({
    go
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        display: 'flex',
        minHeight: '100%',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '0 20px',
        background: 'var(--background)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '70%',
        pointerEvents: 'none',
        background: 'var(--texture-hairlines)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 75%)',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 75%)'
      }
    }), /*#__PURE__*/React.createElement("header", {
      style: {
        position: 'relative',
        display: 'flex',
        height: 72,
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/2b-waves.svg",
      alt: "",
      style: {
        width: 40,
        height: 40
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, "TradingSeason")), /*#__PURE__*/React.createElement("section", {
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 56,
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: 52,
        lineHeight: 1,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, "Ride the market."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '20px 0 0',
        maxWidth: 320,
        fontSize: 16,
        color: 'var(--muted-foreground)',
        textWrap: 'balance'
      }
    }, "Live prices, instant trades, smarter portfolios. Stay ahead of the market."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "cta",
      fullWidth: true,
      onClick: () => go('register')
    }, "Get started"), /*#__PURE__*/React.createElement(Button, {
      size: "cta",
      variant: "outline",
      radius: 5,
      fullWidth: true,
      style: {
        fontWeight: 400,
        background: 'var(--background)',
        borderColor: 'var(--border)'
      },
      onClick: () => go('login')
    }, "Sign in"))), /*#__PURE__*/React.createElement(LandingGraph, {
      height: "34%",
      bleed: 20
    }));
  }
  window.MobileLanding = MobileLanding;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui-mobile/MobileLanding.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client-ui-mobile/MobileScreens.jsx
try { (() => {
(() => {
  const {
    DashCard,
    DashLabel,
    ChangePill,
    TimeframeToggle,
    PriceChart,
    Button
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    INSTRUMENTS,
    TRANSACTIONS,
    series,
    LABELS,
    COUNTS,
    money,
    pct,
    find
  } = window.TSData;
  const {
    CASH,
    holdingsOf
  } = window.MobileKit;
  const pad = {
    padding: '16px 16px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  };
  function NetWorthCard({
    invested,
    openCash
  }) {
    const alloc = invested / (invested + CASH) * 100;
    return /*#__PURE__*/React.createElement(DashCard, {
      variant: "net-worth",
      padding: 16
    }, /*#__PURE__*/React.createElement(DashLabel, null, "Net Worth"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 36,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(invested + CASH + 21380.4)), /*#__PURE__*/React.createElement("div", {
      role: "meter",
      "aria-label": "Allocation",
      "aria-valuenow": alloc.toFixed(0),
      style: {
        marginTop: 16,
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
    }, /*#__PURE__*/React.createElement("span", null, "Invested ", money(invested)), /*#__PURE__*/React.createElement("span", null, "Cash ", money(CASH))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      style: {
        height: 44
      },
      onClick: () => openCash('deposit')
    }, "Deposit"), /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      variant: "glass",
      style: {
        height: 44
      },
      onClick: () => openCash('withdraw')
    }, "Withdraw")));
  }
  function WatchlistRows({
    openOrder,
    limit
  }) {
    const list = window.TSData.useWatchlist();
    const rows = (limit ? list.slice(0, limit) : list).map(find).filter(Boolean);
    if (!list.length) return /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        padding: '16px 0',
        textAlign: 'center',
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "Search for a stock and tap its star to add it to your watchlist.");
    return rows.map((i, k) => /*#__PURE__*/React.createElement(AssetRow, {
      key: i.symbol,
      h: {
        i
      },
      last: k === rows.length - 1,
      onClick: () => openOrder(i.symbol)
    }));
  }
  function MobileHome({
    accountId,
    openOrder,
    openCash,
    setTab
  }) {
    const [tf, setTf] = React.useState('1D');
    const holdings = holdingsOf();
    const invested = holdings.reduce((a, h) => a + h.value, 0);
    const pv = accountId === 1 ? invested : 21380.4;
    const top = holdings.slice().sort((a, b) => b.value - a.value).slice(0, 3);
    return /*#__PURE__*/React.createElement("div", {
      style: pad
    }, /*#__PURE__*/React.createElement(NetWorthCard, {
      invested: invested,
      openCash: openCash
    }), /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, /*#__PURE__*/React.createElement(DashLabel, null, "Portfolio Value ", /*#__PURE__*/React.createElement("span", {
      style: {
        textTransform: 'none',
        letterSpacing: 'normal'
      }
    }, "\xB7 ", accountId === 1 ? 'Growth' : 'Retirement')), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(pv)), /*#__PURE__*/React.createElement(ChangePill, {
      value: 2.14
    })), /*#__PURE__*/React.createElement(PriceChart, {
      area: true,
      points: series('portfolio' + accountId + tf, COUNTS[tf], pv),
      labels: [LABELS[tf][0], LABELS[tf][2], LABELS[tf][4]],
      height: 200,
      style: {
        marginTop: 4,
        gridTemplateColumns: 'minmax(0,1fr) 3.5rem'
      }
    }), /*#__PURE__*/React.createElement(TimeframeToggle, {
      value: tf,
      onChange: setTf,
      style: {
        marginTop: 12,
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)'
      }
    })), /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, /*#__PURE__*/React.createElement(SectionHead, {
      title: "Assets",
      action: "View all",
      onAction: () => setTab('assets')
    }), top.map((h, k) => /*#__PURE__*/React.createElement(AssetRow, {
      key: h.i.symbol,
      h: h,
      last: k === top.length - 1,
      onClick: () => openOrder(h.i.symbol)
    }))), /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, /*#__PURE__*/React.createElement(SectionHead, {
      title: "Watch List",
      action: "View all",
      onAction: () => setTab('assets', 'watchlist')
    }), /*#__PURE__*/React.createElement(WatchlistRows, {
      openOrder: openOrder,
      limit: 4
    })), /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, /*#__PURE__*/React.createElement(SectionHead, {
      title: "Recent Transactions",
      action: "View all",
      onAction: () => setTab('activity')
    }), /*#__PURE__*/React.createElement("ul", {
      style: {
        listStyle: 'none',
        margin: 0,
        padding: 0
      }
    }, TRANSACTIONS.slice(0, 4).map((t, k) => /*#__PURE__*/React.createElement(TxRow, {
      key: k,
      t: t,
      last: k === 3
    })))));
  }
  function Chips({
    value,
    onChange,
    options
  }) {
    return /*#__PURE__*/React.createElement("div", {
      role: "group",
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, options.map(o => {
      const on = o === value;
      return /*#__PURE__*/React.createElement("button", {
        key: o,
        type: "button",
        "aria-pressed": on,
        onClick: () => onChange(o),
        style: {
          height: 32,
          padding: '0 14px',
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          border: '1px solid ' + (on ? 'rgba(0,187,255,.4)' : 'var(--border)'),
          background: on ? 'var(--primary-10)' : 'transparent',
          color: on ? 'var(--primary)' : 'var(--muted-foreground)',
          transition: 'all 150ms'
        }
      }, o);
    }));
  }
  function MobileAssets({
    openOrder,
    view,
    setView
  }) {
    const [sort, setSort] = React.useState('Value');
    const seg = /*#__PURE__*/React.createElement(TimeframeToggle, {
      value: view === 'watchlist' ? 'Watch List' : 'Assets',
      onChange: v => setView(v === 'Assets' ? 'assets' : 'watchlist'),
      options: ['Assets', 'Watch List'],
      style: {
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr'
      }
    });
    if (view === 'watchlist') return /*#__PURE__*/React.createElement("div", {
      style: pad
    }, seg, /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, /*#__PURE__*/React.createElement(WatchlistRows, {
      openOrder: openOrder
    })));
    const holdings = holdingsOf();
    const invested = holdings.reduce((a, h) => a + h.value, 0);
    const gl = holdings.reduce((a, h) => a + h.gl, 0);
    const key = {
      Value: h => -h.value,
      'Today %': h => -h.i.changePercent,
      'Gain/Loss': h => -h.gl,
      Name: h => h.i.symbol
    };
    const rows = holdings.slice().sort((a, b) => {
      const x = key[sort](a),
        y = key[sort](b);
      return typeof x === 'string' ? x.localeCompare(y) : x - y;
    });
    return /*#__PURE__*/React.createElement("div", {
      style: pad
    }, seg, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, /*#__PURE__*/React.createElement(DashLabel, null, "Invested"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(invested))), /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, /*#__PURE__*/React.createElement(DashLabel, null, "Unrealized"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: '-0.025em',
        color: gl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
      },
      className: "tabular-nums"
    }, (gl >= 0 ? '+' : '') + money(gl)))), /*#__PURE__*/React.createElement(Chips, {
      value: sort,
      onChange: setSort,
      options: ['Value', 'Today %', 'Gain/Loss', 'Name']
    }), /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, rows.map((h, k) => /*#__PURE__*/React.createElement("div", {
      key: h.i.symbol
    }, /*#__PURE__*/React.createElement(AssetRow, {
      h: h,
      last: true,
      onClick: () => openOrder(h.i.symbol)
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        padding: '0 0 10px 48px',
        fontSize: 12,
        color: 'var(--muted-foreground)',
        borderBottom: k === rows.length - 1 ? 0 : '1px solid var(--border-60)'
      },
      className: "tabular-nums"
    }, /*#__PURE__*/React.createElement("span", null, "Avg ", money(h.cost)), /*#__PURE__*/React.createElement("span", null, (h.value / invested * 100).toFixed(1), "% of portfolio"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: h.gl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
      }
    }, (h.gl >= 0 ? '+' : '') + money(h.gl)))))));
  }
  function MobileActivity() {
    const [kind, setKind] = React.useState('All');
    const list = TRANSACTIONS.filter(t => kind === 'All' || (kind === 'Trades' ? t.kind === 'trade' : t.kind === 'cash'));
    return /*#__PURE__*/React.createElement("div", {
      style: pad
    }, /*#__PURE__*/React.createElement(Chips, {
      value: kind,
      onChange: setKind,
      options: ['All', 'Trades', 'Cash']
    }), /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, list.length ? /*#__PURE__*/React.createElement("ul", {
      style: {
        listStyle: 'none',
        margin: 0,
        padding: 0
      }
    }, list.map((t, k) => /*#__PURE__*/React.createElement(TxRow, {
      key: k,
      t: t,
      last: k === list.length - 1
    }))) : /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        padding: '16px 0',
        textAlign: 'center',
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "No transactions yet.")));
  }
  Object.assign(window, {
    MobileHome,
    MobileAssets,
    MobileActivity,
    WatchlistRows,
    Chips
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui-mobile/MobileScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client-ui-mobile/MobileSheets.jsx
try { (() => {
(() => {
  const {
    DashCard,
    DashLabel,
    ChangePill,
    TimeframeToggle,
    PriceChart,
    Field,
    Input,
    NativeSelect,
    Button,
    Icon,
    MenuItem
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    INSTRUMENTS,
    ACCOUNTS,
    series,
    LABELS,
    COUNTS,
    money,
    pct,
    find
  } = window.TSData;
  const {
    CASH
  } = window.MobileKit;
  function OrderSheet({
    symbol,
    onClose
  }) {
    const [tf, setTf] = React.useState('1D');
    const i = find(symbol);
    return /*#__PURE__*/React.createElement(BottomSheet, {
      title: "New Order",
      tall: true,
      onClose: onClose
    }, /*#__PURE__*/React.createElement("div", {
      style: {
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
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 18,
        lineHeight: 1.25,
        fontWeight: 600
      }
    }, i.symbol, /*#__PURE__*/React.createElement(WatchlistStar, {
      symbol: i.symbol,
      size: 40
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, i.name))), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '12px 0 0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 10
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
    }, (i.change >= 0 ? '+' : '') + money(i.change) + ' (' + pct(i.changePercent) + ')')), /*#__PURE__*/React.createElement(PriceChart, {
      points: series(i.symbol + tf, COUNTS[tf], i.price),
      labels: [LABELS[tf][0], LABELS[tf][2], LABELS[tf][4]],
      height: 170,
      style: {
        marginTop: 4,
        gridTemplateColumns: 'minmax(0,1fr) 3.5rem'
      }
    }), /*#__PURE__*/React.createElement(TimeframeToggle, {
      value: tf,
      onChange: setTf,
      style: {
        marginTop: 12,
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '20px -20px 0',
        borderTop: '1px solid var(--border)',
        padding: '20px 20px 0'
      }
    }, /*#__PURE__*/React.createElement(OrderTicket, {
      key: symbol,
      instrument: i,
      onSubmit: onClose
    })));
  }
  function CashSheet({
    mode,
    onClose
  }) {
    const dep = mode === 'deposit';
    const [amt, setAmt] = React.useState('');
    const [touched, setTouched] = React.useState(false);
    const v = Number(amt);
    const err = !amt || v <= 0 ? 'Enter an amount greater than $0.' : !dep && v > CASH ? "That's more than your available cash." : '';
    return /*#__PURE__*/React.createElement(BottomSheet, {
      title: dep ? 'Deposit funds' : 'Withdraw funds',
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
      htmlFor: "m-cash",
      error: touched && err,
      description: /*#__PURE__*/React.createElement("span", {
        className: "tabular-nums"
      }, "Available cash: ", money(CASH))
    }, /*#__PURE__*/React.createElement(Input, {
      id: "m-cash",
      icon: "dollar-sign",
      type: "number",
      inputMode: "decimal",
      placeholder: "0.00",
      radius: 5,
      height: 44,
      value: amt,
      onChange: e => setAmt(e.target.value),
      invalid: touched && !!err,
      inputStyle: {
        fontSize: 16
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      radius: 5,
      style: {
        height: 44
      },
      onClick: onClose
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      type: "submit",
      radius: 5,
      style: {
        height: 44
      }
    }, dep ? 'Deposit' : 'Withdraw'))));
  }
  function SearchSheet({
    onClose,
    openOrder
  }) {
    const [q, setQ] = React.useState('');
    const watched = window.TSData.useWatchlist();
    const t = q.trim().toLowerCase();
    const list = INSTRUMENTS.filter(i => i.symbol.toLowerCase().includes(t) || i.name.toLowerCase().includes(t));
    const go = s => {
      onClose();
      window.TSData.recent.push(s);
      openOrder(s);
    };
    const groups = t ? [] : window.TSData.searchSuggestions(watched).filter(g => g.items.length);
    return /*#__PURE__*/React.createElement(BottomSheet, {
      title: "Trade",
      tall: true,
      onClose: onClose
    }, /*#__PURE__*/React.createElement(Input, {
      icon: "search",
      type: "search",
      autoFocus: true,
      placeholder: "Search a stock to buy or sell",
      height: 44,
      radius: 12,
      value: q,
      onChange: e => setQ(e.target.value),
      inputStyle: {
        fontSize: 16,
        background: 'var(--background)'
      }
    }), t ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DashLabel, {
      as: "p",
      style: {
        margin: '20px 0 4px'
      }
    }, "Results"), list.length ? list.map((i, k) => /*#__PURE__*/React.createElement(AssetRow, {
      key: i.symbol,
      h: {
        i
      },
      last: k === list.length - 1,
      onClick: () => go(i.symbol)
    })) : /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        padding: '16px 0',
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "No instruments match \"", q, "\"")) : groups.map(g => /*#__PURE__*/React.createElement("div", {
      key: g.label
    }, /*#__PURE__*/React.createElement(DashLabel, {
      as: "p",
      style: {
        margin: '20px 0 4px',
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: g.icon,
      size: 12
    }), g.label), g.items.map((i, k) => /*#__PURE__*/React.createElement(AssetRow, {
      key: i.symbol,
      h: {
        i
      },
      last: k === g.items.length - 1,
      onClick: () => go(i.symbol)
    })))));
  }
  function AccountSheet({
    accountId,
    onPick,
    onClose
  }) {
    return /*#__PURE__*/React.createElement(BottomSheet, {
      title: "Accounts",
      onClose: onClose
    }, /*#__PURE__*/React.createElement("div", {
      role: "menu",
      style: {
        margin: '-8px -12px 0'
      }
    }, ACCOUNTS.map(a => /*#__PURE__*/React.createElement(MenuItem, {
      key: a.id,
      style: {
        minHeight: 56
      },
      onClick: () => {
        onPick(a.id);
        onClose();
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
      style: {
        minHeight: 48
      },
      onClick: onClose
    }, "New account")));
  }
  function MobileAccount({
    accountId,
    onPick,
    onSignOut
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '16px 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(DashCard, {
      padding: 16,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 48,
        height: 48,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--primary-15)',
        color: 'var(--primary)',
        fontSize: 16,
        fontWeight: 600
      }
    }, "SC"), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 16,
        fontWeight: 600
      }
    }, "Sean Cheema"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, "sean@example.com \xB7 Advanced"))), /*#__PURE__*/React.createElement(DashCard, {
      padding: 8
    }, /*#__PURE__*/React.createElement(DashLabel, {
      as: "p",
      style: {
        margin: '8px 8px 4px'
      }
    }, "Accounts"), ACCOUNTS.map(a => /*#__PURE__*/React.createElement(MenuItem, {
      key: a.id,
      style: {
        minHeight: 56
      },
      onClick: () => onPick(a.id),
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
    }, "Portfolio ", money(a.id === 1 ? 7604.68 : 21380.4)))), /*#__PURE__*/React.createElement(MenuItem, {
      tone: "primary",
      icon: "plus",
      style: {
        minHeight: 48
      }
    }, "New account")), /*#__PURE__*/React.createElement(DashCard, {
      padding: 16
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, "Security"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '2px 0 16px',
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "Control how long you stay signed in on this browser."), /*#__PURE__*/React.createElement(Field, {
      label: "Sign out after inactivity",
      htmlFor: "m-idle",
      description: "You will be signed out automatically when there is no mouse, keyboard or touch input for this long. Changes apply immediately."
    }, /*#__PURE__*/React.createElement(NativeSelect, {
      id: "m-idle",
      radius: 5,
      value: "15",
      style: {
        height: 44
      },
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
    }))), /*#__PURE__*/React.createElement(DashCard, {
      padding: 8
    }, /*#__PURE__*/React.createElement(MenuItem, {
      icon: "log-out",
      tone: "danger",
      style: {
        minHeight: 48
      },
      onClick: onSignOut
    }, "Log out")));
  }
  Object.assign(window, {
    OrderSheet,
    CashSheet,
    SearchSheet,
    AccountSheet,
    MobileAccount
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui-mobile/MobileSheets.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client-ui-mobile/MobileShell.jsx
try { (() => {
(() => {
  const {
    Icon,
    ChangePill,
    Sparkline,
    DashLink
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    POSITIONS,
    ACCOUNTS,
    series,
    money,
    pct,
    find
  } = window.TSData;
  const CASH = 4820.55;
  const holdingsOf = () => Object.entries(POSITIONS).map(([sym, p]) => {
    const i = find(sym);
    return {
      i,
      ...p,
      value: p.shares * i.price,
      gl: p.shares * (i.price - p.cost)
    };
  });
  const todaySeries = i => series(i.symbol + 'today', 27, i.price).map(v => i.change < 0 ? 2 * i.price - v : v);

  // Touch-friendly row/button: muted wash while pressed or hovered.
  function Pressable({
    children,
    onClick,
    style,
    label
  }) {
    const [on, setOn] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": label,
      onClick: onClick,
      onPointerEnter: () => setOn(true),
      onPointerLeave: () => setOn(false),
      onPointerDown: () => setOn(true),
      onPointerUp: () => setOn(false),
      style: {
        border: 0,
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background 150ms',
        background: on ? 'var(--muted)' : 'transparent',
        WebkitTapHighlightColor: 'transparent',
        ...style
      }
    }, children);
  }
  const IconBtn = ({
    icon,
    label,
    onClick
  }) => /*#__PURE__*/React.createElement(Pressable, {
    label: label,
    onClick: onClick,
    style: {
      width: 44,
      height: 44,
      borderRadius: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--muted-foreground)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 20
  }));
  function TopBar({
    accountId,
    onAccount,
    onSearch,
    onProfile
  }) {
    const acct = ACCOUNTS.find(a => a.id === accountId) || ACCOUNTS[0];
    return /*#__PURE__*/React.createElement("header", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 56,
        flexShrink: 0,
        padding: '0 8px 0 16px',
        background: 'rgba(14,14,14,.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border-60)',
        zIndex: 5
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/2b-waves.svg",
      alt: "TradingSeason",
      style: {
        width: 28,
        height: 28
      }
    }), /*#__PURE__*/React.createElement(Pressable, {
      onClick: onAccount,
      label: "Select account",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 36,
        padding: '0 10px 0 12px',
        borderRadius: 9999,
        border: '1px solid var(--border)',
        fontSize: 14,
        fontWeight: 500
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "briefcase-business",
      size: 14,
      style: {
        color: 'var(--muted-foreground)'
      }
    }), acct.name, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-down",
      size: 14,
      style: {
        color: 'var(--muted-foreground)'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(IconBtn, {
      icon: "search",
      label: "Search instruments",
      onClick: onSearch
    }), /*#__PURE__*/React.createElement(Pressable, {
      onClick: onProfile,
      label: "Open account",
      style: {
        width: 36,
        height: 36,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--primary)',
        background: 'var(--primary-15)'
      }
    }, "SC"));
  }
  const TABS = [['home', 'Home', 'house'], ['assets', 'Assets', 'chart-pie'], ['activity', 'Activity', 'arrow-right-left'], ['account', 'Account', 'user-round']];
  function TabBar({
    tab,
    setTab
  }) {
    return /*#__PURE__*/React.createElement("nav", {
      "aria-label": "Primary",
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        flexShrink: 0,
        height: 64,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        zIndex: 5
      }
    }, TABS.map(([k, label, icon]) => {
      const on = tab === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        type: "button",
        "aria-current": on ? 'page' : undefined,
        onClick: () => setTab(k),
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 500,
          color: on ? 'var(--primary)' : 'var(--muted-foreground)',
          transition: 'color 150ms',
          WebkitTapHighlightColor: 'transparent'
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: icon,
        size: 20
      }), label);
    }));
  }

  // Mobile adaptation of the dialog: bottom sheet with grab handle, same bordered header.
  function BottomSheet({
    title,
    onClose,
    children,
    tall
  }) {
    React.useEffect(() => {
      const k = e => e.key === 'Escape' && onClose();
      document.addEventListener('keydown', k);
      return () => document.removeEventListener('keydown', k);
    }, [onClose]);
    const {
      CloseButton
    } = window.TradingSeasonDesignSystem_86c3eb;
    return /*#__PURE__*/React.createElement("div", {
      onClick: onClose,
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'var(--scrim)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'ts-fade-in 150ms ease-out both'
      }
    }, /*#__PURE__*/React.createElement("section", {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": typeof title === 'string' ? title : undefined,
      onClick: e => e.stopPropagation(),
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: tall ? '92%' : undefined,
        maxHeight: '92%',
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        borderRadius: '16px 16px 0 0',
        boxShadow: 'var(--shadow-dialog)',
        animation: 'ts-sheet-in 260ms cubic-bezier(0.16,1,0.3,1) both'
      }
    }, /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        width: 36,
        height: 4,
        borderRadius: 9999,
        background: 'var(--foreground-10)',
        margin: '8px auto 0'
      }
    }), /*#__PURE__*/React.createElement("header", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '4px 12px 8px 20px',
        borderBottom: '1px solid var(--border)'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600
      }
    }, title), /*#__PURE__*/React.createElement(CloseButton, {
      onClick: onClose
    })), /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px 20px calc(20px + env(safe-area-inset-bottom))'
      }
    }, children)));
  }
  const SectionHead = ({
    title,
    action,
    onAction
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 14,
      fontWeight: 600
    }
  }, title), action ? /*#__PURE__*/React.createElement(DashLink, {
    onClick: onAction,
    style: {
      minHeight: 32
    }
  }, action) : null);
  function AssetRow({
    h,
    onClick,
    last
  }) {
    const i = h.i;
    return /*#__PURE__*/React.createElement(Pressable, {
      onClick: onClick,
      label: 'Trade ' + i.symbol,
      style: {
        display: 'grid',
        gridTemplateColumns: '36px minmax(0,1fr) 56px auto',
        alignItems: 'center',
        gap: 12,
        width: 'calc(100% + 16px)',
        margin: '0 -8px',
        minHeight: 60,
        padding: '8px',
        borderRadius: 10,
        borderBottom: last ? 0 : '1px solid var(--border-60)'
      }
    }, /*#__PURE__*/React.createElement(InstrumentBadge, {
      symbol: i.symbol,
      size: 36
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 14,
        fontWeight: 500
      }
    }, i.symbol), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--muted-foreground)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      },
      className: "tabular-nums"
    }, h.shares != null ? h.shares + ' shares' : i.name)), /*#__PURE__*/React.createElement(Sparkline, {
      points: todaySeries(i)
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 14
      }
    }, money(h.value != null ? h.value : i.price)), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: i.changePercent >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
      }
    }, pct(i.changePercent))));
  }
  function TxRow({
    t,
    last
  }) {
    const cashT = t.kind === 'cash',
      dep = t.reason === 'DEPOSIT';
    return /*#__PURE__*/React.createElement("li", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        minHeight: 56,
        padding: '8px 0',
        fontSize: 14,
        borderBottom: last ? 0 : '1px solid var(--border-60)'
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
  }
  Object.assign(window, {
    MobileKit: {
      CASH,
      holdingsOf,
      todaySeries
    },
    Pressable,
    TopBar,
    TabBar,
    BottomSheet,
    SectionHead,
    AssetRow,
    TxRow
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui-mobile/MobileShell.jsx", error: String((e && e.message) || e) }); }

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
    children,
    mobile
  }) {
    if (mobile) return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        alignItems: 'center',
        padding: '8px 16px 32px',
        background: 'var(--background)'
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/2b-waves-lockup-reversed.svg",
      alt: "TradingSeason",
      style: {
        height: 96,
        width: 'auto',
        margin: '0 0 8px'
      }
    }), children);
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
    timedOut,
    mobile
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
    return /*#__PURE__*/React.createElement(AuthShell, {
      mobile: mobile
    }, /*#__PURE__*/React.createElement(Card, {
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
    go,
    mobile
  }) {
    const [pw, setPw] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const two = {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    };
    return /*#__PURE__*/React.createElement(AuthShell, {
      mobile: mobile
    }, /*#__PURE__*/React.createElement(Card, {
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

  // Assets | Watch List segmented tablist (dashboard.component.html portfolioTabs)
  function PortfolioTabs({
    value,
    onChange
  }) {
    const [h, setH] = React.useState(null);
    return /*#__PURE__*/React.createElement("div", {
      role: "tablist",
      "aria-label": "Assets and watch list",
      style: {
        display: 'flex',
        gap: 2,
        padding: 2,
        borderRadius: 8,
        background: 'var(--muted)'
      }
    }, [['assets', 'Assets'], ['watchlist', 'Watch List']].map(([id, label]) => {
      const on = value === id;
      return /*#__PURE__*/React.createElement("button", {
        key: id,
        type: "button",
        role: "tab",
        "aria-selected": on,
        onClick: () => onChange(id),
        onMouseEnter: () => setH(id),
        onMouseLeave: () => setH(null),
        style: {
          cursor: 'pointer',
          border: 0,
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 14,
          fontWeight: 600,
          transition: 'color 150ms, background 150ms',
          background: on ? 'var(--primary)' : 'transparent',
          color: on ? 'var(--primary-foreground)' : h === id ? 'var(--foreground)' : 'var(--muted-foreground)'
        }
      }, label);
    }));
  }
  const WCOLS = 'minmax(4.75rem,1fr) minmax(4rem,.7fr) minmax(5.25rem,.95fr) minmax(5.25rem,.95fr) minmax(4.75rem,.8fr)';
  function WatchlistTable({
    openOrder
  }) {
    const list = window.TSData.useWatchlist();
    return /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: {
        marginTop: 16,
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingBottom: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...head,
        display: 'grid',
        gridTemplateColumns: WCOLS,
        gap: 6,
        padding: '0 8px 8px',
        whiteSpace: 'nowrap',
        position: 'sticky',
        top: 0,
        background: 'var(--card)'
      }
    }, /*#__PURE__*/React.createElement("span", null, "Asset"), /*#__PURE__*/React.createElement("span", null, "Today"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Price"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Change"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Change %")), /*#__PURE__*/React.createElement("ul", {
      style: {
        listStyle: 'none',
        margin: 0,
        padding: 0
      }
    }, list.map(s => {
      const i = find(s);
      return /*#__PURE__*/React.createElement("li", {
        key: s
      }, i ? /*#__PURE__*/React.createElement(Hover, {
        "aria-label": 'Watch list: ' + i.name,
        onClick: () => openOrder(i.symbol),
        style: {
          display: 'grid',
          width: '100%',
          gridTemplateColumns: WCOLS,
          alignItems: 'center',
          gap: 6,
          borderRadius: 8,
          padding: '10px 8px',
          fontSize: 14,
          whiteSpace: 'nowrap'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 500
        }
      }, i.symbol), /*#__PURE__*/React.createElement(Sparkline, {
        points: series(i.symbol + 'today', 27, i.price).map(v => i.change < 0 ? 2 * i.price - v : v)
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          textAlign: 'right'
        },
        className: "tabular-nums"
      }, money(i.price)), /*#__PURE__*/React.createElement("span", {
        style: {
          textAlign: 'right',
          ...gl(i.change)
        },
        className: "tabular-nums"
      }, (i.change >= 0 ? '+' : '') + money(i.change)), /*#__PURE__*/React.createElement("span", {
        style: {
          textAlign: 'right',
          ...gl(i.changePercent)
        },
        className: "tabular-nums"
      }, pct(i.changePercent))) : /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'flex',
          minHeight: 44,
          alignItems: 'center',
          padding: '0 8px',
          fontSize: 14,
          color: 'var(--muted-foreground)'
        }
      }, s, " unavailable"));
    }), list.length ? null : /*#__PURE__*/React.createElement("li", {
      style: {
        padding: '24px 8px',
        textAlign: 'center',
        fontSize: 14,
        color: 'var(--muted-foreground)'
      }
    }, "Search for a stock and click its star to add it to your watchlist.")));
  }
  function Dashboard({
    openOrder,
    openCash,
    accountId,
    openAllTransactions,
    openAllAssets
  }) {
    const watched = window.TSData.useWatchlist();
    const [tf, setTf] = React.useState('1D');
    const [tab, setTab] = React.useState(() => localStorage.getItem('ts-assets-tab') || 'assets');
    React.useEffect(() => {
      localStorage.setItem('ts-assets-tab', tab);
    }, [tab]);
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
    }, /*#__PURE__*/React.createElement(DashCard, {
      "data-tour": "networth",
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
    }, money(invested + cash + 21380.4)), /*#__PURE__*/React.createElement("div", {
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
    }, /*#__PURE__*/React.createElement("div", {
      "data-tour": "search",
      style: {
        flexShrink: 0,
        position: 'relative',
        zIndex: 25
      }
    }, /*#__PURE__*/React.createElement(InstrumentSearch, {
      size: "lg",
      placeholder: "Search a stock to buy or sell",
      shortcut: true,
      action: {
        label: 'Trade'
      },
      suggestions: window.TSData.searchSuggestions(watched),
      instruments: INSTRUMENTS,
      onSelect: i => openOrder(i.symbol)
    })), /*#__PURE__*/React.createElement(DashCard, {
      "data-tour": "portfolio",
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
    }, money(pv)), /*#__PURE__*/React.createElement(ChangePill, {
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
      "data-tour": "assets",
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
    }, /*#__PURE__*/React.createElement(PortfolioTabs, {
      value: tab,
      onChange: setTab
    }), tab === 'assets' ? /*#__PURE__*/React.createElement(DashLink, {
      onClick: openAllAssets
    }, "View all") : null), tab === 'watchlist' ? /*#__PURE__*/React.createElement(WatchlistTable, {
      openOrder: openOrder
    }) : /*#__PURE__*/React.createElement("div", {
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
  Object.assign(window, {
    Dashboard,
    WatchlistTable
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client-ui/DashboardFlat.jsx
try { (() => {
(() => {
  // Flat (non-bento) dashboard: no card containers. A main column of stacked, hairline-separated sections
  // and a full-height right rail for Recent Transactions.
  const {
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
  const gl = v => ({
    color: v >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
  });
  const rule = '1px solid var(--border)';
  const cell = {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };
  function Row({
    children,
    onClick,
    label,
    cols
  }) {
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": label,
      onClick: onClick,
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        display: 'grid',
        width: '100%',
        gridTemplateColumns: cols,
        alignItems: 'center',
        gap: 10,
        padding: '10px 8px',
        border: 0,
        borderBottom: '1px solid var(--border-60)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
        fontSize: 14,
        whiteSpace: 'nowrap',
        background: h ? 'rgba(26,26,26,.7)' : 'transparent',
        transition: 'background 150ms'
      }
    }, children);
  }
  function LineTabs({
    value,
    onChange,
    options
  }) {
    const [hov, setHov] = React.useState(null);
    return /*#__PURE__*/React.createElement("div", {
      role: "tablist",
      "aria-label": "Assets and watch list",
      style: {
        display: 'flex',
        gap: 24
      }
    }, options.map(([k, label]) => {
      const on = value === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        type: "button",
        role: "tab",
        "aria-selected": on,
        onClick: () => onChange(k),
        onMouseEnter: () => setHov(k),
        onMouseLeave: () => setHov(null),
        style: {
          height: 40,
          padding: 0,
          border: 0,
          borderBottom: '2px solid ' + (on ? 'var(--primary)' : 'transparent'),
          marginBottom: -1,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          color: on || hov === k ? 'var(--foreground)' : 'var(--muted-foreground)',
          transition: 'color 150ms, border-color 150ms'
        }
      }, label);
    }));
  }
  function FlatDashboard({
    openOrder,
    openCash,
    accountId,
    openAllTransactions,
    openAllAssets
  }) {
    const watched = window.TSData.useWatchlist();
    const [tf, setTf] = React.useState('1D');
    const [tab, setTab] = React.useState(() => localStorage.getItem('ts-assets-tab') || 'assets');
    React.useEffect(() => {
      localStorage.setItem('ts-assets-tab', tab);
    }, [tab]);
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
        flex: 1,
        minHeight: 0,
        gridTemplateColumns: 'minmax(0,1fr) 360px',
        borderTop: rule
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: {
        display: 'flex',
        minWidth: 0,
        minHeight: 0,
        flexDirection: 'column',
        paddingRight: 32,
        overflowY: 'auto'
      }
    }, /*#__PURE__*/React.createElement("section", {
      "data-tour": "networth",
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        columnGap: 40,
        rowGap: 16,
        padding: '24px 0 20px',
        borderBottom: rule,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: '1 0 auto'
      }
    }, /*#__PURE__*/React.createElement(DashLabel, {
      style: {
        whiteSpace: 'nowrap'
      }
    }, "Net Worth"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        columnGap: 16
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 48,
        lineHeight: 1.05,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }, money(invested + cash + 21380.4)), /*#__PURE__*/React.createElement(ChangePill, {
      value: 2.14
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: '1 1 320px',
        maxWidth: 420
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
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
      "aria-label": "Invested share of net worth",
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
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        display: 'flex',
        gap: 16,
        fontSize: 12,
        color: 'var(--muted-foreground)'
      },
      className: "tabular-nums"
    }, /*#__PURE__*/React.createElement("span", null, "Invested ", money(invested)), /*#__PURE__*/React.createElement("span", null, "Cash ", money(cash))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      onClick: () => openCash('deposit')
    }, "Deposit"), /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      variant: "outline",
      onClick: () => openCash('withdraw')
    }, "Withdraw"))))), /*#__PURE__*/React.createElement("div", {
      "data-tour": "search",
      style: {
        padding: '16px 0',
        borderBottom: rule,
        flexShrink: 0,
        position: 'relative',
        zIndex: 25
      }
    }, /*#__PURE__*/React.createElement(InstrumentSearch, {
      size: "lg",
      placeholder: "Search a stock to buy or sell",
      shortcut: true,
      action: {
        label: 'Trade'
      },
      suggestions: window.TSData.searchSuggestions(watched),
      instruments: INSTRUMENTS,
      onSelect: i => openOrder(i.symbol)
    })), /*#__PURE__*/React.createElement("section", {
      "data-tour": "portfolio",
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: '2 0 auto',
        minHeight: 240,
        padding: '20px 0 16px',
        borderBottom: rule
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
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
    }, money(pv)), /*#__PURE__*/React.createElement(ChangePill, {
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
    })), /*#__PURE__*/React.createElement("section", {
      "data-tour": "assets",
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: '3 0 auto',
        minHeight: 220,
        paddingTop: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement(LineTabs, {
      value: tab,
      onChange: setTab,
      options: [['assets', 'Assets'], ['watchlist', 'Watch List']]
    }), tab === 'assets' ? /*#__PURE__*/React.createElement(DashLink, {
      onClick: openAllAssets
    }, "View all") : null), tab === 'watchlist' ? /*#__PURE__*/React.createElement(WatchlistTable, {
      openOrder: openOrder
    }) : /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: {
        marginTop: 16,
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...head,
        display: 'grid',
        gridTemplateColumns: COLS,
        gap: 10,
        padding: '0 8px 8px',
        whiteSpace: 'nowrap',
        position: 'sticky',
        top: 0,
        background: 'var(--background)'
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
    }, h))), holdings.map(h => /*#__PURE__*/React.createElement(Row, {
      key: h.i.symbol,
      label: 'Trade ' + h.i.symbol,
      cols: COLS,
      onClick: () => openOrder(h.i.symbol)
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        fontWeight: 500
      }
    }, h.i.symbol), /*#__PURE__*/React.createElement(Sparkline, {
      points: series(h.i.symbol + 'today', 27, h.i.price).map(v => h.i.change < 0 ? 2 * h.i.price - v : v)
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, h.shares), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(h.cost)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(h.i.price)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right',
        ...gl(h.i.change)
      },
      className: "tabular-nums"
    }, (h.i.change >= 0 ? '+' : '') + money(h.i.change)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right',
        ...gl(h.i.changePercent)
      },
      className: "tabular-nums"
    }, pct(h.i.changePercent)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, money(h.value)), /*#__PURE__*/React.createElement("span", {
      style: {
        ...cell,
        textAlign: 'right',
        ...gl(h.gl)
      },
      className: "tabular-nums"
    }, (h.gl >= 0 ? '+' : '') + money(h.gl))))))), /*#__PURE__*/React.createElement("aside", {
      style: {
        display: 'flex',
        minHeight: 0,
        flexDirection: 'column',
        borderLeft: rule,
        paddingLeft: 24,
        paddingTop: 24
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
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: '-0.025em'
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
      const cashT = t.kind === 'cash',
        dep = t.reason === 'DEPOSIT';
      return /*#__PURE__*/React.createElement("li", {
        key: k,
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '12px 0',
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
    }))));
  }
  window.FlatDashboard = FlatDashboard;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui/DashboardFlat.jsx", error: String((e && e.message) || e) }); }

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

  // "Full screen" link in the New Order header (lucideExpand + 12px label).
  function FullScreenLink({
    onClick
  }) {
    const {
      Icon
    } = window.TradingSeasonDesignSystem_86c3eb;
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("a", {
      href: "#",
      role: "link",
      "aria-label": "Open full screen market chart",
      title: "Open full screen market chart",
      onClick: e => {
        e.preventDefault();
        onClick();
      },
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        display: 'flex',
        flexShrink: 0,
        height: 32,
        alignItems: 'center',
        gap: 8,
        padding: '0 8px',
        borderRadius: 8,
        textDecoration: 'none',
        transition: 'all 150ms',
        background: h ? 'var(--muted)' : 'transparent',
        color: h ? 'var(--primary)' : 'var(--muted-foreground)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "expand",
      size: 16
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 500
      }
    }, "Full screen"));
  }
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
        justifyContent: 'space-between',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(InstrumentBadge, {
      symbol: i.symbol
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 18,
        lineHeight: 1.25,
        fontWeight: 600
      }
    }, i.symbol, /*#__PURE__*/React.createElement(WatchlistStar, {
      symbol: i.symbol
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 12,
        color: 'var(--muted-foreground)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, i.name))), onExpand ? /*#__PURE__*/React.createElement(FullScreenLink, {
      onClick: () => onExpand(i.symbol)
    }) : null), /*#__PURE__*/React.createElement("div", {
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
  function LandingGraph({
    height = '45vh',
    bleed = 32
  }) {
    const d = 'M0 330 C90 322 150 300 220 306 S340 262 420 272 S540 236 610 250 S720 196 800 206 S930 150 1000 164 S1110 110 1180 98';
    const ghost = 'M0 350 C120 344 200 330 300 318 S460 300 560 286 S760 262 880 240 S1060 214 1180 190 S1350 170 1440 160';
    return /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        position: 'relative',
        marginTop: 'auto',
        height,
        minHeight: 240,
        marginLeft: -bleed,
        marginRight: -bleed
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
  Object.assign(window, {
    Landing,
    LandingGraph
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui/Landing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client-ui/Tour.jsx
try { (() => {
(() => {
  const {
    Button,
    Icon
  } = window.TradingSeasonDesignSystem_86c3eb;

  // Short first-run tour of the dashboard. Each step spotlights one element; target = CSS selector (null = centered).
  const STEPS = [{
    target: null,
    title: 'Welcome to TradingSeason',
    body: 'Trade stocks in a simulated market with fake money and real-looking prices. This tour takes about 30 seconds.'
  }, {
    target: '[data-tour="search"]',
    title: 'Every trade starts with a search',
    body: 'Type a company or ticker, or press ⌘K from anywhere. Pick a result to open its order ticket.',
    place: 'bottom'
  }, {
    target: '[data-tour="networth"]',
    title: 'Your money',
    body: 'Net worth is your cash plus everything you own. Deposit or withdraw cash here at any time.',
    place: 'right'
  }, {
    target: '[aria-label="Select account"]',
    title: 'Accounts',
    body: 'Split your cash across accounts, like Growth and Retirement. Holdings and charts follow the account you pick.',
    place: 'bottom'
  }, {
    target: '[data-tour="portfolio"]',
    title: 'Track performance',
    body: 'See how the selected account has moved over the day, week, month or year.',
    place: 'left'
  }, {
    target: '[data-tour="assets"]',
    title: 'Holdings and watch list',
    body: 'Click any row to trade it. Star a stock in its order ticket to keep it on your watch list.',
    place: 'top'
  }, {
    target: '[data-tour="search"]',
    title: "You're ready",
    body: 'Search for a stock and place your first trade.',
    place: 'bottom',
    final: true
  }];
  const PAD = 6,
    GAP = 14,
    W = 320;
  function placePopover(r, place, h) {
    const vw = window.innerWidth,
      vh = window.innerHeight;
    if (!r) return {
      left: (vw - W) / 2,
      top: Math.max(16, (vh - h) / 2)
    };
    const fits = {
      bottom: r.bottom + GAP + h < vh,
      top: r.top - GAP - h > 0,
      right: r.right + GAP + W < vw,
      left: r.left - GAP - W > 0
    };
    const p = fits[place] ? place : ['bottom', 'top', 'right', 'left'].find(k => fits[k]) || 'bottom';
    let left, top;
    if (p === 'bottom' || p === 'top') {
      left = r.left + r.width / 2 - W / 2;
      top = p === 'bottom' ? r.bottom + GAP : r.top - GAP - h;
    } else {
      top = r.top + r.height / 2 - h / 2;
      left = p === 'right' ? r.right + GAP : r.left - GAP - W;
    }
    return {
      left: Math.max(16, Math.min(vw - W - 16, left)),
      top: Math.max(16, Math.min(vh - h - 16, top))
    };
  }
  function Tour({
    open,
    onClose
  }) {
    const [step, setStep] = React.useState(() => Math.min(STEPS.length - 1, +(localStorage.getItem('ts-tour-step') || 0)));
    const [rect, setRect] = React.useState(null);
    const [h, setH] = React.useState(190);
    const card = React.useRef(null);
    const s = STEPS[step];
    React.useEffect(() => {
      if (open) localStorage.setItem('ts-tour-step', step);
    }, [step, open]);
    React.useLayoutEffect(() => {
      if (!open) return;
      const measure = () => {
        const el = s.target && document.querySelector(s.target);
        const b = el && el.getBoundingClientRect();
        setRect(b ? {
          left: b.left - PAD,
          top: b.top - PAD,
          width: b.width + PAD * 2,
          height: b.height + PAD * 2,
          right: b.right + PAD,
          bottom: b.bottom + PAD
        } : null);
        if (card.current) setH(card.current.offsetHeight);
      };
      measure();
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }, [open, step]);
    const finish = focusSearch => {
      localStorage.setItem('ts-tour-done', '1');
      localStorage.removeItem('ts-tour-step');
      setStep(0);
      onClose();
      if (focusSearch) setTimeout(() => {
        const i = document.querySelector('[data-tour="search"] input');
        i && i.focus();
      }, 50);
    };
    const next = () => s.final ? finish(true) : setStep(step + 1);
    const back = () => setStep(Math.max(0, step - 1));
    React.useEffect(() => {
      if (!open) return;
      const k = e => {
        if (e.key === 'Escape') finish(false);else if (e.key === 'ArrowRight') next();else if (e.key === 'ArrowLeft') back();
      };
      document.addEventListener('keydown', k);
      return () => document.removeEventListener('keydown', k);
    });
    if (!open) return null;
    const pos = placePopover(rect, s.place, h);
    const ease = 'cubic-bezier(0.16,1,0.3,1)';
    return /*#__PURE__*/React.createElement("div", {
      role: "presentation",
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 80
      }
    }, rect ? /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        borderRadius: 16,
        boxShadow: '0 0 0 2px var(--primary), 0 0 0 9999px rgba(0,0,0,.62)',
        transition: 'all 260ms ' + ease,
        pointerEvents: 'none'
      }
    }) : /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.62)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'ts-fade-in 150ms ease-out both'
      }
    }), /*#__PURE__*/React.createElement("section", {
      ref: card,
      key: step,
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "tour-title",
      "aria-describedby": "tour-body",
      style: {
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        width: W,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-dialog)',
        padding: 20,
        animation: 'ts-pop-in 200ms ' + ease + ' both'
      }
    }, !rect ? /*#__PURE__*/React.createElement("img", {
      src: "../../assets/2b-waves.svg",
      alt: "",
      style: {
        width: 40,
        height: 40,
        marginBottom: 12
      }
    }) : null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase'
      },
      className: "tabular-nums"
    }, step === 0 ? 'Quick tour' : step + ' of ' + (STEPS.length - 1)), /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": "Close tour",
      onClick: () => finish(false),
      style: {
        display: 'flex',
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        margin: '-6px -8px 0 0',
        border: 0,
        borderRadius: 8,
        background: 'transparent',
        color: 'var(--muted-foreground)',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 16
    }))), /*#__PURE__*/React.createElement("h2", {
      id: "tour-title",
      style: {
        margin: '6px 0 0',
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      }
    }, s.title), /*#__PURE__*/React.createElement("p", {
      id: "tour-body",
      style: {
        margin: '6px 0 0',
        fontSize: 14,
        lineHeight: 1.5,
        color: 'var(--muted-foreground)',
        textWrap: 'pretty'
      }
    }, s.body), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        display: 'flex',
        gap: 4
      }
    }, STEPS.slice(1).map((_, k) => /*#__PURE__*/React.createElement("span", {
      key: k,
      style: {
        width: k + 1 === step ? 16 : 6,
        height: 6,
        borderRadius: 9999,
        background: k + 1 <= step ? 'var(--primary)' : 'rgba(238,250,255,.15)',
        transition: 'all 200ms'
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, step === 0 ? /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => finish(false)
    }, "Skip") : /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: back
    }, "Back"), /*#__PURE__*/React.createElement(Button, {
      radius: 5,
      iconEnd: s.final ? 'search' : step === 0 ? undefined : 'arrow-right',
      onClick: next
    }, step === 0 ? 'Start tour' : s.final ? 'Find a stock' : 'Next')))));
  }
  window.Tour = Tour;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client-ui/Tour.jsx", error: String((e && e.message) || e) }); }

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

// ui_kits/instrument-view/MarketChart.jsx
try { (() => {
(() => {
  const {
    Icon
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    money
  } = window.TSData;
  const IND_COLORS = {
    sma: '#f6c453',
    ema: '#b784ff',
    bollinger: '#ff8f66',
    rsi: '#42d3ff'
  };
  const MIN_BARS = 12,
    W = 1000,
    H = 100;
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sma = (c, p) => c.map((_, i) => i < p - 1 ? null : avg(c.slice(i - p + 1, i + 1)));
  const ema = (c, p) => {
    const k = 2 / (p + 1);
    let e = null;
    return c.map((v, i) => {
      e = e == null ? v : v * k + e * (1 - k);
      return i < p - 1 ? null : e;
    });
  };
  const boll = (c, p) => {
    const m = sma(c, p);
    return c.map((_, i) => {
      if (m[i] == null) return null;
      const sd = Math.sqrt(avg(c.slice(i - p + 1, i + 1).map(v => (v - m[i]) ** 2)));
      return [m[i] + 2 * sd, m[i] - 2 * sd];
    });
  };
  const rsi = (c, p) => {
    let g = 0,
      l = 0;
    return c.map((v, i) => {
      if (!i) return null;
      const d = v - c[i - 1],
        up = Math.max(d, 0),
        dn = Math.max(-d, 0);
      if (i < p) {
        g += up;
        l += dn;
        return null;
      }
      if (i === p) {
        g = (g + up) / p;
        l = (l + dn) / p;
      } else {
        g = (g * (p - 1) + up) / p;
        l = (l * (p - 1) + dn) / p;
      }
      return 100 - 100 / (1 + g / (l || 1e-9));
    });
  };
  function CtrlBtn({
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
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        background: h && !disabled ? 'rgba(0,187,255,.1)' : 'transparent',
        color: h && !disabled ? 'var(--foreground)' : 'rgba(238,250,255,.7)',
        transition: 'all 150ms'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 14
    }));
  }

  // Interactive market chart (app-price-chart interactive): modes, indicators, current-price label, wheel/drag pan-zoom.
  function MarketChart({
    data,
    mode = 'candles',
    indicators = [],
    labelFor,
    initialCount
  }) {
    const N = data.length;
    const init = () => {
      const c = Math.min(N, initialCount || N);
      return {
        start: N - c,
        count: c
      };
    };
    const [view, setView] = React.useState(init);
    const [hi, setHi] = React.useState(null);
    const [drag, setDrag] = React.useState(null);
    const ref = React.useRef(null);
    const clamp = (s, c) => {
      c = Math.round(Math.max(MIN_BARS, Math.min(N, c)));
      return {
        start: Math.max(0, Math.min(N - c, Math.round(s))),
        count: c
      };
    };
    const zoom = (f, anchor = 1) => setView(v => {
      const c = Math.max(MIN_BARS, Math.min(N, v.count * f));
      return clamp(v.start + (v.count - c) * anchor, c);
    });
    React.useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const wheel = e => {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        zoom(e.deltaY > 0 ? 1.12 : 0.89, (e.clientX - r.left) / r.width);
      };
      el.addEventListener('wheel', wheel, {
        passive: false
      });
      return () => el.removeEventListener('wheel', wheel);
    });
    const closes = data.map(d => d.close);
    const vis = data.slice(view.start, view.start + view.count);
    const n = vis.length,
      step = W / n,
      bw = Math.max(1, step * 0.62);
    const base = vis[0].open;
    const pctMode = mode === 'percent',
      volMode = mode === 'volume';
    const tx = v => pctMode ? (v / base - 1) * 100 : v;
    const ov = {};
    if (indicators.includes('sma')) ov.sma = sma(closes, 20);
    if (indicators.includes('ema')) ov.ema = ema(closes, 20);
    if (indicators.includes('bollinger')) ov.bollinger = boll(closes, 20);
    const showRsi = indicators.includes('rsi');
    const rsiVals = showRsi ? rsi(closes, 14) : null;
    const slice = a => a.slice(view.start, view.start + view.count);
    let lo, hiV;
    if (volMode) {
      lo = 0;
      hiV = Math.max(...vis.map(d => d.volume)) * 1.08;
    } else {
      const vals = vis.flatMap(d => [tx(d.low), tx(d.high)]);
      Object.entries(ov).forEach(([k, a]) => slice(a).forEach(v => {
        if (v == null) return;
        (k === 'bollinger' ? v : [v]).forEach(x => vals.push(tx(x)));
      }));
      lo = Math.min(...vals);
      hiV = Math.max(...vals);
      const pad = (hiV - lo) * 0.06 || 1;
      lo -= pad;
      hiV += pad;
    }
    const y = v => (hiV - v) / (hiV - lo) * H;
    const cx = i => i * step + step / 2;
    const path = (arr, f = v => v) => {
      let d = '',
        pen = false;
      arr.forEach((v, i) => {
        if (v == null) {
          pen = false;
          return;
        }
        d += (pen ? 'L' : 'M') + cx(i).toFixed(1) + ',' + y(tx(f(v))).toFixed(2);
        pen = true;
      });
      return d;
    };
    const last = data[N - 1];
    const up = last.close >= data[0].open;
    const col = up ? 'var(--color-gain)' : 'var(--color-loss)';
    const ticks = [0, 1, 2, 3, 4].map(k => lo + (hiV - lo) * (k + 0.5) / 5);
    const fmtAxis = v => volMode ? v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : (v / 1e3).toFixed(0) + 'K' : pctMode ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%' : money(v);
    const lastVisible = view.start + view.count >= N;
    const curV = volMode ? null : tx(last.close);
    const idxAt = e => {
      const r = ref.current.getBoundingClientRect();
      return Math.min(n - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * n)));
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
      setHi(idxAt(e));
    };
    const up_ = () => setDrag(null);
    const o = vis[hi != null ? hi : n - 1];
    const gi = view.start + (hi != null ? hi : n - 1);
    const lineArr = vis.map(d => d.close);
    const areaId = React.useMemo(() => 'mc' + Math.random().toString(36).slice(2), []);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 4.75rem',
        gridTemplateRows: showRsi ? 'minmax(0,1fr) 88px 1rem' : 'minmax(0,1fr) 1rem',
        columnGap: 12,
        rowGap: 8,
        height: '100%',
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      ref: ref,
      onPointerDown: down,
      onPointerMove: move,
      onPointerUp: up_,
      onPointerCancel: up_,
      onPointerLeave: () => {
        if (!drag) setHi(null);
      },
      onDoubleClick: () => setView(init()),
      role: "img",
      "aria-label": "Price chart. Scroll to zoom, drag to pan, double-click to reset.",
      style: {
        position: 'relative',
        minHeight: 0,
        cursor: drag ? 'grabbing' : 'crosshair',
        touchAction: 'none',
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
        overflow: 'visible'
      },
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: areaId,
      x1: "0",
      x2: "0",
      y1: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: up ? '#25eb69' : '#ff3d5a',
      stopOpacity: "0.28"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: up ? '#25eb69' : '#ff3d5a',
      stopOpacity: "0"
    }))), ticks.map(t => /*#__PURE__*/React.createElement("line", {
      key: t,
      x1: "0",
      x2: W,
      y1: y(t),
      y2: y(t),
      stroke: "rgba(238,250,255,.09)",
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
    }), pctMode ? /*#__PURE__*/React.createElement("line", {
      x1: "0",
      x2: W,
      y1: y(0),
      y2: y(0),
      stroke: "rgba(238,250,255,.25)",
      strokeDasharray: "3 4",
      strokeWidth: "1",
      vectorEffect: "non-scaling-stroke"
    }) : null, volMode ? vis.map((d, i) => /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: i * step + (step - bw) / 2,
      y: y(d.volume),
      width: bw,
      height: H - y(d.volume),
      fill: d.close >= d.open ? 'rgba(37,235,105,.55)' : 'rgba(255,61,90,.55)'
    })) : null, mode === 'candles' ? vis.map((d, i) => {
      const c = d.close >= d.open ? '#25eb69' : '#ff3d5a';
      const t = y(tx(Math.max(d.open, d.close))),
        b = y(tx(Math.min(d.open, d.close)));
      return /*#__PURE__*/React.createElement("g", {
        key: i
      }, /*#__PURE__*/React.createElement("line", {
        x1: cx(i),
        x2: cx(i),
        y1: y(tx(d.high)),
        y2: y(tx(d.low)),
        stroke: c,
        strokeWidth: "1",
        vectorEffect: "non-scaling-stroke"
      }), /*#__PURE__*/React.createElement("rect", {
        x: cx(i) - bw / 2,
        y: t,
        width: bw,
        height: Math.max(0.3, b - t),
        fill: c
      }));
    }) : null, mode === 'ohlc' ? vis.map((d, i) => {
      const c = d.close >= d.open ? '#25eb69' : '#ff3d5a';
      return /*#__PURE__*/React.createElement("g", {
        key: i,
        stroke: c,
        strokeWidth: "1.2",
        vectorEffect: "non-scaling-stroke"
      }, /*#__PURE__*/React.createElement("line", {
        x1: cx(i),
        x2: cx(i),
        y1: y(d.high),
        y2: y(d.low),
        vectorEffect: "non-scaling-stroke"
      }), /*#__PURE__*/React.createElement("line", {
        x1: cx(i) - bw / 2,
        x2: cx(i),
        y1: y(d.open),
        y2: y(d.open),
        vectorEffect: "non-scaling-stroke"
      }), /*#__PURE__*/React.createElement("line", {
        x1: cx(i),
        x2: cx(i) + bw / 2,
        y1: y(d.close),
        y2: y(d.close),
        vectorEffect: "non-scaling-stroke"
      }));
    }) : null, mode === 'area' ? /*#__PURE__*/React.createElement("path", {
      d: path(lineArr) + ' L' + cx(n - 1) + ',' + H + ' L' + cx(0) + ',' + H + ' Z',
      fill: 'url(#' + areaId + ')'
    }) : null, mode === 'line' || mode === 'area' || pctMode ? /*#__PURE__*/React.createElement("path", {
      d: path(lineArr),
      fill: "none",
      stroke: col,
      strokeWidth: "2",
      strokeLinejoin: "round",
      vectorEffect: "non-scaling-stroke"
    }) : null, !volMode && ov.bollinger ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: path(slice(ov.bollinger), v => v[0]),
      fill: "none",
      stroke: IND_COLORS.bollinger,
      strokeWidth: "1.2",
      strokeOpacity: "0.85",
      vectorEffect: "non-scaling-stroke"
    }), /*#__PURE__*/React.createElement("path", {
      d: path(slice(ov.bollinger), v => v[1]),
      fill: "none",
      stroke: IND_COLORS.bollinger,
      strokeWidth: "1.2",
      strokeOpacity: "0.85",
      vectorEffect: "non-scaling-stroke"
    })) : null, !volMode && ov.sma ? /*#__PURE__*/React.createElement("path", {
      d: path(slice(ov.sma)),
      fill: "none",
      stroke: IND_COLORS.sma,
      strokeWidth: "1.4",
      vectorEffect: "non-scaling-stroke"
    }) : null, !volMode && ov.ema ? /*#__PURE__*/React.createElement("path", {
      d: path(slice(ov.ema)),
      fill: "none",
      stroke: IND_COLORS.ema,
      strokeWidth: "1.4",
      vectorEffect: "non-scaling-stroke"
    }) : null, curV != null && lastVisible ? /*#__PURE__*/React.createElement("line", {
      x1: "0",
      x2: W,
      y1: y(curV),
      y2: y(curV),
      stroke: up ? '#25eb69' : '#ff3d5a',
      strokeOpacity: "0.55",
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
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 150,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        fontSize: 11,
        fontWeight: 600,
        color: 'rgba(238,250,255,.46)',
        pointerEvents: 'none'
      },
      className: "tabular-nums"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--foreground)'
      }
    }, labelFor(gi, true)), [['O', o.open], ['H', o.high], ['L', o.low], ['C', o.close]].map(([k, v]) => /*#__PURE__*/React.createElement("span", {
      key: k
    }, k, " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: o.close >= o.open ? 'var(--color-gain)' : 'var(--color-loss)'
      }
    }, v.toFixed(2)))), /*#__PURE__*/React.createElement("span", null, "Vol ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--foreground)'
      }
    }, o.volume.toLocaleString('en-US'))), indicators.filter(k => k !== 'rsi').map(k => /*#__PURE__*/React.createElement("span", {
      key: k,
      style: {
        color: IND_COLORS[k]
      }
    }, k === 'bollinger' ? 'BB 20 · 2σ' : k.toUpperCase() + ' 20'))), /*#__PURE__*/React.createElement("div", {
      onPointerDown: e => e.stopPropagation(),
      className: "chart-controls",
      style: {
        position: 'absolute',
        top: -2,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        borderRadius: 8,
        border: '1px solid rgba(238,250,255,.15)',
        background: 'rgba(24,24,24,.9)'
      }
    }, /*#__PURE__*/React.createElement(CtrlBtn, {
      icon: "zoom-out",
      label: "Zoom out",
      disabled: view.count >= N,
      onClick: () => zoom(1.25)
    }), /*#__PURE__*/React.createElement(CtrlBtn, {
      icon: "zoom-in",
      label: "Zoom in",
      disabled: view.count <= MIN_BARS,
      onClick: () => zoom(0.8)
    }), /*#__PURE__*/React.createElement(CtrlBtn, {
      icon: "chevron-left",
      label: "Pan left",
      disabled: view.start === 0,
      onClick: () => setView(v => clamp(v.start - v.count * 0.25, v.count))
    }), /*#__PURE__*/React.createElement(CtrlBtn, {
      icon: "chevron-right",
      label: "Pan right",
      disabled: lastVisible,
      onClick: () => setView(v => clamp(v.start + v.count * 0.25, v.count))
    }), /*#__PURE__*/React.createElement(CtrlBtn, {
      icon: "rotate-ccw",
      label: "Reset view",
      onClick: () => setView(init())
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        borderLeft: '1px solid rgba(238,250,255,.105)',
        fontSize: 11,
        color: 'var(--muted-foreground)',
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, ticks.map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      style: {
        position: 'absolute',
        right: 0,
        top: y(t) / H * 100 + '%',
        transform: 'translateY(-50%)',
        whiteSpace: 'nowrap'
      }
    }, fmtAxis(t))), curV != null && lastVisible ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        right: 0,
        top: Math.min(98, Math.max(2, y(curV) / H * 100)) + '%',
        transform: 'translateY(-50%)',
        padding: '1px 5px',
        borderRadius: 4,
        fontWeight: 600,
        color: '#0e0e0e',
        background: col,
        whiteSpace: 'nowrap'
      }
    }, pctMode ? fmtAxis(curV) : last.close.toFixed(2)) : null), showRsi ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        borderTop: '1px solid var(--border)'
      }
    }, /*#__PURE__*/React.createElement("svg", {
      viewBox: '0 0 ' + W + ' 100',
      preserveAspectRatio: "none",
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%'
      },
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "0",
      y: "30",
      width: W,
      height: "40",
      fill: "rgba(66,211,255,.06)"
    }), [30, 70].map(v => /*#__PURE__*/React.createElement("line", {
      key: v,
      x1: "0",
      x2: W,
      y1: v,
      y2: v,
      stroke: "rgba(238,250,255,.12)",
      strokeDasharray: "3 4",
      strokeWidth: "1",
      vectorEffect: "non-scaling-stroke"
    })), /*#__PURE__*/React.createElement("path", {
      d: slice(rsiVals).map((v, i) => v == null ? '' : (i && slice(rsiVals)[i - 1] != null ? 'L' : 'M') + cx(i).toFixed(1) + ',' + (100 - v).toFixed(2)).join(' '),
      fill: "none",
      stroke: IND_COLORS.rsi,
      strokeWidth: "1.4",
      vectorEffect: "non-scaling-stroke"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 4,
        left: 0,
        fontSize: 11,
        fontWeight: 600,
        color: IND_COLORS.rsi
      }
    }, "RSI 14 ", (rsiVals[gi] || 0).toFixed(1))), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        borderLeft: '1px solid rgba(238,250,255,.105)',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--muted-foreground)',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        right: 0,
        top: '30%',
        transform: 'translateY(-50%)'
      }
    }, "70"), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        right: 0,
        top: '70%',
        transform: 'translateY(-50%)'
      }
    }, "30"))) : null, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        height: 16,
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, [0, 1, 2, 3, 4].map(k => {
      const x = k / 4;
      const idx = Math.min(n - 1, Math.round(x * (n - 1)));
      return /*#__PURE__*/React.createElement("span", {
        key: k,
        style: {
          position: 'absolute',
          left: x * 100 + '%',
          transform: k === 0 ? 'none' : k === 4 ? 'translateX(-100%)' : 'translateX(-50%)',
          whiteSpace: 'nowrap'
        }
      }, labelFor(view.start + idx));
    })), /*#__PURE__*/React.createElement("div", null));
  }
  window.MarketChart = MarketChart;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instrument-view/MarketChart.jsx", error: String((e && e.message) || e) }); }

// ui_kits/instrument-view/MarketPage.jsx
try { (() => {
(() => {
  const {
    Icon,
    HeaderDropdown,
    MenuItem,
    InstrumentSearch,
    TimeframeToggle,
    Button
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    INSTRUMENTS,
    POSITIONS,
    candles,
    money,
    find
  } = window.TSData;
  const CHART_MODES = [['line', 'Line', 'chart-line'], ['area', 'Area', 'chart-area'], ['candles', 'Candles', 'chart-candlestick'], ['ohlc', 'OHLC', 'chart-bar'], ['volume', 'Volume', 'chart-no-axes-column'], ['percent', 'Percent', 'percent']];
  const INDICATORS = [['sma', 'SMA 20'], ['ema', 'EMA 20'], ['bollinger', 'Bollinger Bands 20 · 2σ'], ['rsi', 'RSI 14']];
  const MKT_CAP = {
    AAPL: '$3.42T',
    MSFT: '$3.81T',
    NVDA: '$4.49T',
    AMZN: '$2.46T',
    GOOGL: '$2.52T',
    TSLA: '$1.12T',
    META: '$1.87T',
    SPCX: '$41.2B',
    JPM: '$802B',
    SPY: '$612B'
  };

  // Bars per timeframe and their timestamps (America/Chicago session, ending Mon Sep 14 2026).
  const SPEC = {
    '1D': {
      n: 78,
      per: 78,
      mins: 5
    },
    '5D': {
      n: 130,
      per: 26,
      mins: 15
    },
    '1M': {
      n: 132,
      per: 6,
      mins: 65
    },
    '1Y': {
      n: 252,
      per: 1,
      mins: 0
    }
  };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = (() => {
    const out = [];
    let d = new Date(2026, 8, 14);
    while (out.length < 252) {
      if (d.getDay() % 6) out.unshift(new Date(d));
      d = new Date(d.getTime() - 864e5);
    }
    return out;
  })();
  const clock = m => {
    const h = Math.floor(m / 60),
      mm = m % 60;
    return (h + 11) % 12 + 1 + ':' + String(mm).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
  };
  function labeler(tf) {
    const s = SPEC[tf],
      nDays = Math.ceil(s.n / s.per);
    return (i, full) => {
      const day = days[days.length - nDays + Math.floor(i / s.per)];
      const t = clock(510 + i % s.per * s.mins);
      if (tf === '1D') return full ? MON[day.getMonth()] + ' ' + day.getDate() + ' · ' + t : t;
      if (tf === '5D') return DOW[day.getDay()] + ' ' + day.getDate() + (full ? ' · ' + t : '');
      if (tf === '1M') return MON[day.getMonth()] + ' ' + day.getDate() + (full ? ' · ' + t : '');
      return full ? MON[day.getMonth()] + ' ' + day.getDate() + ', ' + day.getFullYear() : MON[day.getMonth()] + " '" + String(day.getFullYear()).slice(2);
    };
  }
  const seriesFor = (sym, tf, price) => candles(sym + tf, SPEC[tf].n, price);
  const FLAT = {
    border: 0,
    borderBottom: '1px solid var(--border)',
    borderRadius: 0,
    background: 'transparent'
  };
  function useWide() {
    const [w, setW] = React.useState(() => window.innerWidth >= 1280);
    React.useEffect(() => {
      const f = () => setW(window.innerWidth >= 1280);
      window.addEventListener('resize', f);
      return () => window.removeEventListener('resize', f);
    }, []);
    return w;
  }
  function NavBack({
    onClick
  }) {
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("a", {
      href: "#",
      "aria-label": "Back to dashboard",
      onClick: e => {
        e.preventDefault();
        onClick();
      },
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        display: 'flex',
        width: 40,
        height: 40,
        flex: '0 0 auto',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid ' + (h ? 'rgba(0,187,255,.35)' : 'rgba(238,250,255,.15)'),
        borderRadius: 8,
        color: h ? '#00bbff' : 'rgba(238,250,255,.62)',
        transition: '150ms ease',
        textDecoration: 'none'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-left",
      size: 24
    }));
  }
  function MarketClock() {
    const clockLabel = 'Sep 14, 2026 · 3:45 PM CT';
    return /*#__PURE__*/React.createElement(HeaderDropdown, {
      icon: "calendar-clock",
      label: clockLabel,
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
    }, clockLabel), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, "Range: Jan 2 \u2013 Sep 14, 2026"), /*#__PURE__*/React.createElement("input", {
      type: "datetime-local",
      defaultValue: "2026-09-14T15:45",
      "aria-label": "Simulated time",
      style: {
        marginTop: 12,
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
    }, "Apply time")));
  }
  function MarketNav({
    onBack,
    onPick,
    layout,
    onLayout
  }) {
    return /*#__PURE__*/React.createElement("header", {
      style: {
        position: 'relative',
        zIndex: 100,
        height: 72,
        padding: '0 24px',
        background: 'rgba(14,14,14,.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '0 auto',
        display: 'flex',
        height: '100%',
        maxWidth: 1600,
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(NavBack, {
      onClick: onBack
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginRight: 'auto',
        minWidth: 192,
        maxWidth: 672,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(InstrumentSearch, {
      instruments: INSTRUMENTS,
      onSelect: i => onPick(i.symbol)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(MarketClock, null), /*#__PURE__*/React.createElement(HeaderDropdown, {
      trigger: /*#__PURE__*/React.createElement(Icon, {
        name: "bell",
        size: 18
      }),
      ariaLabel: "Open notifications",
      triggerStyle: {
        background: 'transparent',
        color: 'var(--muted-foreground)'
      },
      panelWidth: 256,
      panelStyle: {
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      "aria-label": "Notifications"
    }, /*#__PURE__*/React.createElement("strong", {
      style: {
        fontSize: 14
      }
    }, "Notifications"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '8px 0 0',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, "No notifications yet."))), /*#__PURE__*/React.createElement(HeaderDropdown, {
      trigger: "SC",
      ariaLabel: "Open profile menu"
    }, close => /*#__PURE__*/React.createElement("div", {
      role: "menu",
      "aria-label": "Profile"
    }, /*#__PURE__*/React.createElement(MenuItem, {
      icon: layout === 'flat' ? 'layout-grid' : 'rows-3',
      onClick: () => {
        close();
        onLayout(layout === 'flat' ? 'cards' : 'flat');
      }
    }, layout === 'flat' ? 'Card layout' : 'Flat layout'), /*#__PURE__*/React.createElement(MenuItem, {
      icon: "settings",
      onClick: close
    }, "Settings"), /*#__PURE__*/React.createElement(MenuItem, {
      icon: "log-out",
      tone: "danger",
      onClick: () => {
        close();
        location.href = '../client-ui/index.html';
      }
    }, "Log out"))))));
  }
  function Summary({
    i,
    stats,
    rangeVolume,
    collapsed,
    onOpenTools,
    wide,
    flat
  }) {
    const metric = (k, v) => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        minWidth: 0,
        textAlign: wide ? 'right' : 'left'
      }
    }, /*#__PURE__*/React.createElement("dt", {
      style: {
        color: 'rgba(238,250,255,.46)',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap'
      }
    }, k), /*#__PURE__*/React.createElement("dd", {
      style: {
        margin: '1px 0 0',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, v));
    return /*#__PURE__*/React.createElement("section", {
      style: {
        display: 'flex',
        flex: wide ? '0 0 4rem' : '0 0 auto',
        minHeight: 64,
        flexDirection: wide ? 'row' : 'column',
        alignItems: wide ? 'center' : 'flex-start',
        justifyContent: 'space-between',
        gap: wide ? 16 : 12,
        padding: wide ? '4px 16px' : '12px 16px',
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
        ...(flat ? {
          ...FLAT,
          paddingLeft: 0,
          paddingRight: 0
        } : null)
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexShrink: 0,
        minWidth: 0,
        width: wide ? undefined : '100%',
        alignItems: 'center',
        justifyContent: wide ? 'flex-start' : 'space-between',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
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
        fontWeight: 700
      }
    }, i.symbol), /*#__PURE__*/React.createElement(WatchlistStar, {
      symbol: i.symbol
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 12,
        color: 'var(--muted-foreground)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, i.name)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 30,
        fontWeight: 700
      },
      className: "tabular-nums"
    }, money(i.price))), /*#__PURE__*/React.createElement("dl", {
      style: {
        margin: 0,
        display: 'grid',
        flex: 1,
        minWidth: 0,
        width: wide ? undefined : '100%',
        gap: 12,
        ...(wide ? {
          gridTemplateColumns: 'repeat(5, minmax(3.5rem, 1fr)) minmax(8rem, 1.6fr) minmax(6rem, 1.2fr)' + (collapsed ? ' minmax(2rem, .5fr)' : ''),
          borderLeft: '1px solid var(--border)',
          paddingLeft: 16
        } : {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          borderTop: '1px solid var(--border)',
          paddingTop: 12
        })
      }
    }, metric('Mkt Cap', MKT_CAP[i.symbol] || '—'), metric('Bid', money(stats.bid)), metric('Ask', money(stats.ask)), metric('Spread', money(stats.spread)), metric('Open', money(stats.open)), metric('Day Range', money(stats.low) + '–' + money(stats.high)), metric('Range Volume', rangeVolume.toLocaleString('en-US')), collapsed ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement(ToolButton, {
      square: true,
      icon: "chevron-left",
      label: "Open market tools",
      onClick: onOpenTools,
      style: {
        borderColor: 'rgba(238,250,255,.2)',
        color: 'rgba(238,250,255,.8)'
      }
    })) : null));
  }
  function Toolbar({
    i,
    mode,
    setMode,
    indicators,
    toggleInd,
    compare,
    setCompare,
    tf,
    setTf
  }) {
    const [menu, setMenu] = React.useState(null);
    const sel = CHART_MODES.find(m => m[0] === mode);
    const others = INSTRUMENTS.filter(x => x.symbol !== i.symbol);
    const opener = k => v => setMenu(v ? k : null);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        borderBottom: '1px solid var(--border)',
        padding: '4px 0 12px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Popover, {
      open: menu === 'ind',
      setOpen: opener('ind'),
      trigger: /*#__PURE__*/React.createElement(ToolButton, {
        icon: "sliders-horizontal",
        active: menu === 'ind' || indicators.length > 0,
        onClick: () => setMenu(menu === 'ind' ? null : 'ind')
      }, "Indicators", indicators.length ? /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'inline-flex',
          width: 16,
          height: 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 9999,
          fontSize: 9,
          color: 'var(--primary)',
          background: 'var(--primary-15)'
        }
      }, indicators.length) : null)
    }, /*#__PURE__*/React.createElement("div", {
      role: "menu",
      "aria-label": "Technical indicators",
      style: {
        ...pickerStyle,
        width: '11rem',
        gap: 2,
        padding: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        padding: 8,
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--muted-foreground)'
      }
    }, "Technical indicators"), INDICATORS.map(([k, label]) => {
      const on = indicators.includes(k);
      return /*#__PURE__*/React.createElement(PickerItem, {
        key: k,
        role: "menuitemcheckbox",
        checked: on,
        onClick: () => toggleInd(k)
      }, /*#__PURE__*/React.createElement("span", {
        "aria-hidden": "true",
        style: {
          width: 12,
          height: 12,
          flex: '0 0 auto',
          border: '1px solid ' + (on ? '#00bbff' : 'rgba(238,250,255,.3)'),
          borderRadius: 3.2,
          background: on ? '#00bbff' : 'transparent',
          boxShadow: on ? 'inset 0 0 0 2px #181818' : 'none'
        }
      }), label);
    }))), /*#__PURE__*/React.createElement(Popover, {
      open: menu === 'mode',
      setOpen: opener('mode'),
      trigger: /*#__PURE__*/React.createElement(ToolButton, {
        icon: sel[2],
        active: menu === 'mode',
        onClick: () => setMenu(menu === 'mode' ? null : 'mode')
      }, "Graph view: ", sel[1])
    }, /*#__PURE__*/React.createElement("div", {
      role: "menu",
      "aria-label": "Chart mode",
      style: {
        ...pickerStyle,
        width: '7.5rem',
        gap: 2,
        padding: 4
      }
    }, CHART_MODES.map(([k, label, icon]) => /*#__PURE__*/React.createElement(PickerItem, {
      key: k,
      role: "menuitemradio",
      checked: mode === k,
      selected: mode === k,
      onClick: () => {
        setMode(k);
        setMenu(null);
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 14
    }), label)))), /*#__PURE__*/React.createElement(Popover, {
      open: menu === 'cmp',
      setOpen: opener('cmp'),
      trigger: /*#__PURE__*/React.createElement(ToolButton, {
        icon: "git-compare",
        active: menu === 'cmp' || !!compare,
        onClick: () => setMenu(menu === 'cmp' ? null : 'cmp')
      }, compare || 'Compare', compare ? /*#__PURE__*/React.createElement("span", {
        role: "button",
        tabIndex: -1,
        "aria-label": "Remove comparison",
        title: "Remove comparison",
        onClick: e => {
          e.stopPropagation();
          setCompare(null);
        },
        style: {
          display: 'flex',
          padding: '0 2px',
          cursor: 'pointer'
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "x",
        size: 14
      })) : null)
    }, /*#__PURE__*/React.createElement("div", {
      role: "dialog",
      "aria-label": "Choose a stock to compare",
      style: {
        ...pickerStyle,
        width: '16rem'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        padding: '12px 12px 8px',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--muted-foreground)'
      }
    }, "Compare ", i.symbol, " with"), /*#__PURE__*/React.createElement(InstrumentSearch, {
      embedded: true,
      autoFocus: true,
      instruments: others,
      onSelect: x => {
        setCompare(x.symbol);
        setMenu(null);
      }
    })))), /*#__PURE__*/React.createElement(TimeframeToggle, {
      value: tf,
      onChange: setTf
    }));
  }
  function PickerItem({
    children,
    onClick,
    role,
    checked,
    selected
  }) {
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      role: role,
      "aria-checked": checked,
      onClick: e => {
        e.stopPropagation();
        onClick();
      },
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        display: 'flex',
        minHeight: 30,
        alignItems: 'center',
        gap: 8,
        borderRadius: 6,
        padding: '0 8px',
        border: 0,
        textAlign: 'left',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        background: selected ? 'var(--primary-15)' : h ? 'var(--primary-10)' : 'transparent',
        color: selected || h ? 'var(--primary)' : 'var(--muted-foreground)'
      }
    }, children);
  }
  function CompareLabel({
    x,
    style
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 20,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        pointerEvents: 'none',
        fontSize: 12,
        fontWeight: 600,
        ...style
      },
      className: "tabular-nums"
    }, /*#__PURE__*/React.createElement("span", null, x.symbol), /*#__PURE__*/React.createElement("span", null, money(x.price)), /*#__PURE__*/React.createElement("span", {
      style: {
        color: x.change >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
      }
    }, x.change.toFixed(1), " (", (x.changePercent >= 0 ? '+' : '') + x.changePercent.toFixed(2), "%)"));
  }
  function MarketPage({
    symbol,
    setSymbol,
    onBack
  }) {
    const i = find(symbol);
    const [tf, setTf] = React.useState('1D');
    const [mode, setMode] = React.useState('candles');
    const [indicators, setInd] = React.useState([]);
    const [compare, setCompare] = React.useState(null);
    const [collapsed, setCollapsed] = React.useState(false);
    const [account, setAccount] = React.useState(1);
    const wide = useWide();
    const [layout, setLayoutState] = React.useState(() => new URLSearchParams(location.search).get('layout') || localStorage.getItem('ts-client-layout') || 'cards');
    const setLayout = l => {
      setLayoutState(l);
      localStorage.setItem('ts-client-layout', l);
    };
    const flat = layout === 'flat';
    const shut = collapsed && wide;
    React.useEffect(() => {
      if (compare === symbol) setCompare(null);
    }, [symbol]);
    const data = React.useMemo(() => seriesFor(symbol, tf, i.price), [symbol, tf]);
    const day = React.useMemo(() => seriesFor(symbol, '1D', i.price), [symbol]);
    const spread = Math.max(0.01, +(i.price * 0.0004).toFixed(2));
    const stats = {
      bid: i.price - spread / 2,
      ask: i.price + spread / 2,
      spread,
      open: day[0].open,
      low: Math.min(...day.map(d => d.low)),
      high: Math.max(...day.map(d => d.high))
    };
    const rangeVolume = data.reduce((a, d) => a + d.volume, 0);
    const labelFor = labeler(tf);
    const cmp = compare ? find(compare) : null;
    const cmpData = React.useMemo(() => cmp ? seriesFor(cmp.symbol, tf, cmp.price) : null, [compare, tf]);
    const toggleInd = k => setInd(a => a.includes(k) ? a.filter(x => x !== k) : a.concat(k));
    const chartKey = symbol + tf;
    const chart = (d, k) => /*#__PURE__*/React.createElement(MarketChart, {
      key: k,
      data: d,
      mode: mode,
      indicators: indicators,
      labelFor: labelFor,
      initialCount: tf === '1Y' ? 126 : SPEC[tf].n
    });
    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
    return /*#__PURE__*/React.createElement("main", {
      style: {
        ...(wide ? {
          height: '100dvh',
          overflow: 'hidden'
        } : {
          minHeight: '100dvh'
        }),
        background: '#0e0e0e',
        color: '#eefaff',
        fontVariantNumeric: 'tabular-nums'
      }
    }, /*#__PURE__*/React.createElement(MarketNav, {
      onBack: onBack,
      onPick: setSymbol,
      layout: layout,
      onLayout: setLayout
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        maxWidth: 1648,
        margin: '0 auto',
        padding: wide ? '10px 24px' : '10px 16px',
        height: wide ? 'calc(100dvh - 72px)' : 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        height: wide ? '100%' : 'auto',
        minHeight: 0,
        gridTemplateColumns: !wide ? '1fr' : collapsed ? 'minmax(0,10fr) minmax(0,0fr)' : 'minmax(0,7fr) minmax(0,3fr)',
        gap: shut ? 0 : flat ? 24 : 12,
        transition: collapsed ? 'grid-template-columns 320ms ease 160ms, gap 320ms ease 160ms' : 'grid-template-columns 320ms ' + ease + ', gap 320ms ' + ease
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        minWidth: 0,
        minHeight: 0,
        flexDirection: 'column',
        gap: flat ? 0 : 12
      }
    }, /*#__PURE__*/React.createElement(Summary, {
      flat: flat,
      wide: wide,
      i: i,
      stats: stats,
      rangeVolume: rangeVolume,
      collapsed: collapsed,
      onOpenTools: () => setCollapsed(false)
    }), /*#__PURE__*/React.createElement("section", {
      style: {
        display: 'flex',
        minHeight: wide ? 0 : '33.5rem',
        minWidth: 0,
        flex: 1,
        flexDirection: 'column',
        gap: 8,
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
        padding: 12,
        ...(flat ? {
          ...FLAT,
          borderBottom: 0,
          padding: '12px 0 0'
        } : null)
      }
    }, /*#__PURE__*/React.createElement(Toolbar, {
      i: i,
      mode: mode,
      setMode: setMode,
      indicators: indicators,
      toggleInd: toggleInd,
      compare: compare,
      setCompare: setCompare,
      tf: tf,
      setTf: setTf
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        minHeight: 0,
        flex: 1,
        borderRadius: 12,
        background: '#0e0e0e',
        padding: flat ? '12px 0 0' : 12
      }
    }, cmp ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        height: '100%',
        minHeight: 0,
        gridTemplateColumns: '1fr 1fr'
      }
    }, /*#__PURE__*/React.createElement("section", {
      "aria-label": i.symbol + ' price chart',
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        paddingRight: 12,
        paddingTop: 28
      }
    }, /*#__PURE__*/React.createElement(CompareLabel, {
      x: i,
      style: {
        top: 0,
        right: 12
      }
    }), chart(data, chartKey)), /*#__PURE__*/React.createElement("section", {
      "aria-label": cmp.symbol + ' price chart',
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        paddingLeft: 12,
        paddingTop: 28,
        borderLeft: '1px solid rgba(238,250,255,.1)'
      }
    }, /*#__PURE__*/React.createElement(CompareLabel, {
      x: cmp,
      style: {
        top: 0,
        right: 0
      }
    }), chart(cmpData, cmp.symbol + tf))) : chart(data, chartKey)))), /*#__PURE__*/React.createElement("aside", {
      "aria-hidden": shut,
      style: {
        display: !wide && collapsed ? 'none' : 'flex',
        minWidth: 0,
        minHeight: 0,
        flexDirection: 'column',
        gap: flat ? 0 : 12,
        ...(flat && wide ? {
          borderLeft: '1px solid var(--border)',
          paddingLeft: 24
        } : null),
        visibility: shut ? 'hidden' : 'visible',
        opacity: shut ? 0 : 1,
        transform: shut ? 'translateX(1rem)' : 'none',
        pointerEvents: shut ? 'none' : 'auto',
        transition: shut ? 'opacity 150ms ease, transform 150ms ease, visibility 0s linear 150ms' : 'opacity 240ms ease 100ms, transform 320ms ' + ease
      }
    }, /*#__PURE__*/React.createElement(InsightPanel, {
      flat: flat,
      narrow: !wide,
      instrument: i,
      low: stats.low,
      accountName: account === 1 ? 'Growth' : 'Retirement',
      onCollapse: () => setCollapsed(true)
    }), /*#__PURE__*/React.createElement(AccountValuePanel, {
      flat: flat,
      accountId: account,
      setAccount: setAccount,
      cash: 4820.55
    }), /*#__PURE__*/React.createElement(TradeTicket, {
      flat: flat,
      instrument: i,
      cash: 4820.55
    })))));
  }
  window.MarketPage = MarketPage;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instrument-view/MarketPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/instrument-view/MarketTools.jsx
try { (() => {
(() => {
  const {
    Icon,
    HeaderDropdown,
    MenuItem,
    InstrumentSearch,
    ChangePill
  } = window.TradingSeasonDesignSystem_86c3eb;
  const {
    TRANSACTIONS,
    ACCOUNTS,
    POSITIONS,
    money,
    find
  } = window.TSData;

  // .tool-button / .tool-icon from market-page.component.css
  function ToolButton({
    active,
    icon,
    children,
    onClick,
    label,
    square,
    style
  }) {
    const [h, setH] = React.useState(false);
    const bg = active ? 'rgba(0,187,255,.12)' : h ? 'rgba(0,187,255,.1)' : '#242424';
    const bc = active ? 'rgba(0,187,255,.45)' : h ? 'rgba(0,187,255,.55)' : 'rgba(238,250,255,.28)';
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": label,
      title: label,
      onClick: onClick,
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        display: 'flex',
        height: 30,
        width: square ? 30 : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        border: '1px solid ' + bc,
        borderRadius: 8,
        background: bg,
        padding: square ? 0 : '0 12px',
        color: active ? '#00bbff' : h ? '#eefaff' : 'rgba(238,250,255,.85)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'border-color 150ms, background-color 150ms, color 150ms',
        flexShrink: 0,
        ...style
      }
    }, icon ? /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: square ? 16 : 14
    }) : null, children);
  }
  const FLAT = {
    border: 0,
    borderBottom: '1px solid var(--border)',
    borderRadius: 0,
    background: 'transparent',
    paddingLeft: 0,
    paddingRight: 0
  };

  // .comparison-picker: #181818 floating panel
  const pickerStyle = {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid rgba(238,250,255,.15)',
    borderRadius: 8,
    background: '#181818',
    boxShadow: '0 1rem 2.5rem rgba(0,0,0,.45)'
  };
  function Popover({
    trigger,
    open,
    setOpen,
    children
  }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const c = e => {
        if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      };
      document.addEventListener('mousedown', c);
      return () => document.removeEventListener('mousedown', c);
    });
    return /*#__PURE__*/React.createElement("div", {
      ref: ref,
      style: {
        position: 'relative'
      }
    }, trigger, open ? children : null);
  }
  const TABS = [['overview', 'Overview'], ['news', 'News'], ['ai', 'AI'], ['recent-orders', 'Recent Orders']];
  const NEWS = [{
    age: '12 min ago',
    category: 'Market update',
    title: 'holds near its session high as trading activity increases.',
    includeSymbol: true
  }, {
    age: '48 min ago',
    category: 'Sector watch',
    title: 'Large-cap peers trade higher as investors favor established companies.'
  }, {
    age: '2 hr ago',
    category: 'Company outlook',
    title: 'Analysts continue to focus on demand, margins, and the next earnings update.'
  }, {
    age: '4 hr ago',
    category: 'Macroeconomy',
    title: 'Treasury yields ease as markets assess latest economic data.'
  }, {
    age: '5 hr ago',
    category: 'Earnings',
    title: 'Tech stocks extend gains ahead of key earnings reports this week.'
  }];
  const OVERVIEW = [['trending-up', 'Trend', 'Positive', 4], ['users-round', 'Popularity', 'Above average', 4], ['shield-check', 'Short-term risk', 'Moderate', 3], ['message-square-text', 'Sentiment', 'Bullish', 4]];
  const card = {
    border: '1px solid rgba(238,250,255,.1)',
    borderRadius: 8.8,
    background: 'rgba(238,250,255,.018)'
  };
  function Overview({
    symbol,
    low
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        paddingTop: 8,
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'repeat(2, 4.35rem)',
        gap: 6.4
      }
    }, OVERVIEW.map(([icon, k, v, lvl]) => /*#__PURE__*/React.createElement("article", {
      key: k,
      style: {
        ...card,
        display: 'grid',
        gridTemplateRows: 'minmax(0,1fr) auto',
        padding: '6.4px 7.2px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1.75rem minmax(0,1fr)',
        gap: 6.7,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(238,250,255,.1)',
        borderRadius: 7.2,
        background: 'rgba(238,250,255,.025)',
        color: 'rgba(238,250,255,.58)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 13
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 1.3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'rgba(238,250,255,.55)',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.035em'
      }
    }, k), /*#__PURE__*/React.createElement("strong", {
      style: {
        color: 'rgba(255,255,255,.9)',
        fontSize: 10.6,
        lineHeight: 1.15
      }
    }, v))), /*#__PURE__*/React.createElement("div", {
      role: "progressbar",
      "aria-label": k + ' level',
      "aria-valuemin": "0",
      "aria-valuemax": "5",
      "aria-valuenow": lvl,
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(5,1fr)',
        gap: 3.2,
        marginTop: 3.5
      }
    }, [1, 2, 3, 4, 5].map(s => /*#__PURE__*/React.createElement("span", {
      key: s,
      style: {
        height: 4.2,
        borderRadius: 999,
        background: s <= lvl ? 'rgba(255,255,255,.8)' : 'rgba(238,250,255,.12)'
      }
    })))))), /*#__PURE__*/React.createElement("aside", {
      style: {
        ...card,
        flex: '1 1 auto',
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        padding: '6.7px 10.4px',
        color: 'rgba(238,250,255,.5)'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", {
      style: {
        display: 'block',
        marginBottom: 3,
        color: 'rgba(238,250,255,.82)',
        fontSize: 10.2
      }
    }, "Session brief"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 9.8,
        lineHeight: 1.35
      }
    }, symbol, " shows steady strength, elevated activity, and positive sentiment with moderate near-term risk."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        fontSize: 9.8,
        lineHeight: 1.35
      }
    }, "Support is forming near ", money(low), ", while simulated participation remains above average. Signal scores are illustrative."))));
  }
  function News({
    symbol
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      style: {
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        paddingTop: 12
      }
    }, /*#__PURE__*/React.createElement("strong", {
      style: {
        display: 'block',
        fontSize: 14,
        paddingBottom: 12
      }
    }, "Latest headlines"), /*#__PURE__*/React.createElement("div", {
      "aria-label": "Simulated market headlines",
      style: {
        borderTop: '1px solid rgba(238,250,255,.09)'
      }
    }, NEWS.map(s => /*#__PURE__*/React.createElement(NewsStory, {
      key: s.title,
      s: s,
      symbol: symbol
    }))));
  }
  function NewsStory({
    s,
    symbol
  }) {
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("article", {
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        borderBottom: '1px solid rgba(238,250,255,.09)',
        padding: '13px 2.4px 13.8px',
        cursor: 'default'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        color: 'rgba(238,250,255,.46)',
        fontSize: 9.3,
        fontWeight: 600,
        letterSpacing: '0.045em',
        textTransform: 'uppercase'
      }
    }, /*#__PURE__*/React.createElement("time", null, s.age), /*#__PURE__*/React.createElement("span", null, s.category)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto',
        alignItems: 'center',
        gap: 9,
        marginTop: 5
      }
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: 0,
        color: h ? 'rgba(238,250,255,.92)' : 'rgba(238,250,255,.6)',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.42,
        transition: 'color 150ms'
      }
    }, s.includeSymbol ? symbol + ' ' + s.title : s.title), /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        color: 'rgba(238,250,255,.42)',
        fontSize: 21.6,
        fontWeight: 300,
        lineHeight: 1
      }
    }, "\u203A")));
  }
  function AiChat({
    symbol,
    price,
    change
  }) {
    const [msgs, setMsgs] = React.useState([]);
    const [draft, setDraft] = React.useState('');
    const send = e => {
      e.preventDefault();
      const q = draft.trim();
      if (!q) return;
      setMsgs(m => m.concat({
        role: 'user',
        text: q
      }, {
        role: 'assistant',
        text: 'Simulated reply: ' + symbol + ' is at ' + money(price) + ' (' + (change >= 0 ? '+' : '') + change.toFixed(2) + '% today). Responses in this mock are placeholders.'
      }));
      setDraft('');
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        paddingTop: 8
      }
    }, msgs.length ? /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      "aria-live": "polite",
      style: {
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '8px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, msgs.map((m, k) => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        maxWidth: '92%',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        lineHeight: '20px',
        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
        background: m.role === 'user' ? 'var(--primary-15)' : 'rgba(255,255,255,.05)',
        color: m.role === 'user' ? 'var(--foreground)' : 'var(--muted-foreground)'
      }
    }, m.text))) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flex: 1,
        minHeight: 0,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bot-message-square",
      size: 36,
      style: {
        color: 'var(--muted-foreground)',
        marginBottom: 16
      }
    }), /*#__PURE__*/React.createElement("strong", {
      style: {
        fontSize: 16,
        fontWeight: 600
      }
    }, "Ask about ", symbol), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '4px 0 0',
        maxWidth: 224,
        fontSize: 12,
        lineHeight: '20px',
        color: 'var(--muted-foreground)'
      }
    }, "Explore the chart, price movement, volume, or market terminology.")), /*#__PURE__*/React.createElement("form", {
      onSubmit: send,
      style: {
        marginTop: 8,
        display: 'flex',
        minHeight: 44,
        alignItems: 'center',
        gap: 8,
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,.1)',
        background: '#202020',
        padding: '6px 6px 6px 12px'
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "text",
      "aria-label": "Ask market AI",
      placeholder: 'Ask about ' + symbol,
      value: draft,
      onChange: e => setDraft(e.target.value),
      style: {
        minWidth: 0,
        flex: 1,
        background: 'transparent',
        border: 0,
        outline: 'none',
        fontSize: 12
      }
    }), /*#__PURE__*/React.createElement("button", {
      type: "submit",
      "aria-label": "Send question",
      title: "Send question",
      disabled: !draft.trim(),
      style: {
        width: 32,
        height: 32,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 0,
        borderRadius: 6,
        background: 'var(--primary)',
        color: 'var(--primary-foreground)',
        cursor: draft.trim() ? 'pointer' : 'not-allowed',
        opacity: draft.trim() ? 1 : 0.3
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "send-horizontal",
      size: 16
    }))));
  }
  function RecentOrders({
    accountName
  }) {
    const trades = TRANSACTIONS.filter(t => t.kind === 'trade');
    return /*#__PURE__*/React.createElement("div", {
      className: "ts-scroll",
      role: "tabpanel",
      "aria-label": "Recent Orders",
      style: {
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        paddingTop: 12
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '0 0 8px',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, accountName, " \xB7 All stocks"), /*#__PURE__*/React.createElement("ul", {
      style: {
        listStyle: 'none',
        margin: 0,
        padding: 0
      }
    }, trades.map((t, k) => /*#__PURE__*/React.createElement("li", {
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
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 500
      }
    }, t.symbol), /*#__PURE__*/React.createElement(ChangePill, {
      tag: true,
      tone: t.side === 'buy' ? 'primary' : 'loss',
      style: {
        marginLeft: 8
      }
    }, t.side), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, t.date)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      },
      className: "tabular-nums"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block'
      }
    }, money(t.shares * t.price)), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, t.shares, " @ ", money(t.price)))))));
  }
  function InsightPanel({
    instrument,
    low,
    accountName,
    onCollapse,
    narrow,
    flat
  }) {
    const [tab, setTab] = React.useState('overview');
    const [hov, setHov] = React.useState(null);
    return /*#__PURE__*/React.createElement("section", {
      style: {
        display: 'flex',
        minHeight: narrow ? '18rem' : 140,
        flex: narrow ? '0 0 auto' : '1 1 0',
        height: narrow ? 'min(28rem, 60dvh)' : undefined,
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
        padding: 12,
        ...(flat ? {
          ...FLAT,
          paddingTop: 0
        } : null)
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 48,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border)'
      }
    }, /*#__PURE__*/React.createElement(ToolButton, {
      square: true,
      icon: "chevron-right",
      label: "Hide market tools",
      onClick: onCollapse,
      style: {
        borderColor: 'rgba(238,250,255,.2)',
        color: 'rgba(238,250,255,.8)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      role: "tablist",
      "aria-label": "Instrument tools",
      style: {
        display: 'flex',
        gap: 4,
        padding: 5.6,
        borderRadius: 8,
        background: 'var(--muted)',
        marginRight: 'auto'
      }
    }, TABS.map(([id, label]) => {
      const on = tab === id;
      return /*#__PURE__*/React.createElement("button", {
        key: id,
        type: "button",
        role: "tab",
        "aria-selected": on,
        onClick: () => setTab(id),
        onMouseEnter: () => setHov(id),
        onMouseLeave: () => setHov(null),
        style: {
          flex: on ? 1 : undefined,
          cursor: 'pointer',
          border: 0,
          borderRadius: 6,
          padding: on ? '2px 13.6px' : '2px 8px',
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          transition: 'color 150ms, background 150ms',
          background: on ? 'var(--primary)' : 'transparent',
          color: on ? 'var(--primary-foreground)' : hov === id ? 'var(--foreground)' : 'var(--muted-foreground)'
        }
      }, label);
    }))), tab === 'overview' ? /*#__PURE__*/React.createElement(Overview, {
      symbol: instrument.symbol,
      low: low
    }) : null, tab === 'news' ? /*#__PURE__*/React.createElement(News, {
      symbol: instrument.symbol
    }) : null, tab === 'ai' ? /*#__PURE__*/React.createElement(AiChat, {
      symbol: instrument.symbol,
      price: instrument.price,
      change: instrument.changePercent
    }) : null, tab === 'recent-orders' ? /*#__PURE__*/React.createElement(RecentOrders, {
      accountName: accountName
    }) : null);
  }
  function AccountValuePanel({
    accountId,
    setAccount,
    cash,
    flat
  }) {
    const acct = ACCOUNTS.find(a => a.id === accountId) || ACCOUNTS[0];
    const pv = accountId === 1 ? 7604.68 : 21380.4;
    const bal = (label, value, tint) => /*#__PURE__*/React.createElement("div", {
      style: flat ? {
        display: 'grid',
        gap: 2
      } : {
        display: 'grid',
        alignContent: 'start',
        gap: 2.4,
        padding: '7.2px 12px',
        border: '1px solid color-mix(in srgb, ' + tint + ' 14%, var(--border))',
        borderRadius: 8.8,
        background: 'color-mix(in srgb, ' + tint + ' 2%, transparent)'
      }
    }, /*#__PURE__*/React.createElement("dt", {
      style: {
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, label), /*#__PURE__*/React.createElement("dd", {
      style: {
        margin: 0,
        fontSize: 20,
        fontWeight: 600,
        color: 'color-mix(in srgb, ' + tint + ' 18%, var(--foreground))'
      },
      className: "tabular-nums"
    }, money(value)));
    return /*#__PURE__*/React.createElement("section", {
      "aria-label": "Trading account",
      style: {
        position: 'relative',
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 6.4,
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
        padding: 10,
        ...(flat ? {
          ...FLAT,
          padding: '16px 0',
          gap: 12
        } : null)
      }
    }, /*#__PURE__*/React.createElement(HeaderDropdown, {
      icon: "briefcase-business",
      label: acct.name,
      width: "100%",
      ariaLabel: "Select account",
      triggerStyle: {
        height: 40,
        gap: 12
      }
    }, close => /*#__PURE__*/React.createElement("div", {
      role: "menu",
      "aria-label": "Accounts"
    }, ACCOUNTS.map(a => /*#__PURE__*/React.createElement("div", {
      key: a.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(MenuItem, {
      onClick: () => {
        setAccount(a.id);
        close();
      },
      trailing: a.id === accountId ? /*#__PURE__*/React.createElement(Icon, {
        name: "check",
        color: "var(--primary)"
      }) : null,
      style: {
        flex: 1
      }
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
    }, "Portfolio ", money(a.id === 1 ? 7604.68 : 21380.4))), /*#__PURE__*/React.createElement(MenuItem, {
      icon: "pencil",
      style: {
        width: 32,
        minHeight: 32,
        padding: 0,
        justifyContent: 'center',
        color: 'var(--muted-foreground)',
        flex: '0 0 32px'
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: '1px solid var(--border)',
        margin: '4px 0'
      }
    }), /*#__PURE__*/React.createElement(MenuItem, {
      tone: "primary",
      icon: "plus",
      onClick: close
    }, "New account"))), /*#__PURE__*/React.createElement("dl", {
      style: {
        margin: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 6.4
      }
    }, bal('Available cash', cash, '#c5a77b'), bal('Portfolio value', pv, 'var(--primary)')));
  }

  // app-trade-ticket: compact order execution card for the market page.
  function TradeTicket({
    instrument,
    cash,
    flat
  }) {
    const {
      SideToggle
    } = window.TradingSeasonDesignSystem_86c3eb;
    const [side, setSide] = React.useState('buy');
    const [qty, setQty] = React.useState(0);
    const [msg, setMsg] = React.useState('');
    React.useEffect(() => {
      setQty(0);
      setMsg('');
    }, [instrument.symbol]);
    const held = (POSITIONS[instrument.symbol] || {}).shares || 0;
    const max = side === 'buy' ? Math.floor(cash / instrument.price) : held;
    const q = Math.min(qty, max);
    const value = q * instrument.price;
    const set = v => {
      setQty(Math.max(0, Math.min(max, Math.floor(Number(v) || 0))));
      setMsg('');
    };
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
    return /*#__PURE__*/React.createElement("section", {
      "aria-label": "Order execution",
      style: {
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
        padding: 12,
        ...(flat ? {
          ...FLAT,
          borderBottom: 0,
          padding: '16px 0 0'
        } : null)
      }
    }, /*#__PURE__*/React.createElement(SideToggle, {
      value: side,
      onChange: s => {
        setSide(s);
        setMsg('');
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        ...(flat ? {
          borderBottom: '1px solid var(--border)',
          padding: '8px 0 12px'
        } : {
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 12
        })
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("label", {
      htmlFor: "future-trade-quantity",
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
    }, "Max ", max)), /*#__PURE__*/React.createElement("input", {
      id: "future-trade-quantity",
      type: "number",
      min: "0",
      max: max,
      value: q,
      disabled: max === 0,
      onChange: e => set(e.target.value),
      style: {
        marginTop: 4,
        width: '100%',
        background: 'transparent',
        border: 0,
        outline: 'none',
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '-0.025em'
      },
      className: "tabular-nums"
    }), /*#__PURE__*/React.createElement("input", {
      type: "range",
      "aria-label": "Shares",
      min: "0",
      max: max,
      value: q,
      onChange: e => set(e.target.value),
      style: {
        marginTop: 8,
        width: '100%',
        accentColor: '#00bbff'
      }
    })), /*#__PURE__*/React.createElement("dl", {
      style: {
        margin: '10px 0 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        borderRadius: 12,
        padding: flat ? '4px 0' : 12,
        fontSize: 12,
        background: flat ? 'transparent' : 'rgba(26,26,26,.6)'
      }
    }, row('Market price', money(instrument.price)), row('Shares', q), row('Cash before', money(cash)), row('Cash after', money(side === 'buy' ? cash - value : cash + value)), row('Estimated ' + (side === 'buy' ? 'cost' : 'proceeds'), money(value), true)), /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: 8
      }
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      disabled: !q,
      onClick: () => setMsg((side === 'buy' ? 'Bought ' : 'Sold ') + q + ' ' + instrument.symbol + '.'),
      style: {
        height: 44,
        width: '100%',
        border: 0,
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        cursor: q ? 'pointer' : 'not-allowed',
        opacity: q ? 1 : 0.4,
        background: side === 'buy' ? 'var(--primary)' : 'var(--color-loss)',
        color: side === 'buy' ? 'var(--primary-foreground)' : '#fff'
      }
    }, (side === 'buy' ? 'Buy' : 'Sell') + ' ' + q + ' ' + instrument.symbol), msg ? /*#__PURE__*/React.createElement("p", {
      role: "status",
      style: {
        margin: '6px 0 0',
        textAlign: 'center',
        fontSize: 12
      }
    }, msg) : null);
  }
  Object.assign(window, {
    ToolButton,
    Popover,
    pickerStyle,
    InsightPanel,
    AccountValuePanel,
    TradeTicket
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instrument-view/MarketTools.jsx", error: String((e && e.message) || e) }); }

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
        border: '1px solid rgba(255, 61, 90,.3)',
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
