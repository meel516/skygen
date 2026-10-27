import path from 'path';
import fs from 'fs';
import os from 'os';
import { formatPluginSourceIssues, validatePluginSource } from './source-validation';
import { formatDependencyPolicyChanges, normalizePluginDependencies } from './dependency-policy';

// ============================================================================
// PREVIEW BUNDLER — single-source esbuild config for in-memory plugin previews.
//
// Used by:
//   - /api/plugins/preview-bundle (browser-loaded preview)
//   - compilePreview tool (agent's loop validator)
//
// Both must share the EXACT same esbuild config so what compiles in the agent
// loop is what loads in the browser. Drift here = false-positive compile passes.
// ============================================================================

// Named exports for host packages. These stay bridged so previews never bundle
// duplicate singleton runtimes such as React, Remotion, Three, or R3F.
const CORE_BRIDGE_PACKAGES: Record<string, [string, string[]]> = {
  'react': ['__pv_react', [
    'Children','Component','Fragment','Profiler','PureComponent','StrictMode',
    'Suspense','cloneElement','createContext','createElement','createFactory',
    'createRef','forwardRef','isValidElement','lazy','memo','startTransition',
    'use','useCallback','useContext','useDebugValue','useDeferredValue',
    'useEffect','useId','useImperativeHandle','useInsertionEffect','useLayoutEffect',
    'useMemo','useReducer','useRef','useState','useSyncExternalStore','useTransition',
    'version',
  ]],
  'react/jsx-runtime': ['__pv_react_jsx_runtime', [
    'Fragment','jsx','jsxs',
  ]],
  'react/jsx-dev-runtime': ['__pv_react_jsx_dev_runtime', [
    'Fragment','jsxDEV',
  ]],
  'react-dom': ['__pv_react_dom', [
    'createPortal','findDOMNode','flushSync','hydrate','render','unmountComponentAtNode',
    'unstable_batchedUpdates','version',
  ]],
  'react-dom/client': ['__pv_react_dom_client', [
    'createRoot','hydrateRoot',
  ]],
  'remotion': ['__pv_remotion', [
    'AbsoluteFill','Audio','Composition','cancelRender','continueRender','delayRender',
    'Easing','Freeze','getInputProps','getRemotionEnvironment','HtmlInCanvas','Img',
    'interpolate','interpolateColors','Loop','measureSpring','OffthreadVideo',
    'prefetch','random','registerRoot','Sequence','Series','spring',
    'staticFile','Still','useCurrentFrame','useCurrentScale','useVideoConfig',
    'Video','VideoTexture','watchStaticFile',
  ]],
  '@remotion/player': ['__pv_remotion_player', [
    'CallbackListener','Player','PlayerRef','RenderPoster','ThumbnailProps',
  ]],
  '@remotion/renderer': ['__pv_remotion_renderer', []],
  '@remotion/media-utils': ['__pv_remotion_media_utils', [
    'getVideoMetadata',
    'getAudioMetadata',
    'visualizeAudio',
    'useAudioData',
    'useWindowedAudioData',
    'getWaveformPortion',
  ]],
  '@remotion/sfx': ['__pv_remotion_sfx', [
    'Audio',
    'SFXProvider',
    'useSFX',
  ]],
  '@remotion/lottie': ['__pv_remotion_lottie', [
    'Lottie',
  ]],
  '@remotion/motion-blur': ['__pv_remotion_motion_blur', [
    'CameraMotionBlur',
    'HtmlInCanvasMotionBlur',
    'Trail',
  ]],
  '@remotion/transitions': ['__pv_remotion_transitions', [
    'TransitionSeries', 'linearTiming', 'springTiming', 
    'useTransitionProgress', 'makeHtmlInCanvasPresentation',
    'blurSlide', 'crossZoom', 'dreamyZoom', 'filmBurn', 'linearBlur', 'pushCut'
  ]],
  'three': ['__pv_three', [
    'ACESFilmicToneMapping', 'AddEquation', 'AddOperation',
    'AdditiveAnimationBlendMode', 'AdditiveBlending', 'AgXToneMapping',
    'AlphaFormat', 'AlwaysCompare', 'AlwaysDepth', 'AlwaysStencilFunc',
    'AmbientLight', 'AnimationAction', 'AnimationClip', 'AnimationLoader',
    'AnimationMixer', 'AnimationObjectGroup', 'AnimationUtils', 'ArcCurve',
    'ArrayCamera', 'ArrowHelper', 'AttachedBindMode', 'Audio', 'AudioAnalyser',
    'AudioContext', 'AudioListener', 'AudioLoader', 'AxesHelper', 'BackSide',
    'BasicDepthPacking', 'BasicShadowMap', 'BatchedMesh', 'BezierInterpolant',
    'Bone', 'BooleanKeyframeTrack', 'Box2', 'Box3', 'Box3Helper', 'BoxGeometry',
    'BoxHelper', 'BufferAttribute', 'BufferGeometry', 'BufferGeometryLoader',
    'ByteType', 'Cache', 'Camera', 'CameraHelper', 'CanvasTexture',
    'CapsuleGeometry', 'CatmullRomCurve3', 'CineonToneMapping', 'CircleGeometry',
    'ClampToEdgeWrapping', 'Clock', 'Color', 'ColorKeyframeTrack',
    'ColorManagement', 'Compatibility', 'CompressedArrayTexture',
    'CompressedCubeTexture', 'CompressedTexture', 'CompressedTextureLoader',
    'ConeGeometry', 'ConstantAlphaFactor', 'ConstantColorFactor', 'Controls',
    'CubeCamera', 'CubeDepthTexture', 'CubeReflectionMapping',
    'CubeRefractionMapping', 'CubeTexture', 'CubeTextureLoader',
    'CubeUVReflectionMapping', 'CubicBezierCurve', 'CubicBezierCurve3',
    'CubicInterpolant', 'CullFaceBack', 'CullFaceFront', 'CullFaceFrontBack',
    'CullFaceNone', 'Curve', 'CurvePath', 'CustomBlending', 'CustomToneMapping',
    'CylinderGeometry', 'Cylindrical', 'Data3DTexture', 'DataArrayTexture',
    'DataTexture', 'DataTextureLoader', 'DataUtils', 'DecrementStencilOp',
    'DecrementWrapStencilOp', 'DefaultLoadingManager', 'DepthFormat',
    'DepthStencilFormat', 'DepthTexture', 'DetachedBindMode', 'DirectionalLight',
    'DirectionalLightHelper', 'DiscreteInterpolant', 'DodecahedronGeometry',
    'DoubleSide', 'DstAlphaFactor', 'DstColorFactor', 'DynamicCopyUsage',
    'DynamicDrawUsage', 'DynamicReadUsage', 'EdgesGeometry', 'EllipseCurve',
    'EqualCompare', 'EqualDepth', 'EqualStencilFunc',
    'EquirectangularReflectionMapping', 'EquirectangularRefractionMapping',
    'Euler', 'EventDispatcher', 'ExternalTexture', 'ExtrudeGeometry',
    'FileLoader', 'Float16BufferAttribute', 'Float32BufferAttribute',
    'FloatType', 'Fog', 'FogExp2', 'FramebufferTexture', 'FrontSide', 'Frustum',
    'FrustumArray', 'GLBufferAttribute', 'GLSL1', 'GLSL3', 'GreaterCompare',
    'GreaterDepth', 'GreaterEqualCompare', 'GreaterEqualDepth',
    'GreaterEqualStencilFunc', 'GreaterStencilFunc', 'GridHelper', 'Group',
    'HalfFloatType', 'HemisphereLight', 'HemisphereLightHelper',
    'IcosahedronGeometry', 'ImageBitmapLoader', 'ImageLoader', 'ImageUtils',
    'IncrementStencilOp', 'IncrementWrapStencilOp', 'InstancedBufferAttribute',
    'InstancedBufferGeometry', 'InstancedInterleavedBuffer', 'InstancedMesh',
    'Int16BufferAttribute', 'Int32BufferAttribute', 'Int8BufferAttribute',
    'IntType', 'InterleavedBuffer', 'InterleavedBufferAttribute', 'Interpolant',
    'InterpolateBezier', 'InterpolateDiscrete', 'InterpolateLinear',
    'InterpolateSmooth', 'InterpolationSamplingMode',
    'InterpolationSamplingType', 'InvertStencilOp', 'KeepStencilOp',
    'KeyframeTrack', 'LOD', 'LatheGeometry', 'Layers', 'LessCompare',
    'LessDepth', 'LessEqualCompare', 'LessEqualDepth', 'LessEqualStencilFunc',
    'LessStencilFunc', 'Light', 'LightProbe', 'Line', 'Line3',
    'LineBasicMaterial', 'LineCurve', 'LineCurve3', 'LineDashedMaterial',
    'LineLoop', 'LineSegments', 'LinearFilter', 'LinearInterpolant',
    'LinearMipMapLinearFilter', 'LinearMipMapNearestFilter',
    'LinearMipmapLinearFilter', 'LinearMipmapNearestFilter',
    'LinearSRGBColorSpace', 'LinearToneMapping', 'LinearTransfer', 'Loader',
    'LoaderUtils', 'LoadingManager', 'LoopOnce', 'LoopPingPong', 'LoopRepeat',
    'MOUSE', 'Material', 'MaterialBlending', 'MaterialLoader', 'MathUtils',
    'Matrix2', 'Matrix3', 'Matrix4', 'MaxEquation', 'Mesh', 'MeshBasicMaterial',
    'MeshDepthMaterial', 'MeshDistanceMaterial', 'MeshLambertMaterial',
    'MeshMatcapMaterial', 'MeshNormalMaterial', 'MeshPhongMaterial',
    'MeshPhysicalMaterial', 'MeshStandardMaterial', 'MeshToonMaterial',
    'MinEquation', 'MirroredRepeatWrapping', 'MixOperation', 'MultiplyBlending',
    'MultiplyOperation', 'NearestFilter', 'NearestMipMapLinearFilter',
    'NearestMipMapNearestFilter', 'NearestMipmapLinearFilter',
    'NearestMipmapNearestFilter', 'NeutralToneMapping', 'NeverCompare',
    'NeverDepth', 'NeverStencilFunc', 'NoBlending', 'NoColorSpace',
    'NoNormalPacking', 'NoToneMapping', 'NormalAnimationBlendMode',
    'NormalBlending', 'NormalGAPacking', 'NormalRGPacking', 'NotEqualCompare',
    'NotEqualDepth', 'NotEqualStencilFunc', 'NumberKeyframeTrack', 'Object3D',
    'ObjectLoader', 'ObjectSpaceNormalMap', 'OctahedronGeometry', 'OneFactor',
    'OneMinusConstantAlphaFactor', 'OneMinusConstantColorFactor',
    'OneMinusDstAlphaFactor', 'OneMinusDstColorFactor', 'OneMinusSrcAlphaFactor',
    'OneMinusSrcColorFactor', 'OrthographicCamera', 'PCFShadowMap',
    'PCFSoftShadowMap', 'PMREMGenerator', 'Path', 'PerspectiveCamera', 'Plane',
    'PlaneGeometry', 'PlaneHelper', 'PointLight', 'PointLightHelper', 'Points',
    'PointsMaterial', 'PolarGridHelper', 'PolyhedronGeometry', 'PositionalAudio',
    'PropertyBinding', 'PropertyMixer', 'QuadraticBezierCurve',
    'QuadraticBezierCurve3', 'Quaternion', 'QuaternionKeyframeTrack',
    'QuaternionLinearInterpolant', 'R11_EAC_Format', 'RED_GREEN_RGTC2_Format',
    'RED_RGTC1_Format', 'REVISION', 'RG11_EAC_Format', 'RGBADepthPacking',
    'RGBAFormat', 'RGBAIntegerFormat', 'RGBA_ASTC_10x10_Format',
    'RGBA_ASTC_10x5_Format', 'RGBA_ASTC_10x6_Format', 'RGBA_ASTC_10x8_Format',
    'RGBA_ASTC_12x10_Format', 'RGBA_ASTC_12x12_Format', 'RGBA_ASTC_4x4_Format',
    'RGBA_ASTC_5x4_Format', 'RGBA_ASTC_5x5_Format', 'RGBA_ASTC_6x5_Format',
    'RGBA_ASTC_6x6_Format', 'RGBA_ASTC_8x5_Format', 'RGBA_ASTC_8x6_Format',
    'RGBA_ASTC_8x8_Format', 'RGBA_BPTC_Format', 'RGBA_ETC2_EAC_Format',
    'RGBA_PVRTC_2BPPV1_Format', 'RGBA_PVRTC_4BPPV1_Format',
    'RGBA_S3TC_DXT1_Format', 'RGBA_S3TC_DXT3_Format', 'RGBA_S3TC_DXT5_Format',
    'RGBDepthPacking', 'RGBFormat', 'RGBIntegerFormat', 'RGB_BPTC_SIGNED_Format',
    'RGB_BPTC_UNSIGNED_Format', 'RGB_ETC1_Format', 'RGB_ETC2_Format',
    'RGB_PVRTC_2BPPV1_Format', 'RGB_PVRTC_4BPPV1_Format', 'RGB_S3TC_DXT1_Format',
    'RGDepthPacking', 'RGFormat', 'RGIntegerFormat', 'RawShaderMaterial', 'Ray',
    'Raycaster', 'RectAreaLight', 'RedFormat', 'RedIntegerFormat',
    'ReinhardToneMapping', 'RenderTarget', 'RenderTarget3D', 'RepeatWrapping',
    'ReplaceStencilOp', 'ReverseSubtractEquation', 'RingGeometry',
    'SIGNED_R11_EAC_Format', 'SIGNED_RED_GREEN_RGTC2_Format',
    'SIGNED_RED_RGTC1_Format', 'SIGNED_RG11_EAC_Format', 'SRGBColorSpace',
    'SRGBTransfer', 'Scene', 'ShaderChunk', 'ShaderLib', 'ShaderMaterial',
    'ShadowMaterial', 'Shape', 'ShapeGeometry', 'ShapePath', 'ShapeUtils',
    'ShortType', 'Skeleton', 'SkeletonHelper', 'SkinnedMesh', 'Source', 'Sphere',
    'SphereGeometry', 'Spherical', 'SphericalHarmonics3', 'SplineCurve',
    'SpotLight', 'SpotLightHelper', 'Sprite', 'SpriteMaterial', 'SrcAlphaFactor',
    'SrcAlphaSaturateFactor', 'SrcColorFactor', 'StaticCopyUsage',
    'StaticDrawUsage', 'StaticReadUsage', 'StereoCamera', 'StreamCopyUsage',
    'StreamDrawUsage', 'StreamReadUsage', 'StringKeyframeTrack',
    'SubtractEquation', 'SubtractiveBlending', 'TOUCH', 'TangentSpaceNormalMap',
    'TetrahedronGeometry', 'Texture', 'TextureLoader', 'TextureUtils', 'Timer',
    'TimestampQuery', 'TorusGeometry', 'TorusKnotGeometry', 'Triangle',
    'TriangleFanDrawMode', 'TriangleStripDrawMode', 'TrianglesDrawMode',
    'TubeGeometry', 'UVMapping', 'Uint16BufferAttribute',
    'Uint32BufferAttribute', 'Uint8BufferAttribute',
    'Uint8ClampedBufferAttribute', 'Uniform', 'UniformsGroup', 'UniformsLib',
    'UniformsUtils', 'UnsignedByteType', 'UnsignedInt101111Type',
    'UnsignedInt248Type', 'UnsignedInt5999Type', 'UnsignedIntType',
    'UnsignedShort4444Type', 'UnsignedShort5551Type', 'UnsignedShortType',
    'VSMShadowMap', 'Vector2', 'Vector3', 'Vector4', 'VectorKeyframeTrack',
    'VideoFrameTexture', 'VideoTexture', 'WebGL3DRenderTarget',
    'WebGLArrayRenderTarget', 'WebGLCoordinateSystem', 'WebGLCubeRenderTarget',
    'WebGLRenderTarget', 'WebGLRenderer', 'WebGLUtils', 'WebGPUCoordinateSystem',
    'WebXRController', 'WireframeGeometry', 'WrapAroundEnding',
    'ZeroCurvatureEnding', 'ZeroFactor', 'ZeroSlopeEnding', 'ZeroStencilOp',
    'createCanvasElement', 'error', 'getConsoleFunction', 'log',
    'setConsoleFunction', 'warn', 'warnOnce',
  ]],
  '@react-three/fiber': ['__pv_react_three_fiber', [
    'Canvas', 'ReactThreeFiber', '__esModule', '_roots', 'act', 'addAfterEffect',
    'addEffect', 'addTail', 'advance', 'applyProps', 'buildGraph', 'context',
    'createEvents', 'createPortal', 'createRoot', 'dispose', 'events', 'extend',
    'flushGlobalEffects', 'flushSync', 'getRootState', 'invalidate',
    'reconciler', 'unmountComponentAtNode', 'useFrame', 'useGraph',
    'useInstanceHandle', 'useLoader', 'useStore', 'useThree',
  ]],
  '@react-three/drei': ['__pv_react_three_drei', [
    'AccumulativeShadows', 'AdaptiveDpr', 'AdaptiveEvents', 'ArcballControls',
    'AsciiRenderer', 'BBAnchor', 'Backdrop', 'BakeShadows', 'Billboard',
    'Bounds', 'Box', 'Bvh', 'CameraControls', 'CameraShake', 'Capsule',
    'CatmullRomLine', 'Caustics', 'Center', 'Circle', 'Clone', 'Cloud',
    'CloudInstance', 'Clouds', 'ComputedAttribute', 'Cone', 'ContactShadows',
    'CubeCamera', 'CubeTexture', 'CubicBezierLine', 'CurveModifier',
    'CycleRaycast', 'Cylinder', 'Decal', 'Detailed', 'DetectGPU',
    'DeviceOrientationControls', 'Dodecahedron', 'DragControls', 'Edges',
    'Effects', 'Environment', 'EnvironmentCube', 'EnvironmentMap',
    'EnvironmentPortal', 'Example', 'Extrude', 'FaceControls', 'FaceLandmarker',
    'FaceLandmarkerDefaults', 'Facemesh', 'FacemeshDatas', 'FacemeshEye',
    'FacemeshEyeDefaults', 'Fbo', 'Fbx', 'FirstPersonControls', 'Fisheye',
    'Float', 'FlyControls', 'GizmoHelper', 'GizmoViewcube', 'GizmoViewport',
    'Gltf', 'GradientTexture', 'GradientType', 'Grid', 'Helper', 'Html', 'Hud',
    'Icosahedron', 'Image', 'Instance', 'InstancedAttribute', 'Instances',
    'IsObject', 'KeyboardControls', 'Ktx2', 'Lathe', 'Lightformer', 'Line',
    'Loader', 'MapControls', 'MarchingCube', 'MarchingCubes', 'MarchingPlane',
    'Mask', 'MatcapTexture', 'Merged', 'MeshDiscardMaterial',
    'MeshDistortMaterial', 'MeshPortalMaterial', 'MeshReflectorMaterial',
    'MeshRefractionMaterial', 'MeshTransmissionMaterial', 'MeshWobbleMaterial',
    'MotionPathControls', 'MultiMaterial', 'NormalTexture', 'Octahedron',
    'OrbitControls', 'OrthographicCamera', 'Outlines', 'PerformanceMonitor',
    'PerspectiveCamera', 'PivotControls', 'Plane', 'Point', 'PointMaterial',
    'PointMaterialImpl', 'PointerLockControls', 'Points', 'PointsBuffer',
    'Polyhedron', 'PositionMesh', 'PositionPoint', 'PositionalAudio', 'Preload',
    'PresentationControls', 'Progress', 'QuadraticBezierLine', 'RandomizedLight',
    'RenderCubeTexture', 'RenderTexture', 'Resize', 'Ring', 'RoundedBox',
    'RoundedBoxGeometry', 'Sampler', 'ScreenQuad', 'ScreenSizer', 'ScreenSpace',
    'ScreenVideoTexture', 'Scroll', 'ScrollControls', 'Segment', 'SegmentObject',
    'Segments', 'Select', 'Shadow', 'ShadowAlpha', 'Shape', 'Sky', 'SoftShadows',
    'Sparkles', 'Sphere', 'Splat', 'SpotLight', 'SpotLightShadow',
    'SpriteAnimator', 'Stage', 'Stars', 'Stats', 'StatsGl', 'Svg', 'Tetrahedron',
    'Text', 'Text3D', 'Texture', 'Torus', 'TorusKnot', 'TrackballControls',
    'Trail', 'TrailTexture', 'TransformControls', 'Tube', 'VideoTexture', 'View',
    'WebcamVideoTexture', 'Wireframe', '__esModule', 'accumulativeContext',
    'calcPosFromAngles', 'calculateScaleFactor', 'checkIfFrameIsEmpty',
    'createInstances', 'getFirstFrame', 'isWebGL2Available', 'meshBounds',
    'shaderMaterial', 'useAnimations', 'useAspect', 'useBVH', 'useBounds',
    'useBoxProjectedEnv', 'useCamera', 'useContextBridge', 'useCubeCamera',
    'useCubeTexture', 'useCursor', 'useDepthBuffer', 'useDetectGPU',
    'useEnvironment', 'useFBO', 'useFBX', 'useFaceControls', 'useFaceLandmarker',
    'useFont', 'useGLTF', 'useGizmoContext', 'useHelper', 'useIntersect',
    'useKTX2', 'useKeyboardControls', 'useMask', 'useMatcapTexture', 'useMotion',
    'useNormalTexture', 'usePerformanceMonitor', 'useProgress', 'useScroll',
    'useSelect', 'useSpriteAnimator', 'useSpriteLoader', 'useSurfaceSampler',
    'useTexture', 'useTrail', 'useTrailTexture', 'useVideoTexture',
  ]],
  '@react-three/postprocessing': ['__pv_react_three_postprocessing', [
    'ASCII', 'Autofocus', 'Bloom', 'BrightnessContrast', 'ChromaticAberration',
    'ColorAverage', 'ColorDepth', 'Depth', 'DepthOfField', 'DotScreen',
    'EffectComposer', 'EffectComposerContext', 'FXAA', 'Glitch', 'GodRays',
    'Grid', 'HueSaturation', 'LUT', 'LensFlare', 'LensFlareEffect', 'N8AO',
    'Noise', 'Outline', 'Pixelation', 'Ramp', 'RampEffect', 'RampType', 'SMAA',
    'SSAO', 'Scanline', 'Select', 'Selection', 'SelectiveBloom', 'Sepia',
    'ShockWave', 'Texture', 'TiltShift', 'TiltShift2', 'TiltShiftEffect',
    'ToneMapping', 'Vignette', 'WaterEffect', 'WaterEffectImpl', 'resolveRef',
    'selectionContext', 'useVector2', 'wrapEffect',
  ]],
  'postprocessing': ['__pv_postprocessing', [
    'ASCIIEffect', 'ASCIITexture', 'AdaptiveLuminanceMaterial',
    'AdaptiveLuminancePass', 'BlendFunction', 'BlendMode', 'BloomEffect',
    'BlurPass', 'BokehEffect', 'BokehMaterial', 'BoxBlurMaterial', 'BoxBlurPass',
    'BrightnessContrastEffect', 'ChromaticAberrationEffect',
    'CircleOfConfusionMaterial', 'ClearMaskPass', 'ClearPass',
    'ColorAverageEffect', 'ColorChannel', 'ColorDepthEffect',
    'ColorEdgesMaterial', 'ConvolutionMaterial', 'CopyMaterial', 'CopyPass',
    'DepthComparisonMaterial', 'DepthCopyMaterial', 'DepthCopyMode',
    'DepthCopyPass', 'DepthDownsamplingMaterial', 'DepthDownsamplingPass',
    'DepthEffect', 'DepthMaskMaterial', 'DepthOfFieldEffect', 'DepthPass',
    'DepthPickingPass', 'DepthSavePass', 'DepthTestStrategy', 'Disposable',
    'DotScreenEffect', 'DownsamplingMaterial', 'EdgeDetectionMaterial',
    'EdgeDetectionMode', 'Effect', 'EffectAttribute', 'EffectComposer',
    'EffectMaterial', 'EffectPass', 'EffectShaderData', 'EffectShaderSection',
    'FXAAEffect', 'GammaCorrectionEffect', 'GaussKernel', 'GaussianBlurMaterial',
    'GaussianBlurPass', 'GlitchEffect', 'GlitchMode', 'GodRaysEffect',
    'GodRaysMaterial', 'GridEffect', 'HueSaturationEffect', 'ImmutableTimer',
    'Initializable', 'KawaseBlurMaterial', 'KawaseBlurPass', 'KernelSize',
    'LUT1DEffect', 'LUT3DEffect', 'LUT3dlLoader', 'LUTCubeLoader', 'LUTEffect',
    'LUTOperation', 'LambdaPass', 'LensDistortionEffect', 'LookupTexture',
    'LookupTexture3D', 'LuminanceMaterial', 'LuminancePass', 'MaskFunction',
    'MaskMaterial', 'MaskPass', 'MipmapBlurPass', 'NoiseEffect', 'NoiseTexture',
    'NormalPass', 'OutlineEdgesMaterial', 'OutlineEffect', 'OutlineMaterial',
    'OverrideMaterialManager', 'Pass', 'PixelationEffect', 'PredicationMode',
    'RawImageData', 'RealisticBokehEffect', 'RenderPass', 'Resizable', 'Resizer',
    'Resolution', 'SMAAAreaImageData', 'SMAAEffect', 'SMAAImageGenerator',
    'SMAAImageLoader', 'SMAAPreset', 'SMAASearchImageData',
    'SMAAWeightsMaterial', 'SSAOEffect', 'SSAOMaterial', 'SavePass',
    'ScanlineEffect', 'Section', 'Selection', 'SelectiveBloomEffect',
    'SepiaEffect', 'ShaderPass', 'ShockWaveEffect', 'TetrahedralUpscaler',
    'TextureEffect', 'TiltShiftBlurMaterial', 'TiltShiftBlurPass',
    'TiltShiftEffect', 'Timer', 'ToneMappingEffect', 'ToneMappingMode',
    'UpsamplingMaterial', 'VignetteEffect', 'VignetteTechnique',
    'WebGLExtension', 'version',
  ]],
  '@remotion/three': ['__pv_remotion_three', [
    'ThreeCanvas', 'useOffthreadVideoTexture', 'useVideoTexture',
  ]],
};

const DYNAMIC_BRIDGE_PACKAGES: Record<string, string> = {};

export interface PreviewBundleResult {
  ok: true;
  bundleJs: string;
}

export interface PreviewBundleDiagnostic {
  text: string;       // the esbuild error text, e.g. "Expected ')' but found 'fps'"
  file: string;       // typically "Scene.tsx"
  line: number;       // 1-based
  column: number;     // 0-based (esbuild convention)
  lineText?: string;  // the raw source line (esbuild provides this)
}

export interface PreviewBundleError {
  ok: false;
  error: string;                          // human-readable summary (kept for back-compat)
  diagnostics?: PreviewBundleDiagnostic[]; // structured, used by compilePreviewTool to build excerpts
}

export type PreviewBundleOutcome = PreviewBundleResult | PreviewBundleError;

interface PreviewBundleOptions {
  dependencies?: Record<string, string>;
  modules?: Record<string, string>;
}

function getPreviewModules(sceneCode: string, modules?: Record<string, string>): Record<string, string> {
  if (modules && Object.keys(modules).length > 0) {
    return modules;
  }
  return { 'Scene.tsx': sceneCode };
}

function assertSafeModulePath(filePath: string): void {
  const normalized = filePath.replace(/\\/g, '/');
  if (
    path.isAbsolute(filePath) ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized === '..' ||
    normalized.includes('\0')
  ) {
    throw new Error(`Unsafe plugin module path: ${filePath}`);
  }
}

function writePreviewModules(srcDir: string, modules: Record<string, string>): void {
  for (const [filePath, source] of Object.entries(modules)) {
    assertSafeModulePath(filePath);
    const targetPath = path.join(srcDir, filePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, source, 'utf-8');
  }
}

function isValidExportName(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name) && name !== 'default';
}

async function collectPackageExportNames(pkg: string): Promise<string[]> {
  try {
    const mod = await import(pkg);
    return Object.keys(mod).filter(isValidExportName).sort();
  } catch {
    return [];
  }
}

async function createBridgePackages(): Promise<Record<string, [string, string[]]>> {
  const bridgePackages: Record<string, [string, string[]]> = { ...CORE_BRIDGE_PACKAGES };

  for (const [pkg, globalKey] of Object.entries(DYNAMIC_BRIDGE_PACKAGES)) {
    bridgePackages[pkg] = [globalKey, await collectPackageExportNames(pkg)];
  }

  return bridgePackages;
}

function globalsBridgePlugin(bridgePackages: Record<string, [string, string[]]>) {
  return {
    name: 'globals-bridge',
    setup(build: any) {
      for (const pkg of Object.keys(bridgePackages)) {
        const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        build.onResolve({ filter: new RegExp(`^${escaped}$`) }, () => ({
          path: pkg,
          namespace: 'globals-bridge',
        }));
      }
      build.onLoad({ filter: /.*/, namespace: 'globals-bridge' }, (args: any) => {
        const [globalKey, namedExports] = bridgePackages[args.path] ?? ['__pv_unknown', []];
        const lines = [`const __ns = globalThis[${JSON.stringify(globalKey)}] ?? {};`];
        for (const name of namedExports) {
          lines.push(`export const ${name} = __ns[${JSON.stringify(name)}];`);
        }
        lines.push(`export default __ns;`);
        return { contents: lines.join('\n'), loader: 'js' };
      });
    },
  };
}

function shouldAllowLocalBuild(): boolean {
  return process.env.ALLOW_LOCAL_PLUGIN_BUILD === 'true' || process.env.USE_SANDBOX_BUILDER === 'false';
}

function hasSandboxCredentials(): boolean {
  return Boolean(process.env.E2B_API_KEY || 'e2b_4d4e8b7ef35bd3a37a3d77bf839b38a98e6b3b71');
}

function formatSandboxErrors(errors: string[]): string {
  if (errors.length === 0) return 'No sandbox provider was attempted.';
  return errors.map((error, index) => `${index + 1}. ${error}`).join('\n');
}

/**
 * Bundle a Scene.tsx string into an ESM blob that can be loaded into the browser
 * via blob URL + dynamic import. Returns the bundle text on success, or a
 * structured error string (with line numbers) on esbuild failure.
 *
 * @param sceneCode The full Scene.tsx source.
 * @param pluginId Used for tmpdir naming only.
 */
export async function bundlePreview(
  sceneCode: string,
  pluginId: string,
  options: PreviewBundleOptions = {},
): Promise<PreviewBundleOutcome> {
  const ROOT = process.cwd();
  const modules = getPreviewModules(sceneCode, options.modules);
  const sourceCheck = validatePluginSource(modules);
  if (!sourceCheck.ok) {
    return {
      ok: false,
      error: `Plugin source failed validation:\n${formatPluginSourceIssues(sourceCheck.issues)}`,
      diagnostics: sourceCheck.issues.map((issue) => ({
        text: issue.message,
        file: issue.file,
        line: issue.line,
        column: 0,
      })),
    };
  }

  const depPolicy = normalizePluginDependencies(options.dependencies);
  const safeDeps = depPolicy.dependencies;
  for (const message of formatDependencyPolicyChanges(depPolicy)) {
    console.warn(`[preview-bundler] ${message}`);
  }

  if (Object.keys(safeDeps).length > 0 && process.env.USE_SANDBOX_BUILDER !== 'false' && hasSandboxCredentials()) {
    const errors: string[] = [];

    try {
      const bundleJs = await bundlePreviewInSandbox(pluginId, safeDeps, modules);
      return { ok: true, bundleJs };
    } catch (e: any) {
      const message = `sandbox: ${e?.message ?? e}`;
      errors.push(message);
      console.warn(`[preview-bundler] E2B sandbox preview failed: ${e?.message ?? e}`);
    }

    if (!shouldAllowLocalBuild()) {
      return {
        ok: false,
        error:
          `Plugin preview sandbox build failed. Local fallback is disabled for safety.\n${formatSandboxErrors(errors)}\n` +
          'Configure E2B sandbox credentials.',
      };
    }
  } else if (Object.keys(safeDeps).length > 0 && !hasSandboxCredentials()) {
    console.warn(
      '[preview-bundler] E2B Sandbox credentials not configured — using local esbuild. ' +
      'Set ALLOW_LOCAL_PLUGIN_BUILD=false to hard-fail instead.',
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `plugin-preview-${pluginId}-`));

  try {
    const srcDir = path.join(tmpDir, 'src');
    const distDir = path.join(tmpDir, 'dist');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(distDir, { recursive: true });

    writePreviewModules(srcDir, modules);

    const sharedUtils = path.join(ROOT, 'shared', 'plugin-utils', 'index.ts');
    const sharedTypes = path.join(ROOT, 'shared', 'plugin-types', 'index.ts');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const esbuild = require('esbuild');

    const aliasPlugin = {
      name: 'shared-alias',
      setup(build: any) {
        if (fs.existsSync(sharedUtils)) {
          build.onResolve({ filter: /shared\/plugin-utils/ }, () => ({ path: sharedUtils }));
        }
        if (fs.existsSync(sharedTypes)) {
          build.onResolve({ filter: /shared\/plugin-types/ }, () => ({ path: sharedTypes }));
        }
      },
    };

    const outfile = path.join(distDir, 'index.cjs');
    const bridgePackages = await createBridgePackages();

    await esbuild.build({
      entryPoints: [path.join(srcDir, 'Scene.tsx')],
      outfile,
      format: 'cjs',
      bundle: true,
      external: Object.keys(bridgePackages),
      target: ['chrome90'],
      platform: 'browser',
      nodePaths: [path.join(ROOT, 'node_modules')],
      absWorkingDir: ROOT,
      inject: [path.join(ROOT, 'src/lib/plugins/buffer-shim.js')],
      define: { global: 'globalThis' },
      plugins: [aliasPlugin],
      sourcemap: 'inline',
      minify: false,
    });

    if (!fs.existsSync(outfile)) {
      return { ok: false, error: 'Build succeeded but bundle not found' };
    }

    const bundleJs = fs.readFileSync(outfile, 'utf-8');
    return { ok: true, bundleJs };
  } catch (e: any) {
    // esbuild errors carry structured `errors` array with file/line/column.
    // We surface BOTH a flat human-readable summary AND a structured diagnostics
    // array. The compile-preview tool builds source excerpts from diagnostics so
    // the agent can do surgical edits without re-reading the whole file.
    let summary = e?.message ?? 'esbuild failed';
    let diagnostics: PreviewBundleDiagnostic[] | undefined;

    if (Array.isArray(e?.errors) && e.errors.length > 0) {
      diagnostics = e.errors.map((err: any) => ({
        text: err.text ?? 'Unknown error',
        file: err.location?.file ?? 'Scene.tsx',
        line: err.location?.line ?? 0,
        column: err.location?.column ?? 0,
        lineText: err.location?.lineText,
      }));
      summary = diagnostics
        .map((d) => `${d.text} at ${d.file}:${d.line}:${d.column}`)
        .join('\n');
    }
    return { ok: false, error: summary, diagnostics };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  }
}

async function bundlePreviewInSandbox(
  pluginId: string,
  dependencies: Record<string, string>,
  modules: Record<string, string>,
): Promise<string> {
  const { Sandbox } = await import('@e2b/code-interpreter');
  const ROOT = process.cwd();
  const CWD = '/home/user';

  const sharedUtils = path.join(ROOT, 'shared', 'plugin-utils', 'index.ts');
  const sharedTypes = path.join(ROOT, 'shared', 'plugin-types', 'index.ts');
  let sharedUtilsContent = '';
  let sharedTypesContent = '';
  try { sharedUtilsContent = fs.readFileSync(sharedUtils, 'utf-8'); } catch { /* optional */ }
  try { sharedTypesContent = fs.readFileSync(sharedTypes, 'utf-8'); } catch { /* optional */ }

  const packageJson = JSON.stringify({
    name: `plugin-preview-${pluginId}`,
    version: '0.0.0',
    private: true,
    type: 'module',
    dependencies: {
      esbuild: '^0.25.0',
      buffer: '^6.0.3',
      ...dependencies,
    },
  }, null, 2);

  const buildScript = `
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const srcDir = '${CWD}/src';
const distDir = '${CWD}/dist';
fs.mkdirSync(distDir, { recursive: true });

const coreBridgePackages = ${JSON.stringify(CORE_BRIDGE_PACKAGES)};
const dynamicBridgePackages = ${JSON.stringify(DYNAMIC_BRIDGE_PACKAGES)};

function isValidExportName(name) {
  return /^[A-Za-z_$][\\w$]*$/.test(name) && name !== 'default';
}

async function collectPackageExportNames(pkg) {
  try {
    const mod = await import(pkg);
    return Object.keys(mod).filter(isValidExportName).sort();
  } catch {
    return [];
  }
}

const bridgePackages = { ...coreBridgePackages };
for (const [pkg, globalKey] of Object.entries(dynamicBridgePackages)) {
  bridgePackages[pkg] = [globalKey, await collectPackageExportNames(pkg)];
}

const globalsBridgePlugin = {
  name: 'globals-bridge',
  setup(build) {
    for (const pkg of Object.keys(bridgePackages)) {
      const escaped = pkg.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&');
      build.onResolve({ filter: new RegExp('^' + escaped + '$') }, () => ({
        path: pkg,
        namespace: 'globals-bridge',
      }));
    }
    build.onLoad({ filter: /.*/, namespace: 'globals-bridge' }, (args) => {
      const [globalKey, namedExports] = bridgePackages[args.path] ?? ['__pv_unknown', []];
      const lines = ['const __ns = globalThis[' + JSON.stringify(globalKey) + '] ?? {};'];
      for (const name of namedExports) {
        lines.push('export const ' + name + ' = __ns[' + JSON.stringify(name) + '];');
      }
      lines.push('export default __ns;');
      return { contents: lines.join('\\n'), loader: 'js' };
    });
  },
};

const aliasPlugin = {
  name: 'shared-alias',
  setup(build) {
    build.onResolve({ filter: /shared\\/plugin-utils/ }, () => ({ path: path.join(srcDir, 'plugin-utils.ts') }));
    build.onResolve({ filter: /shared\\/plugin-types/ }, () => ({ path: path.join(srcDir, 'plugin-types.ts') }));
  },
};

const outfile = path.join(distDir, 'index.js');

await esbuild.build({
  entryPoints: [path.join(srcDir, 'Scene.tsx')],
  outfile,
  format: 'cjs',
  bundle: true,
  external: Object.keys(bridgePackages),
  target: ['chrome90'],
  platform: 'browser',
  nodePaths: [path.join('${CWD}', 'node_modules')],
  absWorkingDir: '${CWD}',
  inject: [path.join(srcDir, 'buffer-shim.js')],
  define: { global: 'globalThis' },
  plugins: [aliasPlugin],
  sourcemap: 'inline',
  minify: false,
});

const bundleJs = fs.readFileSync(outfile, 'utf-8');
process.stdout.write(JSON.stringify({ success: true, bundleJs }));
`;

  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY || 'e2b_4d4e8b7ef35bd3a37a3d77bf839b38a98e6b3b71',
    timeoutMs: 120_000,
  });

  try {
    const fileWrites = [
      sandbox.files.write(`${CWD}/package.json`, packageJson),
      sandbox.files.write(`${CWD}/build.mjs`, buildScript),
      sandbox.files.write(`${CWD}/src/plugin-utils.ts`, sharedUtilsContent),
      sandbox.files.write(`${CWD}/src/plugin-types.ts`, sharedTypesContent),
      sandbox.files.write(`${CWD}/src/buffer-shim.js`, fs.readFileSync(path.join(ROOT, 'src/lib/plugins/buffer-shim.js'), 'utf-8')),
    ];

    for (const [filePath, content] of Object.entries(modules)) {
      assertSafeModulePath(filePath);
      fileWrites.push(sandbox.files.write(`${CWD}/src/${filePath.replace(/\\/g, '/')}`, content));
    }

    await Promise.all(fileWrites);

    const install = await sandbox.commands.run('npm install --legacy-peer-deps --no-audit --no-fund --loglevel=error', { cwd: CWD });
    if (install.error || install.exitCode !== 0) {
      throw new Error(
        `Sandbox npm install failed (exit ${install.exitCode})\nstdout: ${install.stdout}\nstderr: ${install.stderr}`,
      );
    }

    const build = await sandbox.commands.run('node build.mjs', { cwd: CWD });
    const stdout = build.stdout;
    const stderr = build.stderr;
    if (build.error || build.exitCode !== 0) {
      throw new Error(`Sandbox preview build failed (exit ${build.exitCode})\nstdout: ${stdout}\nstderr: ${stderr}`);
    }

    const parsed = JSON.parse(stdout);
    if (!parsed.success || typeof parsed.bundleJs !== 'string') {
      throw new Error(`Sandbox preview build returned invalid output: ${stdout || stderr}`);
    }
    return parsed.bundleJs;
  } finally {
    await sandbox.kill();
  }
}
