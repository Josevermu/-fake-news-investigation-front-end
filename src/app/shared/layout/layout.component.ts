import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalProgressComponent } from '@shared/components/global-progress/global-progress.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, GlobalProgressComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {}
