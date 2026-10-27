// public/quote-block/src/Scene.tsx
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring
} from "remotion";
import { jsx, jsxs } from "react/jsx-runtime";
var THEMES = {
  dark_modern: { bg: "#0A0A0A", bgSecondary: "#1A1A1A", text: "#FFFFFF", textSecondary: "#9CA3AF" },
  light_clean: { bg: "#FFFFFF", bgSecondary: "#F5F5F5", text: "#111111", textSecondary: "#6B7280" },
  bold_vibrant: { bg: "#1A0533", bgSecondary: "#2D1B69", text: "#FFFFFF", textSecondary: "#C4B5FD" },
  corporate: { bg: "#F8F9FA", bgSecondary: "#E9ECEF", text: "#212529", textSecondary: "#6C757D" }
};
function QuoteScene({ data = {}, theme = "dark_modern", animation = { enter: 1, hold: 4, exit: 0.5 } }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const quote = data.quote ?? "The best way to predict the future is to create it.";
  const author = data.author ?? "Peter Drucker";
  const accent = data.accentColor ?? "#0EA5E9";
  const textAlign = data.textAlign ?? "center";
  const colors = THEMES[theme] ?? THEMES.dark_modern;
  const enterFrames = animation.enter * fps;
  const quoteMarkScale = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const lineWidth = interpolate(frame, [enterFrames * 0.3, enterFrames * 0.8], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const textOpacity = interpolate(frame, [enterFrames * 0.4, enterFrames * 0.9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const textY = interpolate(frame, [enterFrames * 0.4, enterFrames * 0.9], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const authorOpacity = interpolate(frame, [enterFrames * 0.7, enterFrames * 1.1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const authorY = interpolate(frame, [enterFrames * 0.7, enterFrames * 1.1], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ jsx(
    AbsoluteFill,
    {
      style: {
        backgroundColor: colors.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        fontFamily: "'Georgia', 'Times New Roman', serif"
      },
      children: /* @__PURE__ */ jsxs("div", { style: { maxWidth: 900, width: "100%", textAlign }, children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              fontSize: 120,
              lineHeight: 1,
              color: accent,
              transform: `scale(${quoteMarkScale})`,
              transformOrigin: textAlign === "right" ? "right center" : textAlign === "center" ? "center" : "left center",
              marginBottom: -20,
              opacity: 0.9
            },
            children: "\u201C"
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              fontSize: 38,
              fontWeight: 400,
              color: colors.text,
              lineHeight: 1.5,
              letterSpacing: "-0.01em",
              opacity: textOpacity,
              transform: `translateY(${textY}px)`,
              marginBottom: 40
            },
            children: quote
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: textAlign === "right" ? "flex-end" : textAlign === "center" ? "center" : "flex-start",
              marginBottom: 28
            },
            children: /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  height: 3,
                  width: `${lineWidth}%`,
                  maxWidth: 120,
                  backgroundColor: accent,
                  borderRadius: 2
                }
              }
            )
          }
        ),
        /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              fontSize: 22,
              fontWeight: 600,
              color: colors.textSecondary,
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: authorOpacity,
              transform: `translateY(${authorY}px)`
            },
            children: [
              "\u2014 ",
              author
            ]
          }
        )
      ] })
    }
  );
}
export {
  QuoteScene as default
};
