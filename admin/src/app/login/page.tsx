import { Card } from "@heroui/react";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6">
        <Card.Header className="flex flex-col items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
            <Icon name="activity" className="h-5 w-5" />
          </span>
          <div>
            <Card.Title className="text-xl">GameXS Ops</Card.Title>
            <Card.Description>Scraping pipeline monitor · admins only</Card.Description>
          </div>
        </Card.Header>
        <Card.Content>
          <LoginForm
            next={next ?? "/"}
            initialError={error === "forbidden" ? "This account is not a GameXS admin." : undefined}
          />
        </Card.Content>
      </Card>
    </main>
  );
}
