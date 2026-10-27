import { requireAuthenticatedSession } from '@/lib/api-security';
import { TOOL_DEFINITIONS, handleToolCall } from '@/lib/mcp/tools';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const maxDuration = 300;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version',
};

function jsonRpc(result: unknown, id: unknown) {
  return Response.json({ jsonrpc: '2.0', result, id }, { headers: CORS_HEADERS });
}

function jsonRpcError(code: number, message: string, id: unknown) {
  return Response.json(
    { jsonrpc: '2.0', error: { code, message }, id },
    { status: 200, headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return new Response('SSE not supported, please use POST for stateless MCP', { 
    status: 405, 
    headers: CORS_HEADERS 
  });
}

export async function POST(request: Request) {

  // Build apiFetch scoped to this request's auth + origin
  const incomingAuth = request.headers.get('authorization') ?? '';
  const origin       = new URL(request.url).origin;

  const apiFetch = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${origin}${path}`, {
      ...init,
      headers: {
        'Authorization': incomingAuth,
        'Content-Type':  'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      const body = contentType.includes('application/json')
        ? await res.json().catch(() => null)
        : await res.text().catch(() => res.statusText);
      const detail = typeof body === 'string'
        ? body
        : JSON.stringify(body ?? { error: res.statusText }, null, 2);
      throw new McpError(ErrorCode.InternalError, `API error ${res.status}: ${detail}`);
    }
    return res.json();
  };

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(-32700, 'Parse error', null);
  }

  const { jsonrpc, method, params, id } = body;

  if (jsonrpc !== '2.0') {
    return jsonRpcError(-32600, 'Invalid Request', id ?? null);
  }

  // Handle MCP protocol methods
  switch (method) {

    case 'initialize':
      return jsonRpc({
        protocolVersion: params?.protocolVersion ?? '2024-11-05',
        capabilities:    { tools: {}, resources: {} },
        serverInfo:      { name: 'videogen', version: '1.0.0' },
      }, id);

    case 'notifications/initialized':
      return new Response(null, { status: 202, headers: CORS_HEADERS });

    case 'ping':
      return jsonRpc({}, id);

    case 'tools/list': {
      const annotationsMap: Record<string, any> = {
        get_remotion_cinematic_patterns: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        list_arcs: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        list_visual_styles: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        list_templates: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        get_template: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        create_template: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
        update_template: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
        delete_template: { readOnlyHint: false, openWorldHint: false, destructiveHint: true },
        list_voices: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        list_plugins: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        get_plugin: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        start_video_generation: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
        get_generation_status: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        approve_story: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
        regenerate_image: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
        approve_images: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
        regenerate_audio: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
        approve_audio: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
        get_video_preview: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        list_content_blocks: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        list_plugin_base_bundle: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        pack_plugin_dir: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        import_media_from_url: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
        request_media_upload: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
        propose_plugin_preview: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
        approve_plugin_preview: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
        delete_plugin: { readOnlyHint: false, openWorldHint: false, destructiveHint: true },
        get_generation_state: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        update_block_image: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
        update_block_audio: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
        assemble_video: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
        patch_generation_state: { readOnlyHint: false, openWorldHint: false, destructiveHint: false }
      };

      return jsonRpc({ 
        tools: TOOL_DEFINITIONS.map(t => ({
          ...t,
          annotations: annotationsMap[t.name] || { readOnlyHint: false, openWorldHint: false, destructiveHint: false }
        })) 
      }, id);
    }

    case 'resources/list':
      return jsonRpc({
        resources: [
          {
            uri: 'ui://skygen/upload-v4.html',
            name: 'Media Upload UI',
            mimeType: 'text/html;profile=mcp-app'
          },
          {
            uri: 'ui://skygen/preview-v6.html',
            name: 'Plugin Preview UI',
            mimeType: 'text/html;profile=mcp-app'
          }
        ]
      }, id);
      
    case 'resources/read': {

      if (['ui://skygen/upload-v3.html', 'ui://skygen/upload-v4.html'].includes(params?.uri)) {
          const html = `<!DOCTYPE html>
<html>
<head>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: transparent; color: #E2E2F0; }
  .drop-zone {
    border: 2px dashed rgba(167, 139, 250, 0.4);
    border-radius: 16px;
    padding: 40px 32px;
    text-align: center;
    background: linear-gradient(145deg, rgba(15, 23, 42, 0.7), rgba(30, 27, 75, 0.4));
    backdrop-filter: blur(8px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 240px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }
  .drop-zone:hover {
    border-color: rgba(167, 139, 250, 0.8);
    background: linear-gradient(145deg, rgba(30, 27, 75, 0.6), rgba(15, 23, 42, 0.8));
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(139, 92, 246, 0.15);
  }
  .drop-zone.dragover {
    border-color: #A78BFA;
    background: rgba(139, 92, 246, 0.15);
    transform: scale(1.02);
  }
  .hidden { display: none !important; }
  
  /* SkyGen Logo gradient */
  .text-gradient {
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-image: linear-gradient(to right, #818CF8, #C084FC, #F472B6);
  }
</style>
</head>
<body>
  <div class="p-4 w-full h-screen flex flex-col justify-center max-w-md mx-auto">
    <!-- SkyGen Branding -->
    <div class="flex items-center justify-center mb-8 gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      </div>
      <h1 class="text-3xl font-bold tracking-tight text-gradient">SkyGen</h1>
    </div>

    <div id="dropZone" class="drop-zone">
      <div class="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mb-5 border border-slate-700 shadow-inner">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </div>
      <h3 class="text-xl font-semibold mb-2 text-slate-100">Upload Media Files</h3>
      <p class="text-sm text-slate-400 font-medium">Drag & drop or click to browse</p>
      <p class="text-xs text-slate-500 mt-2">Images, Audio, and Video supported</p>
      <input type="file" id="fileInput" class="hidden" accept="image/*,video/*,audio/*" multiple />
    </div>
    
    <div id="loading" class="hidden flex-col items-center justify-center p-10 bg-slate-900/80 rounded-2xl border border-slate-700/50 backdrop-blur-xl shadow-2xl">
      <div class="relative w-16 h-16 mb-6">
        <div class="absolute inset-0 rounded-full border-4 border-slate-800"></div>
        <div class="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
      </div>
      <h3 class="text-lg font-semibold text-white mb-1">Uploading...</h3>
      <p id="loadingText" class="text-sm font-medium text-slate-400 text-center">Processing your files</p>
    </div>
    
    <div id="success" class="hidden flex-col items-center justify-center p-10 bg-emerald-950/40 rounded-2xl border border-emerald-500/30 backdrop-blur-xl shadow-2xl">
      <div class="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-5 border border-emerald-500/30">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-emerald-400 mb-1">Upload Complete</h3>
      <p class="text-sm text-slate-400 text-center">Returning URLs to chat...</p>
    </div>

    <div id="error" class="hidden flex-col items-center justify-center p-10 bg-rose-950/40 rounded-2xl border border-rose-500/30 backdrop-blur-xl shadow-2xl">
      <div class="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mb-5 border border-rose-500/30">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-rose-400 mb-1">Upload Failed</h3>
      <p id="errorText" class="text-sm font-medium text-slate-400 text-center">Something went wrong</p>
      <button id="retryBtn" class="mt-6 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm rounded-xl transition-colors shadow-lg shadow-rose-900/20">Try Again</button>
    </div>
  </div>

<script type="module">
  try {
  const { App } = await import('https://skygen.salru.in/vendor/mcp-apps-2.0.3/app.js');
  const app = new App({ name: 'skygen-upload', version: '1.0.0' }, {});
  
  let uploadId = null;

  app.ontoolresult = (params) => {
    if (params.structuredContent && params.structuredContent.uploadId) {
      uploadId = params.structuredContent.uploadId;
    } else {
      showError('No upload session provided');
    }
  };

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const loading = document.getElementById('loading');
  const success = document.getElementById('success');
  const errorDiv = document.getElementById('error');
  const errorText = document.getElementById('errorText');
  const loadingText = document.getElementById('loadingText');
  
  document.getElementById('retryBtn').addEventListener('click', () => {
    errorDiv.classList.add('hidden');
    dropZone.classList.remove('hidden');
  });
  
  dropZone.addEventListener('click', () => fileInput.click());
  
  function preventDefaults (e) { e.preventDefault(); e.stopPropagation(); }
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
  });
  
  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files.length) handleFiles(dt.files);
  });
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFiles(e.target.files);
  });

  async function handleFiles(files) {
    if (!uploadId) {
      showError('No upload session ID provided.');
      return;
    }

    dropZone.classList.add('hidden');
    loading.classList.remove('hidden');
    
    const fileArray = Array.from(files);
    const total = fileArray.length;
    loadingText.textContent = \`Uploading \${total} file\${total > 1 ? 's' : ''}...\`;
    
    try {
      const uploadPromises = fileArray.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadId', uploadId);

        const res = await fetch('https://skygen.salru.in/api/mcp/upload-media', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          let errStr = res.statusText;
          try {
            const json = await res.json();
            if (json.error) errStr = json.error;
          } catch(e){}
          throw new Error(errStr);
        }
        
        const data = await res.json();
        return { name: file.name, url: data.url };
      });

      const results = await Promise.all(uploadPromises);
      
      loading.classList.add('hidden');
      success.classList.remove('hidden');
      
      const messageText = \`Upload complete. Here are the files:\\n\` + results.map(r => \`- \${r.name}: \${r.url}\`).join('\\n');
      
      setTimeout(() => {
        app.sendMessage({ 
          role: "user", 
          content: [{ type: "text", text: messageText }] 
        }).catch(err => showError('Failed to send result: ' + err.message));
      }, 1000);
      
    } catch (err) {
      loading.classList.add('hidden');
      showError(err.message || 'Upload failed');
    }
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorDiv.classList.remove('hidden');
    dropZone.classList.add('hidden');
  }

  app.connect().catch(err => showError('Connect error: ' + err.message));
  } catch (err) {
    document.body.textContent = 'SkyGen could not start the upload widget: ' + err.message + '. Please reopen the widget.';
  }
</script>
</body>
</html>`;

        return jsonRpc({
          contents: [
            {
              uri: params.uri,
              mimeType: 'text/html;profile=mcp-app',
              text: html,
              _meta: { ui: { csp: { resourceDomains: ['https://esm.sh', 'https://skygen.salru.in', 'https://cdn.tailwindcss.com'],
                  connectDomains: ['https://skygen.salru.in'],
                  frameDomains: ['https://skygen.salru.in'] } } }
            }
          ]
        }, id);
      }

      if (['ui://skygen/preview-v4.html', 'ui://skygen/preview-v5.html', 'ui://skygen/preview-v6.html'].includes(params?.uri)) {
        const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    html { margin: 0; padding: 0; width: 100%; }
    body { margin: 0; padding: 0; overflow: hidden; background: #0A0A0F; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 640px; }
    iframe { display: block; width: 100%; height: 100%; border: none; }
    @media (max-width: 480px) { body { height: 560px; } }
    #loader { padding: 20px; color: #A78BFA; }
  </style>
</head>
<body>
  <div id="loader" role="status">Starting SkyGen preview...</div>
  <iframe id="frame" style="display:none;" allow="autoplay; fullscreen"></iframe>
  
  <script type="module">
    const loader = document.getElementById('loader');
    const startupTimer = setTimeout(() => {
      loader.innerText = 'SkyGen is taking too long to connect. Please reopen the preview.';
    }, 15000);
    try {
    const { App } = await import('https://skygen.salru.in/vendor/mcp-apps-2.0.3/app.js');
    
    const app = new App({ name: 'skygen-preview', version: '1.0.0' }, {}, { autoResize: true });
    
    app.ontoolresult = (params) => {
      clearTimeout(startupTimer);
      let url = null;
      
      // Try structuredContent first
      if (params.structuredContent && params.structuredContent.previewUrl) {
        url = params.structuredContent.previewUrl;
      } 
      // Fallback to json parsing of text block
      else if (params.content) {
        for (const block of params.content) {
          if (block.type === 'text' && block.text) {
            try {
              const data = JSON.parse(block.text);
              if (data.preview_url) {
                url = data.preview_url;
              }
            } catch (e) {
              // Ignore
            }
          }
        }
      }
      
      try {
        if (!url) throw new Error('No preview URL found in response');
        
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:') {
          throw new Error('URL must use HTTPS protocol');
        }
        if (parsedUrl.host !== 'skygen.salru.in') {
          throw new Error('URL must be from skygen.salru.in');
        }
        if (!parsedUrl.pathname.startsWith('/chat') && !parsedUrl.pathname.startsWith('/preview/plugin/')) {
          throw new Error('URL path must be /chat or /preview/plugin/...');
        }
        
        parsedUrl.searchParams.set('embed', '1');
        
        document.getElementById('loader').style.display = 'none';
        const frame = document.getElementById('frame');
        frame.src = parsedUrl.toString();
        frame.style.display = 'block';
      } catch (err) {
        document.getElementById('loader').innerText = 'Error: ' + err.message;
      }
    };
    
    app.connect().catch(err => {
      clearTimeout(startupTimer);
      document.getElementById('loader').innerText = 'Error connecting to host: ' + err.message;
    });
    } catch (err) {
      clearTimeout(startupTimer);
      loader.innerText = 'SkyGen could not start the preview: ' + err.message + '. Please reopen the preview.';
    }
  </script>
</body>
</html>`;

        return jsonRpc({
          contents: [
            {
              uri: params.uri,
              mimeType: 'text/html;profile=mcp-app',
              text: html,
              _meta: {
                ui: {
                  csp: {
                    resourceDomains: ["https://esm.sh", "https://skygen.salru.in"],
                    connectDomains: ["https://skygen.salru.in"],
                    frameDomains: ["https://skygen.salru.in"]
                  }
                }
              }
            }
          ]
        }, id);
      }
      return jsonRpcError(-32602, 'Unknown resource', id);
    }

    case 'tools/call': {
      // Auth is required ONLY for calling tools
      const authResult = await requireAuthenticatedSession();
      if ('response' in authResult) {
        return jsonRpcError(-32000, 'Unauthorized - Authentication required', id);
      }
      const toolName = params?.name as string | undefined;
      const toolArgs = params?.arguments ?? {};

      if (!toolName) {
        return jsonRpcError(-32602, 'Missing tool name', id);
      }

      try {
        const result = await handleToolCall(toolName, toolArgs, apiFetch, authResult.session.user.id);
        return jsonRpc(result, id);
      } catch (err: any) {
        if (err instanceof McpError) {
          return jsonRpcError(err.code, err.message, id);
        }
        return jsonRpcError(-32603, err?.message ?? 'Internal error', id);
      }
    }

    default:
      return jsonRpcError(-32601, `Method not found: ${method}`, id);
  }
}
