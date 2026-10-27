var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// plugins/custom/announcement-block/src/Scene.tsx
var exports_Scene = {};
__export(exports_Scene, {
  default: () => AnnouncementScene
});
module.exports = __toCommonJS(exports_Scene);
var import_remotion3 = require("remotion");

// shared/plugin-utils/base-scene.tsx
var import_react = require("react");
var import_remotion = require("remotion");
var jsx_dev_runtime = require("react/jsx-dev-runtime");
var THEMES = {
  dark_modern: {
    background: "#0A0A0A",
    backgroundSecondary: "#1A1A1A",
    text: "#FFFFFF",
    textSecondary: "#9CA3AF",
    accent: "#3B82F6",
    accentSecondary: "#8B5CF6",
    border: "rgba(255,255,255,0.1)"
  },
  light_clean: {
    background: "#FFFFFF",
    backgroundSecondary: "#F5F5F5",
    text: "#1F2937",
    textSecondary: "#6B7280",
    accent: "#3B82F6",
    accentSecondary: "#6366F1",
    border: "rgba(0,0,0,0.1)"
  },
  gradient_vibrant: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    backgroundSecondary: "rgba(255,255,255,0.1)",
    text: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.8)",
    accent: "#FCD34D",
    accentSecondary: "#F472B6",
    border: "rgba(255,255,255,0.2)"
  },
  minimal_bw: {
    background: "#000000",
    backgroundSecondary: "#111111",
    text: "#FFFFFF",
    textSecondary: "#666666",
    accent: "#FFFFFF",
    accentSecondary: "#888888",
    border: "rgba(255,255,255,0.05)"
  }
};
var BaseScene = ({
  children,
  theme = "dark_modern",
  customization = {},
  animation = { enter: 0.4, hold: 2, exit: 0.4 },
  className = "",
  style = {}
}) => {
  const frame = import_remotion.useCurrentFrame();
  const fps = 30;
  const themeColors = THEMES[theme] || THEMES.dark_modern;
  const totalFrames = (animation.enter + animation.hold + animation.exit) * fps;
  const enterEndFrame = animation.enter * fps;
  const exitStartFrame = (animation.enter + animation.hold) * fps;
  const enterProgress = frame <= enterEndFrame ? frame / enterEndFrame : 1;
  const exitProgress = frame >= exitStartFrame ? (frame - exitStartFrame) / (animation.exit * fps) : 0;
  const animationStyle = import_react.useMemo(() => {
    const enterAnim = customization.enterAnimation || "fade";
    const exitAnim = customization.exitAnimation || "fade";
    const enterStyles = {
      fade: { opacity: enterProgress },
      "slide-up": {
        opacity: enterProgress,
        transform: `translateY(${import_remotion.interpolate(enterProgress, [0, 1], [50, 0])}px)`
      },
      "slide-down": {
        opacity: enterProgress,
        transform: `translateY(${import_remotion.interpolate(enterProgress, [0, 1], [-50, 0])}px)`
      },
      "slide-left": {
        opacity: enterProgress,
        transform: `translateX(${import_remotion.interpolate(enterProgress, [0, 1], [50, 0])}px)`
      },
      "slide-right": {
        opacity: enterProgress,
        transform: `translateX(${import_remotion.interpolate(enterProgress, [0, 1], [-50, 0])}px)`
      },
      zoom: {
        opacity: enterProgress,
        transform: `scale(${import_remotion.interpolate(enterProgress, [0, 1], [0.8, 1])})`
      },
      bounce: {
        opacity: enterProgress,
        transform: `scale(${import_remotion.spring({ frame, fps, config: { damping: 10, stiffness: 100 } })})`
      },
      rotate: {
        opacity: enterProgress,
        transform: `rotate(${import_remotion.interpolate(enterProgress, [0, 1], [-10, 0])}deg)`
      },
      flip: {
        opacity: enterProgress,
        transform: `rotateY(${import_remotion.interpolate(enterProgress, [0, 1], [90, 0])}deg)`
      },
      none: {}
    };
    const exitStyles = {
      fade: { opacity: 1 - exitProgress },
      "slide-up": {
        opacity: 1 - exitProgress,
        transform: `translateY(${import_remotion.interpolate(exitProgress, [0, 1], [0, -50])}px)`
      },
      "slide-down": {
        opacity: 1 - exitProgress,
        transform: `translateY(${import_remotion.interpolate(exitProgress, [0, 1], [0, 50])}px)`
      },
      "slide-left": {
        opacity: 1 - exitProgress,
        transform: `translateX(${import_remotion.interpolate(exitProgress, [0, 1], [0, -50])}px)`
      },
      "slide-right": {
        opacity: 1 - exitProgress,
        transform: `translateX(${import_remotion.interpolate(exitProgress, [0, 1], [0, 50])}px)`
      },
      zoom: {
        opacity: 1 - exitProgress,
        transform: `scale(${import_remotion.interpolate(exitProgress, [0, 1], [1, 0.8])})`
      },
      bounce: { opacity: 1 - exitProgress },
      rotate: {
        opacity: 1 - exitProgress,
        transform: `rotate(${import_remotion.interpolate(exitProgress, [0, 1], [0, 10])}deg)`
      },
      flip: {
        opacity: 1 - exitProgress,
        transform: `rotateY(${import_remotion.interpolate(exitProgress, [0, 1], [0, 90])}deg)`
      },
      none: {}
    };
    const enterStyle = enterStyles[enterAnim] || enterStyles.fade;
    const exitStyle = exitStyles[exitAnim] || exitStyles.fade;
    return {
      ...enterStyle,
      ...exitProgress > 0 ? exitStyle : {}
    };
  }, [customization.enterAnimation, customization.exitAnimation, frame, fps, enterProgress, exitProgress]);
  const alignmentStyle = import_react.useMemo(() => {
    const verticalAlign = customization.verticalAlign || "center";
    const horizontalAlign = customization.horizontalAlign || "center";
    const justifyContentMap = {
      top: "flex-start",
      center: "center",
      bottom: "flex-end"
    };
    const alignItemsMap = {
      left: "flex-start",
      center: "center",
      right: "flex-end"
    };
    return {
      justifyContent: justifyContentMap[verticalAlign],
      alignItems: alignItemsMap[horizontalAlign]
    };
  }, [customization.verticalAlign, customization.horizontalAlign]);
  const backgroundStyle = import_react.useMemo(() => {
    const bgStyle = {};
    if (customization.backgroundColor) {
      bgStyle.background = customization.backgroundColor;
    } else if (customization.backgroundImage) {
      bgStyle.backgroundImage = `url(${customization.backgroundImage})`;
      bgStyle.backgroundSize = "cover";
      bgStyle.backgroundPosition = "center";
      if (customization.backgroundBlur) {}
    } else {
      bgStyle.background = themeColors.background;
    }
    return bgStyle;
  }, [customization.backgroundColor, customization.backgroundImage, themeColors.background]);
  const borderStyle = import_react.useMemo(() => {
    if (!customization.borderWidth && !customization.borderRadius) {
      return {};
    }
    return {
      borderWidth: customization.borderWidth ? `${customization.borderWidth}px` : undefined,
      borderColor: customization.borderColor || themeColors.border,
      borderRadius: customization.borderRadius ? `${customization.borderRadius}px` : undefined,
      borderStyle: customization.borderWidth ? "solid" : undefined
    };
  }, [customization.borderWidth, customization.borderColor, customization.borderRadius, themeColors.border]);
  const shadowStyle = import_react.useMemo(() => {
    if (!customization.shadowEnabled) {
      return {};
    }
    return {
      boxShadow: `0 ${customization.shadowBlur || 20}px ${customization.shadowBlur || 20}px ${customization.shadowColor || "rgba(0,0,0,0.5)"}`
    };
  }, [customization.shadowEnabled, customization.shadowBlur, customization.shadowColor]);
  const spacingStyle = import_react.useMemo(() => {
    return {
      padding: customization.padding ? `${customization.padding}px` : undefined,
      margin: customization.margin ? `${customization.margin}px` : undefined
    };
  }, [customization.padding, customization.margin]);
  const combinedStyle = {
    ...alignmentStyle,
    ...backgroundStyle,
    ...borderStyle,
    ...shadowStyle,
    ...spacingStyle,
    ...animationStyle,
    ...style
  };
  return /* @__PURE__ */ jsx_dev_runtime.jsxDEV(import_remotion.AbsoluteFill, {
    className,
    style: combinedStyle,
    children: [
      customization.backgroundImage && customization.backgroundBlur && /* @__PURE__ */ jsx_dev_runtime.jsxDEV(import_remotion.AbsoluteFill, {
        style: {
          backdropFilter: `blur(${customization.backgroundBlur}px)`,
          background: "rgba(0,0,0,0.3)"
        }
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsx_dev_runtime.jsxDEV(import_remotion.AbsoluteFill, {
        style: { ...alignmentStyle, padding: customization.padding || 40 },
        children
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
};
function extractCustomization(data) {
  return {
    verticalAlign: data.verticalAlign,
    horizontalAlign: data.horizontalAlign,
    enterAnimation: data.enterAnimation,
    exitAnimation: data.exitAnimation,
    animationDuration: data.animationDuration,
    backgroundColor: data.backgroundColor,
    backgroundImage: data.backgroundImage,
    backgroundBlur: data.backgroundBlur,
    borderColor: data.borderColor,
    borderWidth: data.borderWidth,
    borderRadius: data.borderRadius,
    shadowEnabled: data.shadowEnabled,
    shadowColor: data.shadowColor,
    shadowBlur: data.shadowBlur,
    padding: data.padding,
    margin: data.margin
  };
}
// shared/plugin-utils/animations.ts
var import_remotion2 = require("remotion");
// shared/plugin-utils/hooks.ts
var import_react2 = require("react");
// shared/plugin-utils/theme.ts
function getThemeColors(themeName) {
  return THEMES[themeName] || THEMES.dark_modern;
}
var AVAILABLE_THEMES = Object.keys(THEMES);
// plugins/custom/announcement-block/src/Scene.tsx
var jsx_dev_runtime2 = require("react/jsx-dev-runtime");
function AnnouncementScene({ data, theme: theme2, animation }) {
  const frame = import_remotion3.useCurrentFrame();
  const { fps } = import_remotion3.useVideoConfig();
  const colors = getThemeColors(theme2);
  const {
    emoji = "\uD83D\uDE80",
    headline = "Big Announcement!",
    subtext = "Something exciting is coming",
    accentColor = "#F59E0B",
    showSubtext = true,
    textSize = 72
  } = data;
  const enterFrames = Math.round(animation.enter * fps);
  const opacity = import_remotion3.interpolate(frame, [0, enterFrames], [0, 1], { extrapolateRight: "clamp" });
  const translateY = import_remotion3.interpolate(frame, [0, enterFrames], [40, 0], { extrapolateRight: "clamp" });
  const emojiScale = import_remotion3.spring({
    frame: Math.max(0, frame - Math.round(enterFrames * 0.3)),
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.6 },
    from: 0,
    to: 1
  });
  const headlineX = import_remotion3.interpolate(frame, [0, enterFrames], [-60, 0], { extrapolateRight: "clamp" });
  const subtextDelay = Math.round(enterFrames * 0.5);
  const subtextOpacity = import_remotion3.interpolate(frame, [subtextDelay, subtextDelay + Math.round(fps * 0.4)], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const lineWidth = import_remotion3.interpolate(frame, [enterFrames, enterFrames + fps], [0, 80], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return /* @__PURE__ */ jsx_dev_runtime2.jsxDEV(BaseScene, {
    theme: theme2,
    customization: extractCustomization(data),
    animation,
    children: /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("div", {
      style: {
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        textAlign: "center",
        padding: "0 60px",
        maxWidth: 900
      },
      children: [
        /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("div", {
          style: {
            fontSize: 96,
            transform: `scale(${emojiScale})`,
            lineHeight: 1,
            filter: `drop-shadow(0 0 20px ${accentColor}88)`
          },
          children: emoji
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("div", {
          style: {
            width: `${lineWidth}px`,
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)`,
            transition: "none"
          }
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("h1", {
          style: {
            fontSize: textSize,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.05,
            color: colors.text,
            transform: `translateX(${headlineX}px)`,
            margin: 0,
            textShadow: `0 0 40px ${accentColor}44`
          },
          children: headline
        }, undefined, false, undefined, this),
        showSubtext && subtext && /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("p", {
          style: {
            fontSize: Math.round(textSize * 0.32),
            color: colors.textSecondary,
            fontWeight: 400,
            lineHeight: 1.5,
            maxWidth: "75%",
            opacity: subtextOpacity,
            margin: 0
          },
          children: subtext
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
