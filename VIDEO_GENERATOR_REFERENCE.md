# Video Generator - Complete Reference Guide

This document contains all supported content blocks, styles, animations, effects, and options.

---

## Table of Contents

1. [Video Meta Configuration](#1-video-meta-configuration)
2. [Content Blocks](#2-content-blocks)
3. [Image Effects](#3-image-effects)
4. [Text Styles & Animations](#4-text-styles--animations)
5. [Color Overlays](#5-color-overlays)
6. [Audio Support](#6-audio-support)
7. [Themes](#7-themes)
8. [Aspect Ratios](#8-aspect-ratios)
9. [Motion Profiles](#9-motion-profiles)
10. [Transitions](#10-transitions)

---

## 1. Video Meta Configuration

### VideoMeta Schema

```json
{
  "videoMeta": {
    "aspectRatio": "9:16",
    "theme": "dark_modern",
    "fps": 30,
    "intro": {
      "title": "Video Title",
      "subtitle": "Subtitle Here",
      "logoUrl": "https://example.com/logo.png",
      "duration": 2
    },
    "outro": {
      "title": "Thanks for Watching",
      "subtitle": "Subscribe for more",
      "logoUrl": "https://example.com/logo.png",
      "duration": 2
    }
  },
  "contentBlocks": [...]
}
```

### VideoMeta Fields

| Field | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `aspectRatio` | string | `"9:16"` | `"16:9"`, `"9:16"`, `"1:1"`, `"4:5"` | Video dimensions |
| `theme` | string | `"dark_modern"` | See Themes section | Visual theme |
| `fps` | number | `30` | `24` - `60` | Frames per second |
| `intro` | object | optional | See IntroOutro | Intro configuration |
| `outro` | object | optional | See IntroOutro | Outro configuration |

### IntroOutro Fields

| Field | Type | Max Length | Required | Description |
|-------|------|------------|----------|-------------|
| `title` | string | 100 | No | Main title text |
| `subtitle` | string | 200 | No | Subtitle text |
| `logoUrl` | string (URL) | - | No | Logo image URL |
| `duration` | number | 1-5 | No | Duration in seconds (default: 2) |

---

## 2. Content Blocks

### Block Types Summary

| # | Type | Description | Key Fields |
|---|------|-------------|------------|
| 1 | `stat` | Display a statistic | heading, value, subtext |
| 2 | `comparison` | Compare values | title, items[] |
| 3 | `text` | Simple text | content, emphasis |
| 4 | `image` | Display image | src, alt, caption |
| 5 | `quote` | Display a quote | text, author |
| 6 | `list` | Bullet/numbered list | title, items[], style |
| 7 | `timeline` | Timeline events | title, events[] |
| 8 | `callout` | Highlighted notice | title, content, variant |
| 9 | `icon-list` | List with icons | title, items[] |
| 10 | `line-chart` | Line chart | title, data[], labels[] |
| 11 | `pie-chart` | Pie chart | title, segments[] |
| 12 | `code` | Code display | code, language, title |
| 13 | `testimonial` | Customer testimonial | quote, author, role, avatar |
| 14 | `whatsapp-chat` | Chat conversation | person1, person2, messages[] |
| 15 | `motivational-image` | Image + text + audio | imageSrc, text, audioSrc, effects |

---

### 2.1 Stat Block

Display a statistic with heading and value.

```json
{
  "type": "stat",
  "heading": "Revenue Growth",
  "value": "250%",
  "subtext": "Year over year increase"
}
```

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `type` | literal | Yes | - | Must be `"stat"` |
| `heading` | string | Yes | 100 | Main heading |
| `value` | string | Yes | 50 | Statistic value |
| `subtext` | string | No | - | Additional context |

---

### 2.2 Comparison Block

Compare multiple values visually.

```json
{
  "type": "comparison",
  "title": "Market Share",
  "items": [
    { "label": "Product A", "value": 45, "color": "#3B82F6" },
    { "label": "Product B", "value": 30, "color": "#10B981" },
    { "label": "Product C", "value": 25, "color": "#F59E0B" }
  ]
}
```

| Field | Type | Required | Min/Max | Description |
|-------|------|----------|---------|-------------|
| `type` | literal | Yes | - | Must be `"comparison"` |
| `title` | string | No | max 100 | Comparison title |
| `items` | array | Yes | 2-6 items | Comparison items |

**ComparisonItem Fields:**

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `label` | string | Yes | 50 | Item label |
| `value` | number | Yes | min 0 | Numeric value |
| `color` | string | No | - | Hex color code |

---

### 2.3 Text Block

Simple text content.

```json
{
  "type": "text",
  "content": "This is a simple text block with emphasis",
  "emphasis": "high"
}
```

| Field | Type | Required | Max Length | Options |
|-------|------|----------|------------|---------|
| `type` | literal | Yes | - | Must be `"text"` |
| `content` | string | Yes | 500 | Text content |
| `emphasis` | enum | No | - | `"low"`, `"medium"`, `"high"` |

---

### 2.4 Image Block

Display an image with optional caption.

```json
{
  "type": "image",
  "src": "https://example.com/image.jpg",
  "alt": "Image description",
  "caption": "Image caption text"
}
```

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `type` | literal | Yes | - | Must be `"image"` |
| `src` | string (URL) | Yes | - | Image URL |
| `alt` | string | No | 200 | Alt text |
| `caption` | string | No | 100 | Caption text |

---

### 2.5 Quote Block

Display a quote with optional author.

```json
{
  "type": "quote",
  "text": "The only way to do great work is to love what you do.",
  "author": "Steve Jobs"
}
```

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `type` | literal | Yes | - | Must be `"quote"` |
| `text` | string | Yes | 300 | Quote text |
| `author` | string | No | 100 | Author name |

---

### 2.6 List Block

Bullet, numbered, or checkmark list.

```json
{
  "type": "list",
  "title": "Key Features",
  "items": ["Fast rendering", "Easy to use", "Customizable"],
  "style": "bullet"
}
```

| Field | Type | Required | Min/Max | Options |
|-------|------|----------|---------|---------|
| `type` | literal | Yes | - | Must be `"list"` |
| `title` | string | No | max 100 | List title |
| `items` | string[] | Yes | 1-10 items | List items (max 200 chars each) |
| `style` | enum | No | - | `"bullet"`, `"numbered"`, `"checkmarks"` |

---

### 2.7 Timeline Block

Display timeline of events.

```json
{
  "type": "timeline",
  "title": "Company History",
  "events": [
    { "year": "2020", "title": "Founded", "description": "Started in a garage" },
    { "year": "2022", "title": "Series A", "description": "Raised $10M" },
    { "year": "2024", "title": "Global", "description": "Expanded to 50 countries" }
  ]
}
```

| Field | Type | Required | Min/Max | Description |
|-------|------|----------|---------|-------------|
| `type` | literal | Yes | - | Must be `"timeline"` |
| `title` | string | No | max 100 | Timeline title |
| `events` | array | Yes | 2-8 events | Timeline events |

**TimelineEvent Fields:**

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `year` | string | Yes | 20 | Year/date |
| `title` | string | Yes | 100 | Event title |
| `description` | string | No | 200 | Event description |

---

### 2.8 Callout Block

Highlighted notice or alert.

```json
{
  "type": "callout",
  "title": "Important Notice",
  "content": "This feature will be deprecated soon",
  "variant": "warning"
}
```

| Field | Type | Required | Max Length | Options |
|-------|------|----------|------------|---------|
| `type` | literal | Yes | - | Must be `"callout"` |
| `title` | string | Yes | 100 | Callout title |
| `content` | string | Yes | 300 | Callout content |
| `variant` | enum | No | - | `"default"`, `"success"`, `"warning"`, `"info"` |

---

### 2.9 Icon List Block

List with icons/emojis.

```json
{
  "type": "icon-list",
  "title": "Our Services",
  "items": [
    { "icon": "🚀", "title": "Fast Delivery", "description": "Within 24 hours" },
    { "icon": "💰", "title": "Best Price", "description": "Price match guarantee" },
    { "icon": "⭐", "title": "Top Rated", "description": "5 star reviews" }
  ]
}
```

| Field | Type | Required | Min/Max | Description |
|-------|------|----------|---------|-------------|
| `type` | literal | Yes | - | Must be `"icon-list"` |
| `title` | string | No | max 100 | List title |
| `items` | array | Yes | 1-6 items | Icon items |

**IconItem Fields:**

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `icon` | string | Yes | 50 | Icon/emoji |
| `title` | string | Yes | 100 | Item title |
| `description` | string | No | 200 | Item description |

---

### 2.10 Line Chart Block

Line chart data visualization.

```json
{
  "type": "line-chart",
  "title": "Monthly Sales",
  "data": [10, 25, 30, 45, 60, 80],
  "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  "lineColor": "#3B82F6"
}
```

| Field | Type | Required | Min/Max | Description |
|-------|------|----------|---------|-------------|
| `type` | literal | Yes | - | Must be `"line-chart"` |
| `title` | string | No | max 100 | Chart title |
| `data` | number[] | Yes | 2-24 values | Data points |
| `labels` | string[] | No | 2-24 labels | X-axis labels |
| `lineColor` | string | No | - | Line color (hex) |

---

### 2.11 Pie Chart Block

Pie chart data visualization.

```json
{
  "type": "pie-chart",
  "title": "Budget Allocation",
  "segments": [
    { "label": "Marketing", "value": 40, "color": "#3B82F6" },
    { "label": "Development", "value": 35, "color": "#10B981" },
    { "label": "Operations", "value": 25, "color": "#F59E0B" }
  ]
}
```

| Field | Type | Required | Min/Max | Description |
|-------|------|----------|---------|-------------|
| `type` | literal | Yes | - | Must be `"pie-chart"` |
| `title` | string | No | max 100 | Chart title |
| `segments` | array | Yes | 2-8 segments | Pie segments |

**PieSegment Fields:**

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `label` | string | Yes | 50 | Segment label |
| `value` | number | Yes | min 0 | Segment value |
| `color` | string | No | - | Segment color (hex) |

---

### 2.12 Code Block

Display code with syntax highlighting.

```json
{
  "type": "code",
  "code": "const hello = 'world';\nconsole.log(hello);",
  "language": "javascript",
  "title": "Example Code"
}
```

| Field | Type | Required | Max Length | Default | Description |
|-------|------|----------|------------|---------|-------------|
| `type` | literal | Yes | - | - | Must be `"code"` |
| `code` | string | Yes | 2000 | - | Code content |
| `language` | string | No | 50 | `"javascript"` | Programming language |
| `title` | string | No | 100 | - | Code title |

---

### 2.13 Testimonial Block

Customer testimonial with avatar.

```json
{
  "type": "testimonial",
  "quote": "This product changed my life! Highly recommended for everyone.",
  "author": "John Doe",
  "role": "CEO",
  "company": "Tech Corp",
  "avatar": "https://example.com/avatar.jpg"
}
```

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `type` | literal | Yes | - | Must be `"testimonial"` |
| `quote` | string | Yes | 400 | Testimonial quote |
| `author` | string | Yes | 100 | Author name |
| `role` | string | No | 100 | Author's role |
| `company` | string | No | 100 | Company name |
| `avatar` | string (URL) | No | - | Avatar image URL |

---

### 2.14 WhatsApp Chat Block

Chat conversation simulation.

```json
{
  "type": "whatsapp-chat",
  "title": "Chat with Support",
  "person1": {
    "name": "You",
    "avatar": "https://example.com/you.jpg",
    "isOnline": true
  },
  "person2": {
    "name": "John",
    "avatar": "https://example.com/john.jpg",
    "isOnline": true
  },
  "messages": [
    { "from": "person2", "text": "Hey! How are you?", "time": "10:30 AM", "showReadReceipt": true },
    { "from": "person1", "text": "I'm good, thanks!", "time": "10:31 AM", "showReadReceipt": true },
    { "from": "person2", "text": "What can I help you with?", "time": "10:32 AM" },
    { "from": "person1", "text": "I need help with my order", "time": "10:33 AM" }
  ],
  "showTypingIndicator": true,
  "lastSeen": "last seen today at 10:25 AM"
}
```

| Field | Type | Required | Max/Min | Default | Description |
|-------|------|----------|---------|---------|-------------|
| `type` | literal | Yes | - | - | Must be `"whatsapp-chat"` |
| `title` | string | No | max 100 | - | Chat header title |
| `person1` | object | Yes | - | - | Sender (right/green bubbles) |
| `person2` | object | Yes | - | - | Receiver (left/white bubbles) |
| `messages` | array | Yes | 1-50 | - | Chat messages |
| `showTypingIndicator` | boolean | No | - | `true` | Show typing animation |
| `lastSeen` | string | No | max 50 | - | Last seen text |

**WhatsAppParticipant Fields:**

| Field | Type | Required | Max Length | Default | Description |
|-------|------|----------|------------|---------|-------------|
| `name` | string | Yes | 50 | - | Participant name |
| `avatar` | string | No | - | - | Avatar URL or placeholder |
| `isOnline` | boolean | No | - | `true` | Online status |

**WhatsAppMessage Fields:**

| Field | Type | Required | Max Length | Default | Description |
|-------|------|----------|------------|---------|-------------|
| `from` | enum | Yes | - | - | `"person1"` or `"person2"` |
| `text` | string | Yes | 500 | - | Message text |
| `time` | string | No | 20 | - | Timestamp (e.g., "10:30 AM") |
| `showReadReceipt` | boolean | No | - | `true` | Show double tick |

---

### 2.15 Motivational Image Block

Image with text overlay, effects, and optional audio.

```json
{
  "type": "motivational-image",
  "imageSrc": "https://example.com/background.jpg",
  "imageAlt": "Motivational background",
  "imageEffect": "ken-burns",
  "imageEffectDuration": 1.5,
  "text": "Believe in yourself",
  "textStyle": "typing",
  "fontSize": "xlarge",
  "fontWeight": "bold",
  "textColor": "#FFFFFF",
  "textAlign": "center",
  "textPosition": "center",
  "textAnimationDelay": 0.3,
  "colorOverlay": {
    "enabled": true,
    "color": "#000000",
    "opacity": 0.4,
    "animation": "fade"
  },
  "backgroundColor": "#000000",
  "imageFit": "cover",
  "imagePosition": "center",
  "audioSrc": "https://example.com/audio.mp3",
  "audioVolume": 0.8,
  "duration": 10
}
```

| Field | Type | Required | Max/Min | Default | Description |
|-------|------|----------|---------|---------|-------------|
| `type` | literal | Yes | - | - | Must be `"motivational-image"` |
| `imageSrc` | string | Yes | min 1 | - | Image URL |
| `imageAlt` | string | No | max 200 | - | Alt text |
| `imageEffect` | enum | No | - | `"fade"` | See Image Effects |
| `imageEffectDuration` | number | No | 0.5-5 | 1.5 | Effect duration (seconds) |
| `text` | string | No | max 500 | - | Text content (optional) |
| `textStyle` | enum | No | - | `"default"` | See Text Styles |
| `fontSize` | enum | No | - | `"xlarge"` | See Font Sizes |
| `fontWeight` | enum | No | - | `"bold"` | See Font Weights |
| `textColor` | string | No | - | `"#FFFFFF"` | Text color (hex) |
| `textAlign` | enum | No | - | `"center"` | See Text Alignment |
| `textPosition` | enum | No | - | `"center"` | See Text Positions |
| `textAnimationDelay` | number | No | 0-5 | 0.3 | Delay before text animates |
| `colorOverlay` | object | No | - | - | See Color Overlay |
| `backgroundColor` | string | No | - | `"#000000"` | Background color (hex) |
| `imageFit` | enum | No | - | `"cover"` | See Image Fit |
| `imagePosition` | enum | No | - | `"center"` | See Image Position |
| `audioSrc` | string | No | - | - | Audio URL (mp3) |
| `audioVolume` | number | No | 0-1 | 0.7 | Audio volume |
| `duration` | number | No | 1-120 | - | Duration override (seconds) |

---

## 3. Image Effects

Available for `motivational-image` block.

| Effect | Description | Best For |
|--------|-------------|----------|
| `none` | No animation | Static images |
| `fade` | Simple fade in | General use |
| `slide-up` | Slide from bottom | Reveal effect |
| `slide-down` | Slide from top | Dramatic entrance |
| `slide-left` | Slide from right | Directional flow |
| `slide-right` | Slide from left | Directional flow |
| `zoom-in` | Zoom from small to normal | Focus attention |
| `zoom-out` | Zoom from large to normal | Reveal context |
| `ken-burns` | Slow zoom and pan (cinematic) | Cinematic feel |
| `blur` | Blur to clear | Mystery reveal |
| `rotate` | Rotate in | Dynamic entry |
| `bounce` | Bounce in | Playful content |

---

## 4. Text Styles & Animations

### 4.1 Text Styles

Available for `motivational-image` block.

| Style | Description | Best For |
|-------|-------------|----------|
| `default` | Simple fade in with shadow | General use |
| `quote` | Italic with left border | Quotes, testimonials |
| `typing` | Typewriter effect | Dramatic text |
| `words` | Word by word appearance | Emphasis on each word |
| `glow` | Glowing text effect | Dark backgrounds |
| `outline` | Outlined text (transparent fill) | Bold statements |
| `bold-glow` | Bold with glow | High impact text |
| `shadow` | Drop shadow effect | Depth and readability |

### 4.2 Text Animations

Available for text overlays.

| Animation | Description |
|-----------|-------------|
| `none` | No animation |
| `fade` | Fade in |
| `slide-up` | Slide from bottom |
| `slide-down` | Slide from top |
| `slide-left` | Slide from right |
| `slide-right` | Slide from left |
| `zoom` | Zoom in |
| `typewriter` | Character by character |
| `reveal` | Reveal effect |

### 4.3 Text Positions

| Position | Description |
|----------|-------------|
| `top` | Top of screen |
| `center` | Center of screen |
| `bottom` | Bottom of screen |
| `custom` | Custom x,y coordinates (via customPosition) |

### 4.4 Font Sizes

| Size | Usage | Relative Size |
|------|-------|---------------|
| `small` | Subtitles, captions | 14-16px |
| `medium` | Normal text | 18-20px |
| `large` | Headings | 24-28px |
| `xlarge` | Main text (default) | 32-40px |
| `xxlarge` | Big headlines | 48-64px |

### 4.5 Font Weights

| Weight | Description |
|--------|-------------|
| `normal` | Regular weight (400) |
| `bold` | Bold (700) - default |
| `black` | Extra bold/heavy (900) |

### 4.6 Text Alignment

| Alignment | Description |
|-----------|-------------|
| `left` | Left aligned |
| `center` | Center aligned (default) |
| `right` | Right aligned |

---

## 5. Color Overlays

Apply color tint over images.

```json
{
  "colorOverlay": {
    "enabled": true,
    "color": "#000000",
    "opacity": 0.4,
    "animation": "fade"
  }
}
```

| Field | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `enabled` | boolean | `false` | - | Enable overlay |
| `color` | string | `"#000000"` | Any hex color | Overlay color |
| `opacity` | number | `0.4` | 0-1 | 0 = transparent, 1 = solid |
| `animation` | enum | `"fade"` | `"none"`, `"fade"`, `"pulse"` | Overlay animation |

### Overlay Animations

| Animation | Description |
|-----------|-------------|
| `none` | No animation, instant |
| `fade` | Fade in smoothly |
| `pulse` | Pulsing effect |

---

## 6. Audio Support

Add background audio to `motivational-image` blocks.

### Audio Fields

| Field | Type | Default | Range | Description |
|-------|------|---------|-------|-------------|
| `audioSrc` | string | - | - | URL to mp3 audio file |
| `audioVolume` | number | `0.7` | 0-1 | Volume level (0 = mute, 1 = max) |
| `duration` | number | auto | 1-120 | Duration in seconds |

### Duration Behavior

| Audio Provided? | Duration Provided? | Behavior |
|-----------------|-------------------|----------|
| No | No | Calculated from text length |
| No | Yes | Uses provided duration |
| Yes | No | Uses audio duration |
| Yes | Yes | Uses provided duration (may cut audio) |

### Example with Audio

```json
{
  "type": "motivational-image",
  "imageSrc": "https://example.com/background.jpg",
  "text": "Stay motivated!",
  "audioSrc": "https://example.com/music.mp3",
  "audioVolume": 0.5,
  "duration": 15
}
```

---

## 7. Themes

| Theme | Description | Background | Text Color |
|-------|-------------|------------|------------|
| `dark_modern` | Dark background, modern look | Dark gray/Black | White/Light gray |
| `light_minimal` | Light background, minimal | White/Light gray | Dark gray/Black |
| `bold_vibrant` | Colorful, bold | Vibrant colors | White/Black |
| `corporate` | Professional, clean | Neutral colors | Dark gray |

---

## 8. Aspect Ratios

| Ratio | Dimensions | Usage |
|-------|------------|-------|
| `9:16` | 1080x1920 | Vertical/Reels/TikTok/Shorts |
| `16:9` | 1920x1080 | Horizontal/YouTube/Desktop |
| `1:1` | 1080x1080 | Square/Instagram Feed |
| `4:5` | 1080x1350 | Instagram Portrait |

---

## 9. Motion Profiles

Controlled by AI decision engine.

| Profile | Speed | Animation Intensity | Best For |
|---------|-------|---------------------|----------|
| `subtle` | Slow | Minimal | Professional, corporate |
| `dynamic` | Medium | Balanced | General use |
| `energetic` | Fast | High | Sports, excitement |

---

## 10. Transitions

Suggested by AI between blocks.

| Transition | Description |
|------------|-------------|
| `fade` | Cross fade between blocks |
| `slide` | Slide transition |
| `zoom` | Zoom transition |
| `wipe` | Wipe effect |

---

## 11. Complete Example Payload

```json
{
  "videoMeta": {
    "aspectRatio": "9:16",
    "theme": "dark_modern",
    "fps": 30,
    "intro": {
      "title": "My Video",
      "subtitle": "Created with Video Generator",
      "duration": 2
    },
    "outro": {
      "title": "Thanks for Watching",
      "subtitle": "Subscribe for more",
      "duration": 2
    }
  },
  "contentBlocks": [
    {
      "type": "stat",
      "heading": "Total Users",
      "value": "1M+",
      "subtext": "Active users worldwide"
    },
    {
      "type": "motivational-image",
      "imageSrc": "https://example.com/hero.jpg",
      "imageEffect": "ken-burns",
      "imageEffectDuration": 2,
      "text": "Success Starts Here",
      "textStyle": "bold-glow",
      "fontSize": "xxlarge",
      "fontWeight": "black",
      "textColor": "#FFFFFF",
      "textAlign": "center",
      "textPosition": "center",
      "colorOverlay": {
        "enabled": true,
        "color": "#000000",
        "opacity": 0.5
      },
      "audioSrc": "https://example.com/background.mp3",
      "audioVolume": 0.6,
      "duration": 8
    },
    {
      "type": "whatsapp-chat",
      "person1": { "name": "You", "isOnline": true },
      "person2": { "name": "Support", "isOnline": true },
      "messages": [
        { "from": "person2", "text": "How can I help?" },
        { "from": "person1", "text": "I have a question about pricing" }
      ]
    },
    {
      "type": "quote",
      "text": "The best time to start was yesterday. The next best time is now.",
      "author": "Unknown"
    },
    {
      "type": "testimonial",
      "quote": "This changed my life completely!",
      "author": "Jane Smith",
      "role": "Entrepreneur",
      "company": "Startup Inc"
    }
  ]
}
```

---

## 12. Limits & Constraints

| Item | Min | Max | Notes |
|------|-----|-----|-------|
| Content Blocks | 1 | 20 | Per video |
| Text Length (general) | 1 | 500 | Varies by block |
| Quote Text | 1 | 300 | |
| Testimonial Quote | 1 | 400 | |
| Code Block | 1 | 2000 | Characters |
| List Items | 1 | 10 | |
| Timeline Events | 2 | 8 | |
| Comparison Items | 2 | 6 | |
| Icon List Items | 1 | 6 | |
| Pie Chart Segments | 2 | 8 | |
| Line Chart Data Points | 2 | 24 | |
| WhatsApp Messages | 1 | 50 | |
| Duration (general) | 1 | 60 | Seconds |
| Motivational Duration | 1 | 120 | Seconds |
| FPS | 24 | 60 | |

---

*Last Updated: Video Generator v1.0*
