/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "https://compliance.colautos.co/api";

// Mapea lo que devuelve el backend a un role que entiende el frontend
function mapBackendRole(data) {
  // 1) Intentar con nombre_rol o nombre
  const nombreRol = (data.nombre_rol || data.nombre || "").toUpperCase().trim();

  switch (nombreRol) {
    case "OFICIAL DE CUMPLIMIENTO":
      return "admin";

    case "PROVEEDOR":
      return "proveedores";

    case "ACCIONISTA":
      return "accionistas";

    case "CLIENTE":
      return "clientes";

    case "EMPLEADO":
      return "empleados";
  }

  // 2) Si por alguna razón nombre/nombre_rol no cuadran, usar id_rol
  switch (data.id_rol) {
    case 1:
      return "admin"; // OFICIAL DE CUMPLIMIENTO
    case 2:
      return "proveedores"; // PROVEEDOR
    case 3:
      return "accionistas"; // ACCIONISTA
    case 4:
      return "clientes"; // CLIENTE
    case 5:
      return "empleados"; // EMPLEADO
    default:
      return "usuario";
  }
}
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("dd_user");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem("dd_user");
      return null;
    }
  });

  const login = async (username, password) => {
    // username = correo (oficial@colautos.com, proveedor@colautos.com, etc.)
    const res = await fetch(`${API_URL}/usuarios/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        correo: username,
        contrasena: password,
      }),
    });

    const payload = await res.json();

    if (!res.ok || !payload.success) {
      throw new Error(payload.message || "Usuario o contraseña inválidos");
    }

    const data = payload.data;

    const role = mapBackendRole(data);

    const session = {
      ...data, // id, nombre, correo, id_rol, nombre_rol, etc.
      role, // "admin", "proveedores", "accionistas", "clientes", "empleados"
    };

    localStorage.setItem("dd_user", JSON.stringify(session));
    setUser(session);

    return session;
  };

  const logout = () => {
    localStorage.removeItem("dd_user");
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
