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
    if (!videoId) {
      console.warn('Could not extract video ID from URL:', url);
      return null;
    }

    // YouTube Shorts can be embedded using the standard embed URL with the Short's ID
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    console.log('YouTube embed URL:', embedUrl);
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  private extractYouTubeVideoId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace('www.', '');
      const path = parsed.pathname;

      // https://youtube.com/shorts/<id> - Extract ID from Shorts
      if (host === 'youtube.com' && path.startsWith('/shorts/')) {
        const segments = path.split('/');
        const id = segments[2]; // shorts/<id>
        return id?.split('?')[0] || null;
      }

      // https://youtu.be/<id>
      if (host === 'youtu.be') {
        const id = path.split('/')[1];
        return id?.split('?')[0] || null;
      }

      // https://youtube.com/watch?v=<id>
      if (host === 'youtube.com' && path === '/watch') {
        const id = parsed.searchParams.get('v');
        return id || null;
      }

      console.warn('Unsupported YouTube URL format:', url);
      return null;
    } catch (err) {
      console.error('Failed to parse YouTube URL:', err);
      return null;
    }
  }
}
