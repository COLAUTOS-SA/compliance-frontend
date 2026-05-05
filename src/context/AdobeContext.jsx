import { createContext, useContext } from "react";
import useAdobeSign from "../hooks/useAdobeSign";

const AdobeContext = createContext();

/**
 * Proveedor del contexto de Adobe Sign
 * Proporciona acceso a métodos y estado de Adobe Sign en toda la app
 */
export function AdobeProvider({ children }) {
  const apiUrl = import.meta.env.VITE_API_URL || "https://compliance.colautos.co/api";
  const adobeSign = useAdobeSign(apiUrl);

  return (
    <AdobeContext.Provider value={adobeSign}>
      {children}
    </AdobeContext.Provider>
  );
}

/**
 * Hook personalizado para usar Adobe Sign en cualquier componente
 * Ej: const { adobeState, initiateSignature } = useAdobeContext();
 */
export function useAdobeContext() {
  const context = useContext(AdobeContext);
  if (!context) {
    throw new Error(
      "useAdobeContext debe usarse dentro de un AdobeProvider"
    );
  }
  return context;
}

export default AdobeContext;
