export type AppRole = 'ADMIN' | 'CONTENT_MANAGER' | 'PREMIUM' | 'USER';

export const PREMIUM_BLOCK_TYPES = [
  'tower-chart-3d',
  'parallax-story',
  'video',
  'bar-race-3d',
  'html',
  'diagram',
] as const;

export type PremiumBlockType = typeof PREMIUM_BLOCK_TYPES[number];

export function isAdmin(role?: string): boolean {
  return role === 'ADMIN';
}

export function isContentManager(role?: string): boolean {
  return role === 'ADMIN' || role === 'CONTENT_MANAGER';
}

export function hasPremiumAccess(role?: string): boolean {
  return role === 'ADMIN' || role === 'PREMIUM';
}

export function isPremiumBlockType(type?: string): type is PremiumBlockType {
  return PREMIUM_BLOCK_TYPES.includes(type as PremiumBlockType);
}

export function containsPremiumBlocks(blocks?: Array<{ type?: string }>): boolean {
  return (blocks ?? []).some((block) => isPremiumBlockType(block.type));
}

/** Check blocks against a dynamic list of premium types (for server-side use with DB config) */
export function containsPremiumBlocksDynamic(
  blocks: Array<{ type?: string }>,
  premiumTypes: string[]
): boolean {
  return blocks.some((block) => block.type && premiumTypes.includes(block.type));
}
