'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';

export function PostHogProvider() {
  useEffect(() => {
    posthog.init('phc_xTrjhBxVVZwabSOnMSSfAekguwyMni0l34mKIuJyXGY', {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      defaults: '2025-05-24',
    });
  }, []);

  return null;
}
