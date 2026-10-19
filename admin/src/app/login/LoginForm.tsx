"use client";

import { Alert, Button, Description, Input, Label, Spinner, TextField } from "@heroui/react";
import { useActionState } from "react";
import { login, type LoginState } from "@/lib/actions";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, initialError ? { error: initialError } : undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state?.error ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{state.error}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      <TextField name="phone" type="tel" isRequired autoComplete="username" defaultValue={state?.phone} fullWidth variant="secondary">
        <Label>Phone number</Label>
        <Input placeholder="09xxxxxxxxx" inputMode="tel" />
        <Description>The GameXS account you use on the website.</Description>
      </TextField>
      <TextField name="password" type="password" isRequired autoComplete="current-password" fullWidth variant="secondary">
        <Label>Password</Label>
        <Input />
      </TextField>
      <Button type="submit" variant="primary" isDisabled={pending} className="mt-2 w-full">
        {pending ? <Spinner size="sm" color="current" /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
