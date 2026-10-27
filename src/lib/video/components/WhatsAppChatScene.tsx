import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring, Sequence } from 'remotion';
import { Audio } from '@remotion/media';
import { type MotionProfileType } from '../utils/animations';
import type { WhatsAppChatBlock, WhatsAppMessage, AnimationPhase } from '../schemas';
import { MESSAGE_SENT_SOUND, MESSAGE_RECEIVED_SOUND, type SoundConfig, DEFAULT_SOUND_CONFIG } from '../utils/sounds';

// ============================================================================
// SCALE FUNCTION FOR WHATSAPP CHAT
// ============================================================================

const SIZE_SCALE = 1.5;

function scale(baseSize: number): number {
  return Math.round(baseSize * SIZE_SCALE);
}

// ============================================================================
// WHATSAPP CHAT SCENE COMPONENT
// ============================================================================

export interface WhatsAppChatSceneProps {
  data: WhatsAppChatBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
  soundConfig?: SoundConfig;
}

// WhatsApp colors
const WHATSAPP_COLORS = {
  green: '#25D366',
  darkGreen: '#075E54',
  lightGreen: '#DCF8C6',
  background: '#ECE5DD',
  backgroundPattern: '#E4DDD4',
  white: '#FFFFFF',
  sentBubble: '#DCF8C6',
  receivedBubble: '#FFFFFF',
  textPrimary: '#303030',
  textSecondary: '#667781',
  timeText: '#667781',
  readTick: '#53BDEB',
  headerBg: '#008069',
  headerText: '#FFFFFF',
  onlineGreen: '#25D366',
};

// Default placeholder avatars (using a simple colored circle with initials)
const getAvatarUrl = (name: string, gender?: 'male' | 'female'): string => {
  // Use placeholder images
  if (gender === 'female') {
    return 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face';
  }
  return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face';
};

export function WhatsAppChatScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
  soundConfig = DEFAULT_SOUND_CONFIG,
}: WhatsAppChatSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Guard against missing data (e.g. during Lambda composition discovery)
  if (!data?.messages) {
    return <AbsoluteFill style={{ background: '#ECE5DD' }} />;
  }

  // Merge sound config with defaults
  const sounds = { ...DEFAULT_SOUND_CONFIG, ...soundConfig };
  
  // Animation timings from props
  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration = animation?.hold ?? 6;
  const exitDuration = animation?.exit ?? 0.4;
  
  // Exit animation
  const exitStart = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart 
    ? Math.min(1, (frame - exitStart) / (fps * exitDuration))
    : 0;
  const exitOpacity = 1 - exitProgress;
  
  // Calculate message timing dynamically based on hold duration
  const messageCount = data.messages.length;
  const showTyping = data.showTypingIndicator ?? true;
  
  // Allocate time: typing gets 20% of hold, messages get 80%
  const typingDuration = showTyping ? Math.min(2.5, holdDuration * 0.2) : 0;
  const messageTime = holdDuration - typingDuration - 0.5; // 0.5s buffer at end
  
  // Calculate delay between messages to fit all within allocated time
  const messageDelay = messageCount > 1 
    ? Math.max(1.5, messageTime / messageCount) // At least 1.5s between messages
    : messageTime;
  
  // Calculate which messages are currently visible based on animation
  const initialDelay = showTyping ? enterDuration + typingDuration : enterDuration;
  const currentTime = frame / fps;
  
  // Determine how many messages have appeared so far
  let visibleMessageCount = 0;
  for (let i = 0; i < messageCount; i++) {
    const messageStartTime = initialDelay + i * messageDelay;
    if (currentTime >= messageStartTime) {
      visibleMessageCount = i + 1;
    }
  }
  
  // Auto-scroll settings
  // In a 9:16 video at 1080x1920, chat area is roughly 1500px tall after header and input
  // Each message is about 60-90px depending on content. We estimate ~85px average.
  const estimatedMessageHeight = scale(85);
  
  // Calculate how many messages fit in the viewport
  // For a typical phone screen, about 10 messages fill the screen
  const maxVisibleMessages = 10; // Let messages fill the screen first
  
  // Scroll offset: only scroll when we have more than can fit
  const scrollOffset = visibleMessageCount > maxVisibleMessages 
    ? (visibleMessageCount - maxVisibleMessages) * estimatedMessageHeight
    : 0;
  
  // Calculate which sound should play at current frame
  // We play a sound when a new message appears (at the exact frame it appears)
  const messageSoundEvents = useMemo(() => {
    if (!sounds.enabled) return [];
    
    const events: Array<{ 
      src: string; 
      startFrame: number; 
      duration: number;
      key: string;
    }> = [];
    
    for (let i = 0; i < messageCount; i++) {
      const message = data.messages[i];
      const messageStartFrame = Math.round(fps * (initialDelay + i * messageDelay));
      
      events.push({
        src: message.from === 'person1' ? MESSAGE_SENT_SOUND : MESSAGE_RECEIVED_SOUND,
        startFrame: messageStartFrame,
        duration: 15, // ~0.5 seconds at 30fps
        key: `sound-${i}-${message.from}`,
      });
    }
    
    return events;
  }, [sounds.enabled, messageCount, data.messages, fps, initialDelay, messageDelay]);
  
  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      {/* Message Sounds - Using Sequence for precise timing */}
      {sounds.enabled && messageSoundEvents.map((sound) => (
        <Sequence
          key={sound.key}
          from={sound.startFrame}
          durationInFrames={sound.duration}
        >
          <Audio
            src={sound.src}
            volume={sounds.volume}
          />
        </Sequence>
      ))}
      
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: WHATSAPP_COLORS.background,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {/* Header */}
        <WhatsAppHeader
          contactName={data.person2.name}
          lastSeen={data.lastSeen}
          isOnline={data.person2.isOnline}
          avatar={data.person2.avatar || getAvatarUrl(data.person2.name, 'female')}
          frame={frame}
          fps={fps}
        />
        
        {/* Chat Area */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: WHATSAPP_COLORS.background,
          }}
        >
          {/* Scrollable Messages Container */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              padding: `${scale(10)}px ${scale(12)}px`,
              background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc4' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: scale(6),
              transform: `translateY(-${scrollOffset}px)`,
            }}
          >
            {/* Typing Indicator */}
            {showTyping && (
              <TypingIndicator
                visible={frame > fps * enterDuration && frame < fps * (enterDuration + typingDuration)}
                avatar={data.person2.avatar || getAvatarUrl(data.person2.name, 'female')}
                frame={frame}
                fps={fps}
              />
            )}
            
            {/* Messages - only render those that have appeared */}
            {data.messages.slice(0, visibleMessageCount).map((message, index) => {
              // Messages start after typing indicator (or after enter if no typing)
              const initialDelay = showTyping ? enterDuration + typingDuration : enterDuration;
              const startFrame = fps * (initialDelay + index * messageDelay);
              return (
                <ChatBubble
                  key={index}
                  message={message}
                  index={index}
                  startFrame={startFrame}
                  frame={frame}
                  fps={fps}
                  person1Avatar={data.person1.avatar}
                  person2Avatar={data.person2.avatar}
                  totalMessages={data.messages.length}
                />
              );
            })}
          </div>
        </div>
        
        {/* Input Bar (static, just for show) */}
        <div
          style={{
            backgroundColor: '#F0F0F0',
            padding: `${scale(8)}px ${scale(12)}px`,
            display: 'flex',
            alignItems: 'center',
            gap: scale(8),
          }}
        >
          {/* Emoji icon */}
          <svg width={scale(24)} height={scale(24)} viewBox="0 0 24 24" fill={WHATSAPP_COLORS.textSecondary}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-6c.78 1.71 2.46 3 4.22 3 1.76 0 3.44-1.29 4.22-3H8zm8.5-4c.83 0 1.5-.67 1.5-1.5S11.33 7 10.5 7 9 7.67 9 8.5s.67 1.5 1.5 1.5zm-5 0c.83 0 1.5-.67 1.5-1.5S6.33 7 5.5 7 4 7.67 4 8.5 4.67 10 5.5 10z"/>
          </svg>
          
          {/* Input field */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: scale(20),
              padding: `${scale(6)}px ${scale(14)}px`,
              color: WHATSAPP_COLORS.textSecondary,
              fontSize: scale(14),
            }}
          >
            Type a message
          </div>
          
          {/* Camera icon */}
          <svg width={scale(24)} height={scale(24)} viewBox="0 0 24 24" fill={WHATSAPP_COLORS.textSecondary}>
            <circle cx="12" cy="12" r="2.5"/>
            <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
          </svg>
          
          {/* Mic icon */}
          <div
            style={{
              width: scale(40),
              height: scale(40),
              borderRadius: '50%',
              backgroundColor: WHATSAPP_COLORS.green,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width={scale(20)} height={scale(20)} viewBox="0 0 24 24" fill="white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

interface WhatsAppHeaderProps {
  contactName: string;
  lastSeen?: string;
  isOnline?: boolean;
  avatar: string;
  frame: number;
  fps: number;
}

function WhatsAppHeader({ contactName, lastSeen, isOnline, avatar, frame, fps }: WhatsAppHeaderProps) {
  const opacity = Math.min(1, frame / (fps * 0.3));
  
  return (
    <div
      style={{
        backgroundColor: WHATSAPP_COLORS.headerBg,
        padding: `${scale(8)}px ${scale(12)}px`,
        display: 'flex',
        alignItems: 'center',
        gap: scale(10),
        opacity,
      }}
    >
      {/* Back arrow */}
      <svg width={scale(24)} height={scale(24)} viewBox="0 0 24 24" fill="white">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
      
      {/* Avatar */}
      <div
        style={{
          width: scale(40),
          height: scale(40),
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <img
          src={avatar}
          alt={contactName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={(e) => {
            // Fallback to initials if image fails
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
      
      {/* Name and status */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            color: WHATSAPP_COLORS.headerText,
            fontSize: scale(16),
            fontWeight: 500,
          }}
        >
          {contactName}
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: scale(12),
          }}
        >
          {isOnline ? 'online' : lastSeen || 'last seen recently'}
        </div>
      </div>
      
      {/* Video call icon */}
      <svg width={scale(22)} height={scale(22)} viewBox="0 0 24 24" fill="white">
        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
      </svg>
      
      {/* Call icon */}
      <svg width={scale(20)} height={scale(20)} viewBox="0 0 24 24" fill="white">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
      </svg>
      
      {/* Menu icon */}
      <svg width={scale(20)} height={scale(20)} viewBox="0 0 24 24" fill="white">
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
      </svg>
    </div>
  );
}

// ============================================================================
// TYPING INDICATOR COMPONENT
// ============================================================================

interface TypingIndicatorProps {
  visible: boolean;
  avatar: string;
  frame: number;
  fps: number;
}

function TypingIndicator({ visible, avatar, frame, fps }: TypingIndicatorProps) {
  if (!visible) return null;
  
  // Animate dots with bouncing effect
  const dot1 = Math.sin((frame / fps) * Math.PI * 3) * 0.5 + 0.5;
  const dot2 = Math.sin((frame / fps) * Math.PI * 3 + 0.3) * 0.5 + 0.5;
  const dot3 = Math.sin((frame / fps) * Math.PI * 3 + 0.6) * 0.5 + 0.5;
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: scale(4),
        marginBottom: scale(4),
      }}
    >
      {/* Small avatar */}
      <img
        src={avatar}
        alt=""
        style={{
          width: scale(28),
          height: scale(28),
          borderRadius: '50%',
          objectFit: 'cover',
        }}
      />
      
      {/* Typing bubble */}
      <div
        style={{
          backgroundColor: WHATSAPP_COLORS.receivedBubble,
          borderRadius: scale(12),
          borderTopLeftRadius: 0,
          padding: `${scale(10)}px ${scale(14)}px`,
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: scale(4),
        }}
      >
        {[dot1, dot2, dot3].map((dot, i) => (
          <div
            key={i}
            style={{
              width: scale(8),
              height: scale(8),
              borderRadius: '50%',
              backgroundColor: WHATSAPP_COLORS.textSecondary,
              transform: `translateY(${-dot * 4}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// CHAT BUBBLE COMPONENT
// ============================================================================

interface ChatBubbleProps {
  message: WhatsAppMessage;
  index: number;
  startFrame: number;
  frame: number;
  fps: number;
  person1Avatar?: string;
  person2Avatar?: string;
  totalMessages: number;
}

function ChatBubble({
  message,
  index,
  startFrame,
  frame,
  fps,
  person1Avatar,
  person2Avatar,
  totalMessages,
}: ChatBubbleProps) {
  const isSent = message.from === 'person1'; // person1 = sender (right side)
  
  // Animation progress
  const progress = frame >= startFrame 
    ? Math.min(1, (frame - startFrame) / (fps * 0.3))
    : 0;
  
  // Spring animation for pop-in effect
  const scaleValue = spring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: 12,
      stiffness: 200,
      mass: 0.5,
    },
  });
  
  const translateY = interpolate(progress, [0, 1], [20, 0]);
  
  // Read receipt animation (blue ticks appear after a delay)
  const showReadTick = message.showReadReceipt && isSent && frame > startFrame + fps * 0.5;
  const readTickProgress = showReadTick 
    ? Math.min(1, (frame - startFrame - fps * 0.5) / (fps * 0.2))
    : 0;
  
  const bubbleColor = isSent ? WHATSAPP_COLORS.sentBubble : WHATSAPP_COLORS.receivedBubble;
  const borderRadius = isSent 
    ? `${scale(12)}px ${scale(4)}px ${scale(12)}px ${scale(12)}px`
    : `${scale(4)}px ${scale(12)}px ${scale(12)}px ${scale(12)}px`;
  
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isSent ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        gap: scale(4),
        opacity: progress,
        transform: `translateY(${translateY}px) scale(${scaleValue})`,
      }}
    >
      {/* Avatar for received messages */}
      {!isSent && (
        <img
          src={person2Avatar || getAvatarUrl('Receiver', 'female')}
          alt=""
          style={{
            width: scale(28),
            height: scale(28),
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      )}
      
      {/* Message bubble */}
      <div
        style={{
          backgroundColor: bubbleColor,
          borderRadius,
          padding: `${scale(6)}px ${scale(10)}px`,
          maxWidth: '75%',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          position: 'relative',
        }}
      >
        {/* Message text */}
        <div
          style={{
            color: WHATSAPP_COLORS.textPrimary,
            fontSize: scale(14),
            lineHeight: 1.4,
            wordWrap: 'break-word',
          }}
        >
          {message.text}
        </div>
        
        {/* Time and read receipt */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: scale(3),
            marginTop: scale(2),
          }}
        >
          <span
            style={{
              fontSize: scale(11),
              color: WHATSAPP_COLORS.timeText,
            }}
          >
            {message.time || '10:30 AM'}
          </span>
          
          {/* Read ticks for sent messages */}
          {isSent && (
            <svg 
              width={scale(16)} 
              height={scale(11)} 
              viewBox="0 0 16 11"
              style={{ opacity: readTickProgress }}
            >
              <path
                d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 0 0 .501.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.337-.273z"
                fill={WHATSAPP_COLORS.readTick}
              />
              <path
                d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.18-1.18-.64.64 1.82 1.82a.724.724 0 0 0 .501.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.337-.273z"
                fill={WHATSAPP_COLORS.readTick}
              />
            </svg>
          )}
        </div>
        
        {/* Tail for bubble */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            [isSent ? 'right' : 'left']: -scale(6),
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: isSent 
              ? `0 0 ${scale(10)}px ${scale(8)}px`
              : `0 ${scale(8)}px ${scale(10)}px 0`,
            borderColor: isSent 
              ? `transparent transparent ${bubbleColor} transparent`
              : `transparent ${bubbleColor} transparent transparent`,
          }}
        />
      </div>
    </div>
  );
}

export default WhatsAppChatScene;
