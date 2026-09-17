import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tailwind.css";
import "./styles/index.css";
import { errorLoggingService } from "./services/errorLoggingService";
import { dashboardEnvironment } from './config/dashboardEnvironment';
import QaEnvironmentBanner from './components/QaEnvironmentBanner';

// Install global unhandled error + promise rejection handlers
errorLoggingService?.installGlobalHandlers();

const container = document.getElementById("root");
const root = createRoot(container);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker?.register('/sw.js')?.catch(() => {});
  });
}

root.render(dashboardEnvironment.isQa ? <><QaEnvironmentBanner /><App /></> : <App />);
