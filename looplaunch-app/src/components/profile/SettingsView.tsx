import { AppNav } from "@/components/app/AppNav";
import { PageTransition } from "@/components/app/PageTransition";
import { AccountSettings } from "@/components/profile/AccountSettings";
import { CalendarSettings } from "@/components/profile/CalendarSettings";
import { PlanEmailSettings } from "@/components/profile/PlanEmailSettings";
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { ProfileInfo } from "@/lib/auth/profile";
import type { CalendarSettingsData } from "@/lib/calendar/types";
import type { PlanEmailData } from "@/lib/plan-email/plan";

interface SettingsViewProps {
  profile: ProfileInfo;
  pendingEmail?: string;
  planEmail: PlanEmailData;
  calendar: CalendarSettingsData;
  /** ?calendar= from the Google Calendar connection, to show its result once */
  calendarNotice?: string;
}

/** Settings: the profile and business details, the daily emails, then sign-in, log out and deleting the account. */
export function SettingsView({ profile, pendingEmail, planEmail, calendar, calendarNotice }: SettingsViewProps) {
  return (
    <PageTransition>
    <div className="min-h-svh bg-[#09090B] text-[#F4F4F5]">
      <AppNav profile={profile} active="profile" />
      <main className="ll-page mx-auto max-w-[1148px] px-4 sm:px-6 pt-10 sm:pt-14 pb-20">
        <header className="mb-8">
          <h1 className="text-[26px] sm:text-[30px] leading-tight font-semibold tracking-[-0.02em]">Settings</h1>
          <p className="mt-2 text-[16px] leading-6 text-[#B4B4BC]">Your profile, your daily emails, how you log in, and your account.</p>
        </header>
        <ProfileForm profile={profile} />
        <PlanEmailSettings data={planEmail} accountEmail={profile.email} />
        <CalendarSettings data={calendar} notice={calendarNotice} accountEmail={profile.email} />
        <AccountSettings
          email={profile.email}
          pendingEmail={pendingEmail}
          usesPassword={profile.usesPassword}
          usesGoogle={profile.usesGoogle}
        />
      </main>
    </div>
    </PageTransition>
  );
}
