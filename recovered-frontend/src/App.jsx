import React from "react";
import Routes from "./Routes";
import { AuthProvider } from "./contexts/AuthContext";
import { OfficeProvider } from "./contexts/OfficeContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { HelpProvider } from "./contexts/HelpContext";
import { ToastProvider } from "./contexts/ToastContext";
import ToastContainer from "./components/ui/ToastContainer";
import { YearComparisonProvider } from "./contexts/YearComparisonContext";

const CopyrightFooter = () => (
  <div style={{
    textAlign: "center",
    padding: "12px 20px",
    fontSize: "11px",
    color: "#5b6770",
    borderTop: "1px solid #d7dde3",
    background: "#f7f9fb",
    marginTop: "32px"
  }}>
    © 2026 NU Dental / AGN Dental Practices PC — All Rights Reserved &nbsp;·&nbsp; CONFIDENTIAL — Internal Use Only &nbsp;·&nbsp; Unauthorized reproduction or distribution is strictly prohibited &nbsp;·&nbsp; nudashboard.com
  </div>
);

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <OfficeProvider>
          <HelpProvider>
            <ToastProvider>
              <YearComparisonProvider>
                <Routes />
                <CopyrightFooter />
                <ToastContainer />
              </YearComparisonProvider>
            </ToastProvider>
          </HelpProvider>
        </OfficeProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
