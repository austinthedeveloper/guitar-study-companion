import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ROUTE_PATHS } from '@gsc/web/routes';
import { AppShellComponent, NavLink } from '@gsc/web/ui';

@Component({
  selector: 'gsc-root',
  imports: [RouterOutlet, AppShellComponent],
  template: `<gsc-app-shell
    title="Guitar Study Companion"
    [links]="links"
    [footerLinks]="footerLinks"
    ><router-outlet
  /></gsc-app-shell>`,
})
export class App {
  protected readonly links: NavLink[] = [
    { label: 'Home', path: ROUTE_PATHS.home },
    { label: 'Import', path: ROUTE_PATHS.import },
    { label: 'My phrases', path: ROUTE_PATHS.phrases },
    { label: 'Review', path: ROUTE_PATHS.review },
  ];
  protected readonly footerLinks: NavLink[] = [
    { label: 'Privacy and your data', path: ROUTE_PATHS.privacy },
  ];
}
