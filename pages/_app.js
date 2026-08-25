import "../styles/globals.css";
import { AuthProvider } from "../hooks/useAuth";
import { LanguageProvider } from "../lib/i18n";

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Component {...pageProps} />
      </LanguageProvider>
    </AuthProvider>
  );
}