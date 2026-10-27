import { Observability, SamplingStrategyType } from '@mastra/observability';
import { LangfuseExporter } from '@mastra/langfuse';

const langfuseEnabled =
  !!process.env.LANGFUSE_PUBLIC_KEY && !!process.env.LANGFUSE_SECRET_KEY;

export const observability = langfuseEnabled
  ? new Observability({
      configs: {
        default: {
          serviceName: 'videoGen',
          exporters: [
            new LangfuseExporter({
              publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
              secretKey: process.env.LANGFUSE_SECRET_KEY!,
              ...(process.env.LANGFUSE_BASE_URL && {
                baseUrl: process.env.LANGFUSE_BASE_URL,
              }),
              realtime: process.env.NODE_ENV !== 'production',
            }),
          ],
          sampling: {
            type: SamplingStrategyType.RATIO,
            probability: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
          },
        },
      },
    })
  : undefined;
