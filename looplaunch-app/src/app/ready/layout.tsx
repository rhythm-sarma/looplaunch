import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace Ready — Loop Launch",
  description: "Your Loop Launch workspace is ready for analysis.",
};

export default function ReadyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
