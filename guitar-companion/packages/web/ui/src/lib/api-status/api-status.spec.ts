import { TestBed } from '@angular/core/testing';
import { ApiStatusComponent, ApiStatusView } from './api-status';

async function render(status: ApiStatusView): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(ApiStatusComponent);
  fixture.componentRef.setInput('status', status);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ApiStatusComponent', () => {
  it('shows loading', async () => {
    const el = await render({ state: 'loading' });
    expect(el.textContent).toContain('Checking API');
    expect(
      el
        .querySelector('[data-testid="api-status"]')
        ?.getAttribute('data-state'),
    ).toBe('loading');
  });

  it('shows details when online', async () => {
    const el = await render({
      state: 'ok',
      version: '1.0.0',
      database: 'up',
      aiProvider: 'fake',
    });
    expect(el.textContent).toContain('API online');
    expect(el.querySelector('[data-testid="api-database"]')?.textContent).toBe(
      'up',
    );
    expect(
      el.querySelector('[data-testid="api-ai-provider"]')?.textContent,
    ).toBe('fake');
  });

  it('shows degraded state', async () => {
    const el = await render({
      state: 'degraded',
      version: '1.0.0',
      database: 'down',
      aiProvider: 'fake',
    });
    expect(el.textContent).toContain('API degraded');
  });

  it('shows error message', async () => {
    const el = await render({ state: 'error', message: 'Network down' });
    expect(el.textContent).toContain('API unreachable');
    expect(el.textContent).toContain('Network down');
  });
});
