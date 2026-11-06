import { AuthCard, buttonStyle, Field, type SearchParams } from "../../lib/auth-ui";
import { login } from "../auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, message } = await searchParams;
  return (
    <AuthCard
      title="Sign in to KKINGG AI"
      error={error}
      message={message}
      footer={
        <>
          <a href="/register">Create account</a> · <a href="/forgot-password">Forgot password?</a>
        </>
      }
    >
      <form action={login}>
        <Field name="email" label="Email" type="email" autoComplete="email" />
        <Field name="password" label="Password" type="password" autoComplete="current-password" />
        <button type="submit" style={buttonStyle}>
          Sign in
        </button>
      </form>
    </AuthCard>
  );
}
