// Makes the app window fill the screen when it was opened as an installed app / --app= window (see start.bat).
try {
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    window.moveTo(0, 0);
    window.resizeTo(screen.availWidth, screen.availHeight);
    window.addEventListener('DOMContentLoaded', () => {
      try { window.moveTo(0, 0); window.resizeTo(screen.availWidth, screen.availHeight); } catch (e) {}
    });
    setTimeout(() => {
      try { window.moveTo(0, 0); window.resizeTo(screen.availWidth, screen.availHeight); } catch (e) {}
    }, 250);
  }
} catch (e) {}
