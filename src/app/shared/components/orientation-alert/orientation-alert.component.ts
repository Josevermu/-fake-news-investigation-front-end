import { Component, signal, OnInit, OnDestroy, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-orientation-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orientation-alert.component.html',
  styleUrl: './orientation-alert.component.scss',
})
export class OrientationAlertComponent implements OnInit, OnDestroy {
  shouldShowOverlay: WritableSignal<boolean> = signal(false);

  ngOnInit(): void {
    this.checkOrientation();
    window.addEventListener('resize', this.checkOrientation);
    window.addEventListener('orientationchange', this.checkOrientation);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.checkOrientation);
    window.removeEventListener('orientationchange', this.checkOrientation);
  }

  private checkOrientation = (): void => {
    const isMobile = this.isMobileDevice();
    const isPortrait = window.innerHeight > window.innerWidth;
    const isSmallScreen = window.innerWidth < 768;
    
    // Show overlay if it's a mobile device (or small screen) in portrait mode
    this.shouldShowOverlay.set(isMobile && isPortrait && isSmallScreen);
  };

  private isMobileDevice(): boolean {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    // Check for mobile devices
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    if (mobileRegex.test(userAgent.toLowerCase())) {
      return true;
    }
    
    // Additional check for touch screen
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth < 768;
    
    return isTouchDevice && isSmallScreen;
  }
}
