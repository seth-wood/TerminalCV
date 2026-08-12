'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export function PostHogProvider() {
  useEffect(() => {
    if (!POSTHOG_KEY) {
      return;
    }

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      defaults: '2025-05-24',
    });
  }, []);

  return null;
}
