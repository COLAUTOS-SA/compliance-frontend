import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowRight, FiLock, FiShield, FiUser } from "react-icons/fi";
import { firstSegmentOf, isAllowedSegment } from "../constants/segments.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // username = correo que va al backend
      const session = await login(form.username.trim(), form.password);

      console.log(session)

      console.log(session.role)

      // 🔹 Si es admin → ir directamente al panel /admin
      if (session.role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }

      if (session.role === "usuario"){
        navigate("/seguimiento", { replace: true });
        return; 
      }

      // 🔹 Resto de roles → segmentos (proveedores, clientes, etc.)
      const fromPath = location.state?.from?.pathname;
      let to = `/segment/${firstSegmentOf(session.role)}`;

      if (fromPath?.startsWith("/segment/")) {
        const slug = fromPath.replace("/segment/", "").split("/")[0];
        if (isAllowedSegment(session.role, slug)) {
          to = fromPath;
        }
      }

      navigate(to, { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(29,78,216,0.25),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(14,116,144,0.28),transparent_45%),radial-gradient(circle_at_50%_100%,rgba(180,83,9,0.22),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(2,6,23,0.92),rgba(15,23,42,0.72))]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_80px_rgba(2,6,23,0.65)] backdrop-blur-xl lg:grid-cols-2">
          <section className="hidden flex-col justify-between p-10 text-white lg:flex">
            <div>
              <img src="/logo.png" alt="COLAUTOS-LOGO" className="h-16 w-auto" />
              <p className="mt-10 inline-flex items-center gap-2 rounded-full border border-sky-300/40 bg-sky-300/10 px-4 py-1.5 text-xs font-medium tracking-wide text-sky-100">
                <FiShield />
                Plataforma segura de cumplimiento
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight">
                Compliance Colautos
              </h1>
              <p className="mt-4 max-w-md text-sm text-slate-200/90">
                Gestión de vinculación, documentación y firma electrónica en un flujo centralizado para control y trazabilidad.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-xs text-slate-200/85">
              Acceso exclusivo para personal autorizado, contrapartes y responsables de validación.
            </div>
          </section>

          <section className="bg-white px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Bienvenido
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                  Compliance Colautos
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Inicia sesión con tus credenciales corporativas.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-700">Correo</label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 transition focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-100">
                    <FiUser className="text-slate-400" />
                    <input
                      required
                      className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                      placeholder="correo@colautos.co"
                      value={form.username}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, username: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Contraseña
                  </label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 transition focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-100">
                    <FiLock className="text-slate-400" />
                    <input
                      required
                      type="password"
                      className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Entrando..." : "Ingresar al sistema"}
                  {!loading && <FiArrowRight className="text-base" />}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
