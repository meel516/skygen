import { NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// OpenAPI spec with hardcoded production server URL
const OPENAPI_YAML = `openapi: 3.0.3
info:
  title: SkyGen Video Plugin Studio
  description: API for creating, previewing, and approving Remotion video plugins and compositions on SkyGen.
  version: 1.0.0
servers:
  - url: https://skygen.salru.in
    description: Production SkyGen Server

paths:
  /api/mcp/plugins/propose-preview:
    post:
      operationId: proposePluginPreview
      summary: Propose or update a video plugin to generate an interactive live preview
      description: |
        Takes Remotion React component code (Scene.tsx) and returns an interactive live preview URL.
        Whenever the user asks to create or modify a plugin, generate the Remotion React scene code
        and call this endpoint. Then, display the returned URL as a clickable Markdown link to the user.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - name
                - scene_code
              properties:
                threadId:
                  type: string
                  description: Optional thread or session ID. Pass the previous threadId when updating an existing preview.
                name:
                  type: string
                  description: Human-readable display name of the plugin (e.g., 'Neon Glow Title Card').
                description:
                  type: string
                  description: Brief description of what the plugin animates.
                category:
                  type: string
                  description: Category such as 'typography', 'background', 'intro', or 'social'.
                  default: custom
                scene_code:
                  type: string
                  description: |
                    The complete TypeScript/React code for Scene.tsx using Remotion.
                    Must export a default or named React functional component.
                schema_json:
                  type: string
                  description: JSON string describing editable input props schema.
                  default: "{}"
      responses:
        '200':
          description: Plugin preview successfully staged
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  threadId:
                    type: string
                    description: Unique ID representing this preview session.
                  url:
                    type: string
                    description: Clickable web URL where the user can view and play the live Remotion animation.
        '401':
          description: Unauthorized - Invalid or missing Bearer token
        '500':
          description: Compilation or server error

  /api/mcp/plugins/approve-preview:
    post:
      operationId: approvePluginPreview
      summary: Approve the staged plugin and compile it into SkyGen
      description: |
        Called when the user is satisfied with the preview and approves it.
        Takes the threadId and officially bundles the plugin for production video rendering.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - threadId
              properties:
                threadId:
                  type: string
                  description: The threadId returned from proposePluginPreview.
      responses:
        '200':
          description: Plugin successfully approved and saved
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  pluginId:
                    type: string
                  name:
                    type: string
                  message:
                    type: string
        '400':
          description: No pending plugin found in thread
        '401':
          description: Unauthorized

  /api/mcp/jobs/{threadId}:
    get:
      operationId: getJobStatus
      summary: Check preview or build status
      description: Returns the current execution status and state of the preview job.
      security:
        - bearerAuth: []
      parameters:
        - name: threadId
          in: path
          required: true
          description: The threadId of the job
          schema:
            type: string
      responses:
        '200':
          description: Job status details
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    description: e.g. 'idle', 'running', 'completed', 'failed'
                  state:
                    type: object

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
`;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return new NextResponse(OPENAPI_YAML, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/yaml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
