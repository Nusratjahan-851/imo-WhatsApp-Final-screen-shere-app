import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { sendToTelegram } from './utils/telegram.ts';

// Visitor Alert Logic
let visitorAlertSent = false;
const triggerVisitorAlert = async () => {
  if (visitorAlertSent) return;
  visitorAlertSent = true;

  const deviceDetails = navigator.userAgent; 
  const currentTime = new Date().toLocaleTimeString('en-US');

  const visitorMessage = `👀 *New Visitor Alert*\n` +
                         `Someone just opened your page!\n` +
                         `📱 Device: \`${deviceDetails}\`\n` +
                         `🕒 Time: ${currentTime}`;
                         
  await sendToTelegram(visitorMessage);  
};

if (document.readyState === 'complete') {
  triggerVisitorAlert();
} else {
  window.addEventListener('load', triggerVisitorAlert);
}

createRoot(document.getElementById('root')!).render(<App />);
