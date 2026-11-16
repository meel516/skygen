import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import { PLUGIN_PREVIEW_FORMATS, fitPluginPreview } from '../src/lib/plugins/preview-format';

// Exercise export orchestration without running a GPU encoder in unit tests.
let states: unknown[];
let cleanups: Array<() => void>;
mock.module('react', () => ({
  useCallback: (fn: unknown) => fn,
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: (effect: () => (() => void)) => { cleanups.push(effect()); },
  useState: (initial: unknown) => {
    const index = states.length;
    states.push(initial);
    return [initial, (next: unknown) => { states[index] = next; }];
  },
}));
const render = mock(async (_options: any): Promise<any> => ({ getBlob: async () => new Blob(['encoded video']) }));
const checkSupport = mock(async (_options: any): Promise<any> => ({ canRender: true, issues: [] }));
mock.module('@remotion/web-renderer', () => ({ renderMediaOnWeb: render, canRenderMediaOnWeb: checkSupport }));
const { useClientRender } = await import('../src/hooks/useClientRender');
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalCreateUrl = URL.createObjectURL;
const originalRevokeUrl = URL.revokeObjectURL;
let anchor: any;
let timeouts: Array<() => void>;
beforeEach(() => {
  states = [];
  cleanups = [];
  timeouts = [];
  anchor = { click: mock(() => {}), remove: mock(() => {}) };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    VideoEncoder: class {}, addEventListener: () => {}, setTimeout: (fn: () => void) => timeouts.push(fn),
  } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => anchor, body: { appendChild: () => {} },
  } });
  URL.createObjectURL = mock(() => 'blob:encoded-video');
  URL.revokeObjectURL = mock(() => {});
  render.mockClear();
  render.mockImplementation(async () => ({ getBlob: async () => new Blob(['encoded video']) }));
  checkSupport.mockClear();
  checkSupport.mockImplementation(async () => ({ canRender: true, issues: [] }));
});
afterAll(() => {
  if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else delete (globalThis as any).window;
  if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else delete (globalThis as any).document;
  URL.createObjectURL = originalCreateUrl;
  URL.revokeObjectURL = originalRevokeUrl;
});

const Scene = () => null;
const props = { data: { title: 'Edited title', color: '#0000ff' }, animation: { enter: 1, hold: 5, exit: 1 } };
const params = { component: Scene, inputProps: props, durationInFrames: 210, fps: 30, width: 1920, height: 1080 };

test('all three formats export the selected composition and visible draft props', async () => {
  for (const [format, size] of Object.entries(PLUGIN_PREVIEW_FORMATS)) {
    const hook = useClientRender();
    await hook.startRender({ ...params, ...size, filename: `draft-${format.replace(':', 'x')}.webm` });
    const options = render.mock.calls.at(-1)![0];
    expect(options.composition).toMatchObject({ ...size, component: Scene, durationInFrames: 210, fps: 30 });
    expect(options.inputProps).toEqual(props);
    expect(anchor.download).toBe(`draft-${format.replace(':', 'x')}.webm`);
  }
  expect(anchor.click).toHaveBeenCalledTimes(3);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  timeouts.forEach((fn) => fn());
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
});

test('portrait, landscape and square previews fit both bounds without stretching', () => {
  for (const format of Object.keys(PLUGIN_PREVIEW_FORMATS) as Array<keyof typeof PLUGIN_PREVIEW_FORMATS>) {
    const fit = fitPluginPreview(300, 250, format);
    const original = PLUGIN_PREVIEW_FORMATS[format];
    expect(fit.width).toBeLessThanOrEqual(300 + 1e-6);
    expect(fit.height).toBeLessThanOrEqual(250 + 1e-6);
    expect(fit.width / fit.height).toBeCloseTo(original.width / original.height);
  }
});

test('editor exports retain their default filename', async () => {
  await useClientRender().startRender(params);
  expect(anchor.download).toBe('video.webm');
});

test('unsupported codecs do not attempt rendering or claim a download', async () => {
  checkSupport.mockImplementation(async () => ({ canRender: false, issues: [{ message: 'Codec unavailable' }] }));
  await useClientRender().startRender(params);
  expect(render).not.toHaveBeenCalled();
  expect(anchor.click).not.toHaveBeenCalled();
  expect(states[0]).toBe('error');
});

test('a failed muxer or empty blob never reports success', async () => {
  render.mockImplementation(async () => { throw new Error('Cannot write to a closing writable stream'); });
  await useClientRender().startRender(params);
  expect(states[0]).toBe('error');
  expect(anchor.click).not.toHaveBeenCalled();
  states = [];
  render.mockImplementation(async () => ({ getBlob: async () => new Blob([]) }));
  await useClientRender().startRender(params);
  expect(states[0]).toBe('error');
  expect(anchor.click).not.toHaveBeenCalled();
});

test('cancel stops encoding and duplicate exports are ignored', async () => {
  let notifyStarted!: () => void;
  const started = new Promise<void>((resolve) => { notifyStarted = resolve; });
  render.mockImplementation((options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
    notifyStarted();
  }));
  const hook = useClientRender();
  const exporting = hook.startRender(params);
  await started;
  await hook.startRender(params);
  expect(render).toHaveBeenCalledTimes(1);
  hook.cancel();
  await exporting;
  expect(states[0]).toBe('idle');
  expect(anchor.click).not.toHaveBeenCalled();
});
