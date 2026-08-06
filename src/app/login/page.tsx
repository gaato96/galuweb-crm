"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import Logo from "@/components/layout/logo";

function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const sinConfig = params.get("motivo") === "sin_config";
    const destino = params.get("desde") || "/";

    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);

    const entrar = async (e: React.FormEvent) => {
        e.preventDefault();
        setCargando(true);
        setError("");
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json.error || "No se pudo iniciar sesión");
                return;
            }
            router.replace(destino);
            router.refresh();
        } catch {
            setError("Error de red. Revisá la conexión.");
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="flex justify-center">
                    <Logo />
                </div>

                {sinConfig && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1">
                        <p className="text-xs font-bold text-amber-300 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Falta configurar la clave
                        </p>
                        <p className="text-[11px] text-amber-200/80 leading-relaxed">
                            Agregá la variable de entorno <code className="px-1 rounded bg-background/60">CRM_PASSWORD</code> en
                            Vercel (Settings → Environment Variables) y volvé a desplegar. En local va en{" "}
                            <code className="px-1 rounded bg-background/60">.env.local</code>.
                        </p>
                    </div>
                )}

                <form onSubmit={entrar} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xl">
                    <div className="space-y-1">
                        <h1 className="text-lg font-extrabold text-foreground">Acceso al panel</h1>
                        <p className="text-xs text-muted-foreground">Este CRM es privado.</p>
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Clave"
                            autoFocus
                            autoComplete="current-password"
                            className="w-full pl-9 pr-3 py-2.5 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </div>

                    {error && <p className="text-xs text-rose-400">{error}</p>}

                    <button
                        type="submit"
                        disabled={cargando || !password}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold shadow-lg disabled:opacity-50"
                    >
                        {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}
