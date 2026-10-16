import { InjectionToken } from '@angular/core';
import { PracticeAudio } from '@gsc/web/audio';

/**
 * Creates the audio engine on first use (which must follow a user
 * gesture). Tests provide a recorder instead.
 */
export const AUDIO_ENGINE = new InjectionToken<() => PracticeAudio>(
  'AUDIO_ENGINE',
  { providedIn: 'root', factory: () => () => new PracticeAudio() },
);
