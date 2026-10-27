import 'server-only';

import { db } from '@/lib/db';
import { containsPremiumBlocks, containsPremiumBlocksDynamic, hasPremiumAccess, PREMIUM_BLOCK_TYPES } from '@/lib/roles';

export async function isFreeTierPublicTemplate(templateId?: string | null): Promise<boolean> {
  if (!templateId?.trim()) {
    return false;
  }

  const result = await db.query(
    `SELECT "isPublic", COALESCE("isFreeTier", false) AS "isFreeTier"
     FROM "Template"
     WHERE id = $1
     LIMIT 1`,
    [templateId.trim()]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const row = result.rows[0];
  return Boolean(row.isPublic && row.isFreeTier);
}

export async function canUseTemplateBlocks(options: {
  role?: string;
  blocks?: Array<{ type?: string }>;
  sourceTemplateId?: string | null;
}): Promise<boolean> {
  // Try to load dynamic premium block types from DB
  let premiumTypes: string[] = [...PREMIUM_BLOCK_TYPES];
  try {
    const configResult = await db.query(
      `SELECT value FROM site_config WHERE key = 'premium_config'`
    );
    if (configResult.rows[0]?.value?.premiumBlockTypes) {
      premiumTypes = configResult.rows[0].value.premiumBlockTypes;
    }
  } catch { /* use defaults */ }

  if (!containsPremiumBlocksDynamic(options.blocks ?? [], premiumTypes)) {
    return true;
  }

  if (hasPremiumAccess(options.role)) {
    return true;
  }

  return isFreeTierPublicTemplate(options.sourceTemplateId);
}
