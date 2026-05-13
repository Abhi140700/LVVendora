import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { Toaster } from "react-hot-toast";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./assets/styles/variables.css";
import "./assets/styles/global.css";
import "./assets/styles/theme.css";
import "./assets/styles/theme-utils.css";
import "./assets/styles/erp-ui.css";
import App from "./App.jsx";
import { store } from "./app/store";
import KeyboardFirstProvider from "./components/ui/KeyboardFirstProvider.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

globalThis.__ERP_API_BASE__ = import.meta.env.VITE_API_BASE || "/api";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <KeyboardFirstProvider>
          <App />
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        </KeyboardFirstProvider>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
