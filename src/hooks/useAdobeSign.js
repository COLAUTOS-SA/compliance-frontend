import { useState, useCallback, useRef } from "react";

/**
 * Custom hook para manejar la integración con Adobe Sign
 * Gestiona:
 * - Iniciar proceso de firma
 * - Monitorear estado de firma
 * - Descargar documentos firmados
 */
export const useAdobeSign = (apiUrl) => {
  const [adobeState, setAdobeState] = useState({
    widget_id: null,
    agreement_id: null,
    status: "idle", // idle, initiating, waiting, signed, error
    error: null,
    message: null,
    pdf_url: null,
    prefill_url: null,
    signing_url: null,
  });

  const pollIntervalRef = useRef(null);

  async function getSigningUrl(agreementId) {
    const res = await fetch(`${apiUrl}/adobe/signing-url/${agreementId}`);

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Error obteniendo firma");
    }

    setAdobeState((prev) => ({
      ...prev,
      signing_url: data.data.signing_url,
    }));
  }

  /**
   * Inicia el proceso de firma en Adobe Sign
   * Crea contraparte, solicitud y obtiene widget
   */
  const initiateSignature = useCallback(
    async (signingData) => {
      if (
        !signingData ||
        !signingData.id_solicitud ||
        !signingData.id_contraparte
      ) {
        console.log("Faltan datos para iniciar firma:", signingData);
        throw new Error("Datos incompletos para iniciar firma");
      }

      setAdobeState((prev) => ({
        ...prev,
        status: "initiating",
        error: null,
        message: "Iniciando proceso de firma...",
      }));

      try {
        const response = await fetch(`${apiUrl}/adobe/initiate-signing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(signingData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || "Error al iniciar firma en Adobe Sign",
          );
        }

        const result = await response.json();

        if (!result.data || !result.data.prefill_url) {
          throw new Error("No se recibió prefill_url del servidor");
        }

        setAdobeState((prev) => ({
          ...prev,
          agreement_id: result.data.agreement_id,
          prefill_url: result.data.prefill_url, // 🔥 clave
          signing_url: null,
          status: "prefill",
          message: "Por favor completa el formulario antes de firmar",
          error: null,
        }));

        return result.data;
      } catch (err) {
        const errorMessage =
          err.message || "Error desconocido al iniciar firma";
        setAdobeState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
          message: null,
        }));
        throw err;
      }
    },
    [apiUrl],
  );

  /**
   * Verifica el estado actual del acuerdo en Adobe Sign
   */
  const checkSignatureStatus = useCallback(
    async (agreementId) => {
      if (!agreementId) {
        throw new Error("Agreement ID no proporcionado");
      }

      try {
        const response = await fetch(
          `${apiUrl}/adobe/agreement/${agreementId}`,
        );

        if (!response.ok) {
          throw new Error(`Error al verificar estado: ${response.status}`);
        }

        const result = await response.json();
        return result.data;
      } catch (err) {
        console.error("Error checking signature status:", err);
        throw err;
      }
    },
    [apiUrl],
  );

  /**
   * Inicia polling para monitorear el estado del documento
   * Se detiene automáticamente cuando el documento es firmado
   */
  const startPolling = useCallback(
    async (agreementId) => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusData = await checkSignatureStatus(agreementId);

          // 🔥 CUANDO TERMINA PREFILL
          if (statusData.status === "waiting" && !adobeState.signing_url) {
            const res = await fetch(
              `${apiUrl}/adobe/signing-url/${agreementId}`,
            );
            const data = await res.json();

            if (data.success && data.data.signing_url) {
              setAdobeState((prev) => ({
                ...prev,
                signing_url: data.data.signing_url,
                status: "signing",
                message: "Ahora firma el documento",
              }));
            }
          }

          // 🔥 CUANDO FIRMA
          if (statusData.status === "signed") {
            setAdobeState((prev) => ({
              ...prev,
              status: "signed",
              pdf_url: statusData.pdf_url,
              message: "✅ Documento firmado correctamente",
            }));

            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
    },
    [checkSignatureStatus, apiUrl, adobeState.signing_url],
  );

  /**
   * Detiene el polling
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * Reinicia el estado
   */
  const reset = useCallback(() => {
    stopPolling();
    setAdobeState({
      widget_id: null,
      agreement_id: null,
      status: "idle",
      error: null,
      message: null,
      pdf_url: null,
      prefill_url: null,
      signing_url: null,
    });
  }, [stopPolling]);

  return {
    adobeState,
    initiateSignature,
    getSigningUrl,
    checkSignatureStatus,
    startPolling,
    stopPolling,
    reset,
  };
};

export default useAdobeSign;
