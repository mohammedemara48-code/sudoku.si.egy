import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";

function explainAuthError(message?: string) {
  const text = message ?? "";
  if (/invalid origin/i.test(text)) return "العنوان غير مسموح. افتح الموقع من sudokusiegy.vercel.app ثم أعد المحاولة.";
  if (/exist|already/i.test(text)) return "هذا البريد مسجّل. ادخل بدل إنشاء حساب.";
  if (/password/i.test(text)) return "كلمة السر قصيرة. استخدم ٨ أحرف على الأقل.";
  return "تعذر الدخول. راجع البريد وكلمة السر ثم أعد المحاولة.";
}

export function LoginPanel() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const result =
      mode === "in"
        ? await authClient.signIn.email({ email, password, callbackURL: "/" })
        : await authClient.signUp.email({
            email,
            password,
            name: name.trim() || email.split("@")[0] || "لاعب",
            callbackURL: "/",
          });
    setPending(false);
    if (result.error) setError(explainAuthError(result.error.message));
  }

  return (
    <main className="desk gate">
      <p className="kicker">سودوكو</p>
      <h1>الدخول أولًا</h1>
      <p className="gate-copy">اللعب ولغز الأسبوع والمقارنة متاحون بعد تسجيل الدخول فقط.</p>
      <form className="gate-form" onSubmit={(event) => void submit(event)}>
        {mode === "up" ? (
          <label>
            الاسم
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </label>
        ) : null}
        <label>
          البريد
          <input
            className="field"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          كلمة السر
          <input
            className="field"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
          />
        </label>
        {error ? <p className="note bad">{error}</p> : null}
        <button className="install-btn" type="submit" disabled={pending}>
          {mode === "in" ? "دخول" : "إنشاء حساب"}
        </button>
      </form>
      <button type="button" className="text-btn" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "ليس لديك حساب؟ أنشئ واحدًا" : "لديك حساب؟ ادخل"}
      </button>
      <div className="gate-or">أو</div>
      {GROK_PROVIDERS.map((provider) => (
        <button
          key={provider.providerId}
          type="button"
          className="tool primary gate-provider"
          onClick={() => void signIn(provider.providerId, { callbackURL: "/" })}
        >
          المتابعة عبر {provider.label === "X" ? "إكس" : "جوجل"}
        </button>
      ))}
    </main>
  );
}
