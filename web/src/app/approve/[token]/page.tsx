import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ApproveTokenPage({ params }: PageProps) {
  const { token } = await params;
  if (!token) {
    redirect("/approve");
  }
  redirect(`/approve?token=${encodeURIComponent(token)}`);
}

