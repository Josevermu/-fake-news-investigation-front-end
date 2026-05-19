import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';

@Component({
  selector: 'app-survey-break',
  standalone: true,
  imports: [CommonModule, GlassCardComponent],
  templateUrl: './survey-break.component.html',
  styleUrl: './survey-break.component.scss',
})
export class SurveyBreakComponent {
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly breakVideoUrl = 'https://youtube.com/shorts/VntY-Gtt61s?si=0Njoyvj6d26naIRI';
  readonly breakVideoEmbedUrl: SafeResourceUrl | null = this.buildYouTubeEmbedSafeUrl(this.breakVideoUrl);

  continue(): void {
    this.router.navigate(['/survey-tutorial-phase2']);
  }

  private buildYouTubeEmbedSafeUrl(url: string): SafeResourceUrl | null {
    const videoId = this.extractYouTubeVideoId(url);
    if (!videoId) return null;

    const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  private extractYouTubeVideoId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace('www.', '');
      const path = parsed.pathname;

      // https://youtube.com/shorts/<id>
      if (host === 'youtube.com' && path.startsWith('/shorts/')) {
        const id = path.split('/shorts/')[1]?.split('/')[0];
        return id || null;
      }

      // https://youtu.be/<id>
      if (host === 'youtu.be') {
        const id = path.split('/')[1];
        return id || null;
      }

      // https://youtube.com/watch?v=<id>
      if (host === 'youtube.com') {
        const id = parsed.searchParams.get('v');
        return id || null;
      }

      return null;
    } catch {
      return null;
    }
  }
}
