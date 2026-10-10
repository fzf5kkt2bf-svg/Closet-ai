"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole, Mail, Shirt, Sparkles } from "lucide-react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import Closet from "./closet";
import type { User } from "@supabase/supabase-js";
type AuthView = "login" | "signup" | "recover" | "password";
export default function App() {
  const [loading, setLoading] = useState(supabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let api;
    try {
      api = getSupabase();
    } catch {
      queueMicrotask(() => {
        setLoading(false);
        setError(
          "Configuração do Supabase inválida. Confira a URL e a chave pública.",
        );
      });
      return;
    }
    const {
      data: { subscription },
    } = api.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("password");
        setDemo(false);
      }
      if (event === "SIGNED_OUT") {
        setView("login");
        setDemo(false);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });
    // Ensure the initial loading state also resolves when no auth event is emitted.
    const startupTimer = window.setTimeout(() => setLoading(false), 4000);
    void api.auth
      .getSession()
      .then(({ data }) => {
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // A recovery URL is consumed by Supabase JS during client initialization.
    return () => {
      window.clearTimeout(startupTimer);
      subscription.unsubscribe();
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const api = getSupabase();
      if (view === "login") {
        const { error } = await api.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setPassword("");
      } else if (view === "signup") {
        const { error, data } = await api.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name.trim() },
          },
        });
        if (error) throw error;
        setPassword("");
        if (!data.session)
          setMessage(
            "Cadastro recebido. Confira seu e-mail para confirmar o acesso.",
          );
      } else if (view === "recover") {
        const { error } = await api.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage(
          "Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha.",
        );
      } else {
        if (password.length < 8)
          throw new Error("A senha precisa ter ao menos 8 caracteres.");
        const { error } = await api.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setView("login");
        await api.auth.signOut();
        setMessage("Senha atualizada. Entre novamente com sua nova senha.");
      }
    } catch (cause) {
      const localMessage =
        cause instanceof Error && cause.message.startsWith("A senha precisa")
          ? cause.message
          : "";
      setError(
        localMessage ||
          (view === "login"
            ? "Não foi possível entrar. Confira o e-mail e a senha."
            : view === "signup"
              ? "Não foi possível criar a conta. Confira os dados e tente novamente."
              : view === "recover"
                ? "Não foi possível enviar o link. Tente novamente."
                : "Não foi possível atualizar a senha. Solicite um novo link."),
      );
    } finally {
      setBusy(false);
    }
  }
  function changeView(next: AuthView) {
    setView(next);
    setError("");
    setMessage("");
    setPassword("");
  }
  if (loading)
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <Shirt size={28} />
          <p>Preparando seu closet…</p>
        </div>
      </div>
    );
  if (user && view !== "password")
    return (
      <Closet
        key={user.id}
        mode="personal"
        userId={user.id}
        onSignOut={async () => {
          const { error } = await getSupabase().auth.signOut();
          if (error) throw error;
        }}
      />
    );
  if (demo && !user)
    return <Closet mode="demo" onLeaveDemo={() => setDemo(false)} />;
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <Shirt size={27} />
          <span>
            meu closet<small>AI</small>
          </span>
        </div>
        <span className="eyebrow">SEU ESTILO EM UM SÓ LUGAR</span>
        <h1>
          {view === "login"
            ? "Bem-vinda ao seu closet"
            : view === "signup"
              ? "Crie seu closet"
              : view === "recover"
                ? "Recupere seu acesso"
                : "Nova senha"}
        </h1>
        <p className="auth-intro">
          {view === "password"
            ? "Escolha uma nova senha para proteger suas peças."
            : "Suas peças e fotos, guardadas na sua conta."}
        </p>
        {!supabaseConfigured && (
          <div role="alert" className="alert error">
            Supabase ainda não configurado. Defina as duas variáveis públicas
            descritas no README para ativar sua conta.
          </div>
        )}
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="alert">
            {message}
          </div>
        )}
        {supabaseConfigured && (
          <form onSubmit={submit} className="auth-form">
            {view === "signup" && (
              <label>
                Seu nome (opcional)
                <input
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  placeholder="Como prefere ser chamada?"
                />
              </label>
            )}
            {view !== "password" && (
              <label>
                E-mail
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="voce@exemplo.com"
                />
              </label>
            )}
            {view !== "recover" && (
              <label>
                {view === "password" ? "Nova senha" : "Senha"}
                <input
                  type="password"
                  minLength={view === "login" ? 1 : 8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={
                    view === "login" ? "current-password" : "new-password"
                  }
                  placeholder="Pelo menos 8 caracteres"
                />
              </label>
            )}
            <button className="button full" type="submit" disabled={busy}>
              <Mail size={17} />
              {busy
                ? "Aguarde…"
                : view === "login"
                  ? "Entrar"
                  : view === "signup"
                    ? "Criar conta"
                    : view === "recover"
                      ? "Enviar link de recuperação"
                      : "Salvar nova senha"}
            </button>
          </form>
        )}
        {view === "login" && supabaseConfigured && (
          <div className="auth-links">
            <button
              className="text-button"
              onClick={() => changeView("signup")}
            >
              Criar conta
            </button>
            <button
              className="text-button"
              onClick={() => changeView("recover")}
            >
              Esqueci minha senha
            </button>
          </div>
        )}
        {view !== "login" && view !== "password" && (
          <button className="text-button" onClick={() => changeView("login")}>
            <ArrowLeft size={15} /> Voltar para login
          </button>
        )}
        {view !== "password" && (
          <div className="auth-demo">
            <Sparkles size={19} />
            <div>
              <strong>Quer conhecer antes?</strong>
              <p>
                Explore peças fictícias em uma demonstração separada da sua
                conta.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => {
                setDemo(true);
                setError("");
              }}
            >
              Ver demonstração
            </button>
          </div>
        )}
        <p className="auth-privacy">
          <LockKeyhole size={14} /> Fotos privadas. Acesso protegido por sua
          conta.
        </p>
      </div>
    </div>
  );
}
