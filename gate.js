'use strict';
// Garde d'entrée, chargée dans <head> pour décider avant le premier affichage.
//
// 1. Sur téléphone, Brahot ne s'utilise que depuis l'app installée sur l'écran d'accueil.
//    Sur iPhone, les données de l'app installée sont séparées de celles de Safari :
//    des brahot comptées dans Safari seraient introuvables une fois l'app installée.
// 2. L'app refuse de s'afficher dans un cadre (iframe) d'un autre site (anti-clickjacking).
(function () {
  const root = document.documentElement;

  if (window.top !== window.self) {
    root.classList.add('framed');
    try { window.top.location.replace(window.location.href); } catch (_) {}
    return;
  }

  const ua = navigator.userAgent;
  // Les iPad récents se présentent comme un Mac : on les reconnaît à l'écran tactile.
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua) && /Mobile/.test(ua);
  const standalone =
    navigator.standalone === true ||
    ['standalone', 'fullscreen', 'minimal-ui'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches) ||
    document.referrer.startsWith('android-app://');
  const testing = new URLSearchParams(location.search).has('test');
  if (!(ios || android) || standalone || testing) return;

  root.classList.add('needs-install', ios ? 'install-ios' : 'install-android');

  const onReady = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  // Android (Chrome) : bouton « Installer » natif quand le navigateur le propose.
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    deferredPrompt = ev;
    onReady(() => { document.getElementById('ig-install').hidden = false; });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    onReady(() => {
      document.getElementById('ig-install').hidden = true;
      document.getElementById('ig-installed').hidden = false;
    });
  });

  onReady(() => {
    document.getElementById('ig-install').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      const prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      try {
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          document.getElementById('ig-install').hidden = true;
          document.getElementById('ig-installed').hidden = false;
        }
      } catch (_) {}
    });

    // iPhone : si des brahot ont déjà été comptées dans Safari, on permet de les exporter
    // pour les importer dans l'app installée (Réglages → Sauvegarde → Importer).
    if (!ios) return;
    let raw = null;
    try {
      raw = localStorage.getItem('brahot:v1');
      const data = raw && JSON.parse(raw);
      const hasData = data && ((data.current && Array.isArray(data.current.entries) && data.current.entries.length) ||
        (Array.isArray(data.history) && data.history.length));
      if (!hasData) return;
    } catch (_) {
      return;
    }
    document.getElementById('ig-legacy').hidden = false;
    document.getElementById('ig-export').addEventListener('click', async () => {
      const name = `brahot-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([raw], name, { type: 'application/json' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Sauvegarde Brahot' });
          return;
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  });
})();
