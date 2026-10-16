import { Page } from '@playwright/test';

/**
 * Replaces Web Audio with a recorder before the app loads (TESTING.md:
 * stub AudioContext, assert on state not sound). Its clock follows
 * performance.now(), so Playwright's clock control drives the metronome.
 * Scheduled sounds are pushed to window.__audioLog as "note:<t>" /
 * "click:<t>" strings.
 */
export async function stubAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: string[] = [];
    const noop = () => undefined;
    (window as unknown as { __audioLog: string[] }).__audioLog = log;
    const param = () => ({
      value: 0,
      setValueAtTime: noop,
      setTargetAtTime: noop,
      linearRampToValueAtTime: noop,
      exponentialRampToValueAtTime: noop,
    });
    const node = () => ({ connect: (n: unknown) => n });
    class FakeAudioContext {
      state = 'running';
      sampleRate = 8000;
      destination = {};
      get currentTime() {
        return performance.now() / 1000;
      }
      createBuffer(_c: number, length: number) {
        return { length, copyToChannel: noop };
      }
      createBufferSource() {
        return {
          ...node(),
          buffer: null,
          detune: param(),
          start: (t: number) => log.push(`note:${t.toFixed(2)}`),
          stop: noop,
        };
      }
      createGain() {
        return { ...node(), gain: param() };
      }
      createOscillator() {
        return {
          ...node(),
          frequency: { value: 0 },
          start: (t: number) => log.push(`click:${t.toFixed(2)}`),
          stop: noop,
        };
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext =
      FakeAudioContext;
  });
}

export const audioLog = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __audioLog: string[] }).__audioLog,
  );
