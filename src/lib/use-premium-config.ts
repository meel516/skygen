'use client';

import { useSiteConfig } from './use-site-config';

export interface PremiumConfig {
  premiumBlockTypes: string[];
  premiumVoiceProviders: string[];
  upgradeWhatsApp: string;
  upgradeMessage: string;
}

const DEFAULTS: PremiumConfig = {
  premiumBlockTypes: ['tower-chart-3d', 'parallax-story', 'video', 'bar-race-3d'],
  premiumVoiceProviders: ['elevenlabs'],
  upgradeWhatsApp: '917337253375',
  upgradeMessage: 'Hi, I would like to upgrade to Premium on SkyGen!',
};

export function usePremiumConfig(): PremiumConfig {
  const { config } = useSiteConfig();
  const pc = config?.premium_config as Partial<PremiumConfig> | undefined;
  return {
    premiumBlockTypes: pc?.premiumBlockTypes ?? DEFAULTS.premiumBlockTypes,
    premiumVoiceProviders: pc?.premiumVoiceProviders ?? DEFAULTS.premiumVoiceProviders,
    upgradeWhatsApp: pc?.upgradeWhatsApp ?? DEFAULTS.upgradeWhatsApp,
    upgradeMessage: pc?.upgradeMessage ?? DEFAULTS.upgradeMessage,
  };
}

export function getUpgradeUrl(config: PremiumConfig): string {
  return `https://wa.me/${config.upgradeWhatsApp}?text=${encodeURIComponent(config.upgradeMessage)}`;
}
