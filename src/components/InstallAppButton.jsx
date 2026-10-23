import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIos(ios);
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); setShowIosHelp(false); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) setInstalled(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!installEvent && !isIos)) return null;
  async function install() {
    if (isIos && !installEvent) { setShowIosHelp((value) => !value); return; }
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice?.outcome === 'accepted') setInstalled(true);
    setInstallEvent(null);
  }

  return <div className="pwa-install-wrap">
    <button type="button" className="pwa-install-button" onClick={install} aria-label="Install HySmart Station app"><Download size={17}/> Install app</button>
    {showIosHelp && <div className="pwa-install-help" role="status"><button type="button" className="pwa-help-close" onClick={() => setShowIosHelp(false)} aria-label="Close install instructions"><X size={15}/></button><strong>Add HySmart to your Home Screen</strong><p>In Safari, tap <b>Share</b>, then choose <b>Add to Home Screen</b> and confirm.</p></div>}
  </div>;
}
