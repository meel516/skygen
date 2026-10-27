import type { NormalizedMediaField } from './utils';

// ============================================================================
// RESPONSE FORMAT TEMPLATES
// ============================================================================

export const RESPONSE_FORMAT_TEMPLATES: Record<string, string> = {
  'tower-chart-3d': `{
  "title": "string",
  "subtitle": "string | null",
  "items": [
    {
      "rank": 1,
      "name": "string",
      "value": 0,
      "valueFormatted": "string | null",
      "subtitle": "string | null",
      "image": "string | null"
    }
  ]
}`,
  'stat': `{
  "heading": "string",
  "value": "string",
  "subtext": "string"
}`,
  'text': `{
  "content": "string"
}`,
  'quote': `{
  "text": "string",
  "author": "string"
}`,
  'image': `{
  "src": "string",
  "alt": "string",
  "caption": "string"
}`,
  'motivational-image': `{
  "imageSrc": "string",
  "text": "string",
  "audioSrc": "string"
}`,
  'testimonial': `{
  "quote": "string",
  "author": "string",
  "role": "string",
  "company": "string"
}`,
  'list': `{
  "title": "string",
  "items": ["string"]
}`,
  'top-players': `{
  "title": "string",
  "subtitle": "string",
  "backgroundImage": "vivid wide-scene description",
  "audioSrc": "narration text for the whole block",
  "players": [
    { "rank": 1, "name": "string", "subtitle": "position • key stat (e.g. 'India • 15,921 runs')", "image": "vivid portrait description" },
    { "rank": 2, "name": "string", "subtitle": "position • key stat", "image": "vivid portrait description" },
    { "rank": 3, "name": "string", "subtitle": "position • key stat", "image": "vivid portrait description" },
    { "rank": 4, "name": "string", "subtitle": "position • key stat", "image": "vivid portrait description" },
    { "rank": 5, "name": "string", "subtitle": "position • key stat", "image": "vivid portrait description" }
  ]
}`,
  'timeline': `{
  "title": "string",
  "events": [
    { "year": "string", "title": "string", "description": "string" }
  ]
}`,
  'callout': `{
  "title": "string",
  "content": "string",
  "variant": "info"
}`,
  'parallax-story': `{
  "title": "string",
  "subtitle": "string",
  "text": "string",
  "audioSrc": "string",
  "layers": [
    {
      "name": "background",
      "image": "vivid wide-scene description",
      "depth": 90,
      "parallaxFactor": 0.3,
      "motionDirection": "right",
      "removeBackground": false
    },
    {
      "name": "midground",
      "image": "vivid description of mid-depth element",
      "depth": 50,
      "parallaxFactor": 0.7,
      "motionDirection": "left",
      "removeBackground": true
    },
    {
      "name": "subject",
      "image": "vivid description of the main foreground subject",
      "depth": 15,
      "parallaxFactor": 1.2,
      "motionDirection": "zoom-in",
      "removeBackground": true
    }
  ]
}`,
  'video': `{
  "src": "",
  "caption": "string",
  "text": "string - narration displayed as subtitle overlay",
  "audioSrc": "string - MUST be identical to text"
}`,
  html: `{
  "htmlContent": "string - complete HTML document with inline <style> and <script>",
  "title": "string",
  "audioSrc": "string - REQUIRED narration text to be spoken aloud via TTS"
}`,
  diagram: `{
  "diagramType": "flowchart | hierarchy | sequence | mindmap | network",
  "title": "string",
  "nodes": [
    { "id": "string", "label": "string", "type": "default|decision|start|end|process", "color": "hex" }
  ],
  "edges": [
    { "from": "string", "to": "string", "label": "string", "style": "arrow|solid|dashed" }
  ],
  "layout": "vertical | horizontal | radial",
  "primaryColor": "hex",
  "audioSrc": "string - REQUIRED narration text to be spoken aloud via TTS"
}`,
};

export function getResponseFormatTemplate(blockType: string): string {
  return RESPONSE_FORMAT_TEMPLATES[blockType] || '';
}

// ============================================================================
// BLOCK SCHEMAS — field definitions per block type
// ============================================================================

export const BLOCK_SCHEMAS: Record<string, {
  textFields:  string;
  imageFields: string;
  audioFields: string;
  example:     string;
  contentFields: string[];
  /** Normalized media fields for deterministic field detection. Template paths use [] for arrays. */
  normalizedFields?: NormalizedMediaField[];
}> = {
  stat: {
    contentFields: ['heading', 'value', 'subtext', 'audioSrc'],
    textFields:  'heading (string - label), value (string - the metric), subtext (string - context)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the stat aloud)',
    example:     '{"heading":"Test Centuries","value":"27","subtext":"Most by an Indian batter","audioSrc":"Virat Kohli has scored 27 centuries in Test cricket, the most by any Indian batter."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  text: {
    contentFields: ['content', 'audioSrc'],
    textFields:  'content (string - full paragraph)',
    imageFields: '',
    audioFields: 'audioSrc (string - content read aloud)',
    example:     '{"content":"Virat Kohli is widely regarded as one of the greatest batsmen of all time.","audioSrc":"Virat Kohli is widely regarded as one of the greatest batsmen of all time."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  quote: {
    contentFields: ['text', 'author', 'audioSrc'],
    textFields:  'text (string - the quote), author (string)',
    imageFields: '',
    audioFields: 'audioSrc (string - read quote with attribution aloud)',
    example:     '{"text":"Self-belief and hard work will always earn you success.","author":"Virat Kohli","audioSrc":"Virat Kohli once said: Self-belief and hard work will always earn you success."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  image: {
    contentFields: ['src', 'alt', 'caption', 'audioSrc'],
    textFields:  'alt (string), caption (string)',
    imageFields: 'src (string - vivid visual description of the image)',
    audioFields: 'audioSrc (string - narrate what is shown)',
    example:     '{"src":"Virat Kohli raising bat in celebration at packed Wankhede Stadium","alt":"Kohli century celebration","caption":"100th international century","audioSrc":"Virat Kohli celebrates yet another century, raising his bat to the roaring crowd."}',
    normalizedFields: [
      { path: 'src', type: 'image', description: 'vivid visual description of the image', removeBackground: false },
      { path: 'audioSrc', type: 'audio', description: '' },
    ],
  },
  'motivational-image': {
    contentFields: ['imageSrc', 'text', 'audioSrc'],
    textFields:  `text: REQUIRED string — the narration script spoken aloud AND displayed as subtitles (2-4 sentences, natural spoken language)
imageSrc: REQUIRED string (vivid visual description of background image)`,
    imageFields: 'imageSrc (string - vivid visual scene description)',
    audioFields: 'audioSrc: REQUIRED string — MUST be identical to the "text" field so subtitles match the audio exactly',
    example:     '{"imageSrc":"Athlete sprinting on track at golden hour, dramatic side lighting","text":"Champions are not born. They are forged in the moments when they want to quit but keep going.","audioSrc":"Champions are not born. They are forged in the moments when they want to quit but keep going."}',
    normalizedFields: [
      { path: 'imageSrc', type: 'image', description: 'vivid visual scene description', removeBackground: false },
      { path: 'audioSrc', type: 'audio', description: '' },
    ],
  },
  testimonial: {
    contentFields: ['quote', 'author', 'role', 'company', 'avatar', 'audioSrc'],
    textFields:  `quote: REQUIRED string\nauthor: REQUIRED string\nrole: optional string\ncompany: optional string`,
    imageFields: 'avatar: optional string — describe person appearance',
    audioFields: 'audioSrc: optional string — read testimonial aloud',
    example:     '{"quote":"Changed the game.","author":"John Smith","role":"Coach","avatar":"Professional in blazer"}',
    normalizedFields: [
      { path: 'avatar', type: 'image', description: 'describe person appearance', removeBackground: false },
      { path: 'audioSrc', type: 'audio', description: '' },
    ],
  },
  list: {
    contentFields: ['title', 'items', 'audioSrc'],
    textFields:  `title: REQUIRED string\nitems: REQUIRED array of strings (each item is a list bullet point)`,
    imageFields: '',
    audioFields: 'audioSrc: optional string — read list aloud',
    example:     '{"title":"Kohli Records","items":["50+ ODI centuries","Fastest to 10000 ODI runs"],"audioSrc":"Here are some of Virat Kohli\'s greatest records."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  timeline: {
    contentFields: ['title', 'events', 'audioSrc'],
    textFields:  `title: REQUIRED string\nevents: REQUIRED array of objects (chronological order), each with:\n  - year: REQUIRED string or number\n  - title: REQUIRED string\n  - description: optional string`,
    imageFields: '',
    audioFields: 'audioSrc: optional string — narrate timeline',
    example:     '{"title":"Kohli Journey","events":[{"year":"2008","title":"IPL Debut","description":"RCB"},{"year":"2011","title":"World Cup","description":"Winner"}]}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  callout: {
    contentFields: ['title', 'content', 'variant', 'audioSrc'],
    textFields:  `title: REQUIRED string\ncontent: REQUIRED string\nvariant: REQUIRED string (one of: info, warning, success, error)`,
    imageFields: '',
    audioFields: 'audioSrc: optional string — read callout aloud',
    example:     '{"title":"Did You Know?","content":"Only player to avg 50+ all formats","variant":"info"}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'icon-list': {
    contentFields: ['title', 'items', 'audioSrc'],
    textFields:  'title (string), items (array of {icon, title, description})',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the list)',
    example:     '{"title":"Why Kohli is GOAT","items":[{"icon":"🏏","title":"Run Machine","description":"50+ centuries across formats"},{"icon":"💪","title":"Fitness Icon","description":"Transformed Indian cricket culture"}],"audioSrc":"Here is why Virat Kohli is considered the GOAT."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  comparison: {
    contentFields: ['title', 'items', 'audioSrc'],
    textFields:  'title (string), items (array of {label, value, color})',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the comparison)',
    example:     '{"title":"Batting Averages","items":[{"label":"Kohli","value":57},{"label":"Root","value":50},{"label":"Smith","value":61}],"audioSrc":"Comparing batting averages of the top batsmen of this generation."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'line-chart': {
    contentFields: ['title', 'subtitle', 'data', 'labels', 'xAxisLabel', 'yAxisLabel', 'unit', 'showDataLabels', 'audioSrc'],
    textFields:  'title (string), subtitle (string — context for the chart), data (number[] — y-axis values), labels (string[] — x-axis labels, same length as data), xAxisLabel (string — x-axis title), yAxisLabel (string — y-axis title), unit (string — suffix like "$", "%", "K"), showDataLabels (boolean — show value at each point)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the trend)',
    example:     '{"title":"Revenue Growth","subtitle":"Quarterly performance 2024","data":[120,185,210,340],"labels":["Q1","Q2","Q3","Q4"],"xAxisLabel":"Quarter","yAxisLabel":"Revenue","unit":"K","showDataLabels":true,"audioSrc":"Revenue grew from 120K to 340K over four quarters."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'pie-chart': {
    contentFields: ['title', 'subtitle', 'segments', 'showPercentage', 'showLegend', 'audioSrc'],
    textFields:  'title (string), subtitle (string — context), segments (array of {label, value, color}), showPercentage (boolean, default true), showLegend (boolean, default true)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the distribution)',
    example:     '{"title":"Market Share","subtitle":"Global smartphone brands 2024","segments":[{"label":"Apple","value":28},{"label":"Samsung","value":20},{"label":"Xiaomi","value":13},{"label":"Others","value":39}],"audioSrc":"Apple leads with 28% market share."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'whatsapp-chat': {
    contentFields: ['person1', 'person2', 'messages', 'audioSrc'],
    textFields:  'person1 ({name}), person2 ({name}), messages (array of {from: person1|person2, text, time})',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the conversation context aloud)',
    example:     '{"person1":{"name":"Fan"},"person2":{"name":"Kohli Bot"},"messages":[{"from":"person1","text":"Kohli is the best ever!","time":"10:30"},{"from":"person2","text":"Thanks! Hard work always pays off 🏏","time":"10:31"}],"audioSrc":"A fan reaches out to Virat Kohli with a message of admiration."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  counter: {
    contentFields: ['label', 'from', 'to', 'prefix', 'suffix', 'audioSrc'],
    textFields:  'label (string), from (number), to (number), prefix (string), suffix (string)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the counter)',
    example:     '{"label":"ODI Centuries","from":0,"to":50,"suffix":"+","audioSrc":"Virat Kohli has scored over fifty centuries in One Day Internationals."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'progress-bar': {
    contentFields: ['label', 'value', 'audioSrc'],
    textFields:  'label (string), value (number 0-100)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the stat)',
    example:     '{"label":"Win Rate as Captain","value":58,"audioSrc":"Virat Kohli won 58 percent of his matches as Indian captain."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'social-stats': {
    contentFields: ['platform', 'username', 'followers', 'posts', 'likes', 'audioSrc'],
    textFields:  'platform (instagram|twitter|youtube|tiktok|linkedin|facebook), username (string), followers (number), posts (number), likes (number)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the social stats aloud)',
    example:     '{"platform":"instagram","username":"virat.kohli","followers":260000000,"posts":1200,"audioSrc":"Virat Kohli has over two hundred and sixty million followers on Instagram, making him one of the most followed athletes in the world."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  cta: {
    contentFields: ['text', 'description', 'audioSrc'],
    textFields:  'text (string - button label), description (string - supporting text)',
    imageFields: '',
    audioFields: 'audioSrc (string - read CTA aloud)',
    example:     '{"text":"Follow Kohli","description":"Join 260M fans following the king of cricket","audioSrc":"Follow Virat Kohli and join two hundred and sixty million fans following the king of cricket."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'gradient-text': {
    contentFields: ['text', 'gradient', 'audioSrc'],
    textFields:  'text (string - headline), gradient (array of 2-3 hex colors)',
    imageFields: '',
    audioFields: 'audioSrc (string - read text aloud)',
    example:     '{"text":"King Kohli","gradient":["#FF6B35","#F7C59F"],"audioSrc":"King Kohli."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'avatar-grid': {
    contentFields: ['title', 'subtitle', 'avatars', 'audioSrc'],
    textFields:  'title (string), subtitle (string), avatars (array of {name, role})',
    imageFields: 'avatars[N].image (describe each person visually)',
    audioFields: 'audioSrc (string - introduce the people shown)',
    example:     '{"title":"Kohli\'s Era","avatars":[{"name":"Virat Kohli","role":"Batsman","image":"Virat Kohli in Indian cricket whites smiling"},{"name":"MS Dhoni","role":"Wicketkeeper","image":"MS Dhoni in yellow CSK jersey"}],"audioSrc":"Meet the legends of Indian cricket\'s golden era."}',
    normalizedFields: [
      { path: 'avatars[].image', type: 'image', description: 'describe person visually', removeBackground: false },
      { path: 'audioSrc', type: 'audio', description: '' },
    ],
  },
  countdown: {
    contentFields: ['title', 'days', 'hours', 'minutes', 'seconds', 'audioSrc'],
    textFields:  'title (string), days (number), hours (number), minutes (number), seconds (number)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the countdown context)',
    example:     '{"title":"Next Kohli Test","days":5,"hours":12,"minutes":30,"seconds":0,"audioSrc":"Just five days until Virat Kohli takes the field again."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'animated-bg': {
    contentFields: ['style', 'primaryColor', 'secondaryColor', 'audioSrc'],
    textFields:  'style (particles|waves|gradient|noise|geometric|aurora), primaryColor (hex), secondaryColor (hex)',
    imageFields: '',
    audioFields: 'audioSrc (string - short atmospheric narration to accompany the visual)',
    example:     '{"style":"particles","primaryColor":"#1a73e8","secondaryColor":"#ff4500","audioSrc":"A legendary career, defined by fire and precision."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'parallax-story': {
    contentFields: ['title', 'subtitle', 'text', 'audioSrc', 'layers'],
    textFields:  `title (string), subtitle (string)\ntext: REQUIRED string — the narration script spoken aloud AND displayed as subtitles (2-4 sentences, natural spoken language). This MUST be identical to audioSrc so subtitles match the audio exactly.`,
    imageFields: `layers[N].image (describe each parallax layer visually).\nEach layer MUST have a "removeBackground" boolean. Rules:\n  • EXACTLY ONE layer must have "removeBackground": false — the single backdrop layer (wide scene, environment, landscape). This is the only layer that will use the normal image API.\n  • ALL other layers must have "removeBackground": true — characters, people, objects, elements floating over the background. These will be generated as transparent cut-outs using the background-removal API.\nYou decide which layer is the backdrop based on the story context.`,
    audioFields: 'audioSrc: REQUIRED string — MUST be identical to the "text" field so subtitles match the audio exactly',
    example:     '{"title":"The Kohli Era","subtitle":"A legacy like no other","layers":[{"name":"background","image":"Cricket stadium aerial view at golden hour, full wide scene","depth":90,"parallaxFactor":0.3,"motionDirection":"right","removeBackground":false},{"name":"midground","image":"Cheering crowd at cricket stadium","depth":50,"parallaxFactor":0.7,"motionDirection":"left","removeBackground":true},{"name":"subject","image":"Virat Kohli in batting stance dramatic lighting full body","depth":15,"parallaxFactor":1.2,"motionDirection":"zoom-in","removeBackground":true}],"text":"From a Delhi boy to a global icon. Virat Kohli\'s journey is a story of relentless determination.","audioSrc":"From a Delhi boy to a global icon. Virat Kohli\'s journey is a story of relentless determination."}',
    normalizedFields: [
      // removeBackground: undefined → data-driven per layer (read from layers[i].removeBackground at runtime)
      { path: 'layers[].image', type: 'image', description: 'vivid parallax layer visual description', removeBackground: undefined },
      { path: 'audioSrc', type: 'audio', description: '' },
    ],
  },
  'tower-chart-3d': {
    contentFields: ['title', 'subtitle', 'items'],
    textFields: 'title (string), subtitle (string), items (array of {rank, name, value, valueFormatted, subtitle, image})',
    imageFields: 'items[N].image (optional — describe visual for each item)',
    audioFields: '',
    example: '{"title":"Top Scorers","subtitle":"All-time leading run scorers","items":[{"rank":1,"name":"Sachin Tendulkar","value":15921,"valueFormatted":"15,921","subtitle":"Test Runs","image":"Sachin Tendulkar in Indian whites"}]}',
    normalizedFields: [
      { path: 'items[].image', type: 'image', description: 'visual for this item', removeBackground: false },
    ],
  },
  'top-players': {
    contentFields: ['title', 'subtitle', 'backgroundImage', 'audioSrc', 'players'],
    textFields: 'title (string), subtitle (string), backgroundImage (string — vivid visual description of the background scene), players[].rank (integer starting at 1), players[].name (string), players[].subtitle (position • key stat, e.g. "India • 15,921 runs")',
    imageFields: 'backgroundImage (vivid wide scene description), players[N].image (describe each player visually — will have background removed)',
    audioFields: 'audioSrc (narration text for the whole block)',
    example: '{"title":"Greatest Batsmen Ever","subtitle":"All-time Test run scorers","backgroundImage":"Cricket stadium at sunset, green pitch, packed stands","audioSrc":"Counting down the greatest batsmen of all time.","players":[{"rank":1,"name":"Sachin Tendulkar","subtitle":"India • 15,921 runs","image":"Sachin Tendulkar in Indian whites, bat raised, close-up portrait"},{"rank":2,"name":"Ricky Ponting","subtitle":"Australia • 13,378 runs","image":"Ricky Ponting in Australian whites, determined expression"},{"rank":3,"name":"Jacques Kallis","subtitle":"South Africa • 13,289 runs","image":"Jacques Kallis in South Africa green jersey, confident pose"},{"rank":4,"name":"Rahul Dravid","subtitle":"India • 13,288 runs","image":"Rahul Dravid in Indian whites, batting stance"},{"rank":5,"name":"Kumar Sangakkara","subtitle":"Sri Lanka • 12,400 runs","image":"Kumar Sangakkara in Sri Lanka blue jersey, gloves on"}]}',
    normalizedFields: [
      { path: 'backgroundImage', type: 'image', description: 'vivid wide scene background', removeBackground: false },
      { path: 'players[].image', type: 'image', description: 'vivid player portrait', removeBackground: true },
      { path: 'audioSrc', type: 'audio', description: '' },
    ],
  },
  video: {
    contentFields: ['src', 'caption', 'text', 'audioSrc'],
    textFields: 'caption (string), text (string — narration subtitle overlay)',
    imageFields: '',
    audioFields: 'audioSrc (string — MUST be identical to text)',
    example: '{"src":"Close-up of product dashboard on widescreen monitor, documents streaming into organized folders, clean dark UI with blue accent lights","caption":"Product Demo","text":"Watch how our product organizes your workflow effortlessly.","audioSrc":"Watch how our product organizes your workflow effortlessly."}',
    normalizedFields: [
      { path: 'src', type: 'video', description: 'cinematic scene description for video generation' },
      { path: 'audioSrc', type: 'audio', description: '' },
    ],
  },
  html: {
    contentFields: ['htmlContent', 'title', 'audioSrc'],
    textFields: 'title (string)',
    imageFields: '',
    audioFields: 'audioSrc (string — REQUIRED narration text to be spoken aloud via TTS)',
    example: '{"htmlContent":"<!DOCTYPE html><html>...</html>","title":"Feature Slide","audioSrc":"Introducing our most powerful feature yet."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  diagram: {
    contentFields: ['diagramType', 'title', 'nodes', 'edges', 'layout', 'primaryColor', 'audioSrc'],
    textFields: 'title (string), diagramType (flowchart|hierarchy|sequence|mindmap|network), layout (vertical|horizontal|radial)',
    imageFields: '',
    audioFields: 'audioSrc (string — REQUIRED narration text)',
    example: '{"diagramType":"flowchart","title":"User Journey","layout":"vertical","primaryColor":"#6366f1","nodes":[{"id":"n1","label":"Start","type":"start","color":"#6366f1"},{"id":"n2","label":"Process","type":"process","color":"#8b5cf6"}],"edges":[{"from":"n1","to":"n2","label":"","style":"arrow"}],"audioSrc":"Here is the user journey flow."}',
    normalizedFields: [{ path: 'audioSrc', type: 'audio', description: '' }],
  },
  'custom-plugin': {
    contentFields: [],
    textFields: '',
    imageFields: '',
    audioFields: '',
    example: '{}',
  },
};
