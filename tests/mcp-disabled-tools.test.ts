import { expect, mock, test } from 'bun:test';

mock.module('@/lib/mcp/wizard-jobs', () => ({ createJob: async () => { throw new Error('Unexpected job write'); } }));
const { TOOL_DEFINITIONS, handleToolCall } = await import('../src/lib/mcp/tools');
const disabled = ["list_arcs","list_visual_styles","list_templates","get_template","delete_template","list_voices","start_video_generation","regenerate_image","regenerate_audio","get_video_preview","list_content_blocks","get_generation_state",'create_template', 'update_template', 'approve_story', 'approve_images', 'approve_audio', 'update_block_image', 'update_block_audio', 'assemble_video', 'patch_generation_state'];

test('disabled public tools are neither advertised nor executable', async () => {
  const apiFetch = mock(async () => { throw new Error('Unexpected API call'); });
  for (const name of disabled) {
    expect(TOOL_DEFINITIONS.some(tool => tool.name === name)).toBe(false);
    await expect(handleToolCall(name, {}, apiFetch, 'test-user')).rejects.toThrow(`Unknown tool: ${name}`);
    expect(TOOL_DEFINITIONS.some(tool => tool.description.includes(name))).toBe(false);
  }
  expect(apiFetch).not.toHaveBeenCalled();
  expect(TOOL_DEFINITIONS.some(tool => tool.name === 'propose_plugin_preview')).toBe(true);
  expect(TOOL_DEFINITIONS.some(tool => tool.name === 'approve_plugin_preview')).toBe(true);
});
