import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/profile/SettingsView";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { profileOf } from "@/lib/auth/profile";
import { getCalendarSettings } from "@/lib/calendar/service";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ calendar?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const [{ calendar: notice }, calendar] = await Promise.all([searchParams, getCalendarSettings(user.id)]);

  return (
    <SettingsView
      profile={profileOf(user)}
      pendingEmail={user.new_email}
      calendar={calendar}
      calendarNotice={typeof notice === "string" ? notice : undefined}
    />
  );
}
