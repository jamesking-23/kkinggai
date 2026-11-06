import { AuthCard, buttonStyle, Field, type SearchParams } from "../../lib/auth-ui";
import { register } from "../auth/actions";

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return (
    <AuthCard
      title="Create your account"
      error={error}
      footer={
        <>
          Already registered? <a href="/login">Sign in</a>
        </>
      }
    >
      <form action={register}>
        <Field name="displayName" label="Name" autoComplete="name" />
        <Field name="email" label="Email" type="email" autoComplete="email" />
        <Field
          name="password"
          label="Password (10+ characters, letters and numbers)"
          type="password"
          autoComplete="new-password"
        />
        <button type="submit" style={buttonStyle}>
          Create account
        </button>
      </form>
    </AuthCard>
  );
}
