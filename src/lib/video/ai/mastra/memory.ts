import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';

const memoryStorage = new PostgresStore({
  id: 'videogen-memory',
  connectionString: process.env.DATABASE_URL!,
});

export const VIDEO_THREAD_MEMORY_TEMPLATE = `# Video Thread Memory

## Current Draft
- Video ID:
- Version:
- Status:
- Block Count:
- Source Of Truth:

## User Intent
- Original Request:
- Current Goal:
- Audience:
- Language:

## Creative Direction
- Arc:
- Visual Style:
- Voice:
- Aspect Ratio:
- Pacing:

## Current Structure
- Blocks:

## Stable Constraints
- Keep:
- Avoid:
- User Preferences:

## Last Change
- Summary:
- Affected Blocks:
- Result:

## Open Issues
- Pending:
- Needs User Decision:

## Update Rules
- Keep this memory concise and current.
- Store the canonical video JSON location or ID, not large raw tool outputs.
- Summarize block structure; do not paste full media payloads or generated asset blobs.
- After any successful create/edit/assemble tool, update Video ID, Version, Current Goal, Current Structure, Last Change, and Open Issues.
`;

export const videoThreadMemory = new Memory({
  storage: memoryStorage,
  options: {
    lastMessages: false,
    semanticRecall: false,
    workingMemory: {
      enabled: true,
      scope: 'thread',
      template: VIDEO_THREAD_MEMORY_TEMPLATE,
    },
  },
});
