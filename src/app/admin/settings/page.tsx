import { SettingType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { saveSettings } from "@/lib/actions/admin/content";
import EntityForm from "@/components/admin/EntityForm";
import { isConfigured } from "@/lib/storage";
import { isEmailConfigured } from "@/lib/email";
import {
  Alert,
  Card,
  CheckboxField,
  PageHeader,
  TextArea,
  TextField,
} from "@/components/admin/ui";

export const metadata = { title: "Site settings" };
export const dynamic = "force-dynamic";

// Every group in the table gets a card, whether it is named here or not, so a
// missing entry is not a crash: it is a card headed with the raw slug. Both
// `skin` and `offer` sat like that, which is a poor way to present the screen
// where somebody changes what a scan costs.
const GROUP_TITLES: Record<string, string> = {
  general: "General",
  contact: "Contact details",
  booking: "Booking rules",
  skin: "Skin analysis and pricing",
  offer: "Homepage offer banner",
};

export default async function SettingsPage() {
  const settings = await prisma.siteSetting.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });

  const groups = settings.reduce<Record<string, typeof settings>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  const uploadsReady = isConfigured();
  const emailReady = isEmailConfigured();

  const action = async (formData: FormData) => {
    "use server";
    return saveSettings(formData);
  };

  return (
    <>
      <PageHeader
        title="Site settings"
        description="Values the public site reads at render time."
      />

      {(!uploadsReady || !emailReady) && (
        <div className="mb-6 space-y-3">
          {!uploadsReady && (
            <Alert tone="info">
              <strong className="font-semibold">File uploads are off.</strong> Add{" "}
              <code className="rounded bg-white/60 px-1">S3_BUCKET</code>,{" "}
              <code className="rounded bg-white/60 px-1">AWS_REGION</code> and your
              IAM keys to <code className="rounded bg-white/60 px-1">.env</code> to
              enable them. Until then, image fields accept a pasted URL, which is
              how all the seeded content already works.
            </Alert>
          )}
          {!emailReady && (
            <Alert tone="info">
              <strong className="font-semibold">Email delivery is off.</strong>{" "}
              Add a verified{" "}
              <code className="rounded bg-white/60 px-1">EMAIL_FROM</code> (AWS
              SES identity) plus the AWS keys to send booking confirmations and
              password resets. Until then they&apos;re logged to{" "}
              <code className="rounded bg-white/60 px-1">email_logs</code> and the
              server console.
            </Alert>
          )}
        </div>
      )}

      <EntityForm action={action} cancelHref="/admin" submitLabel="Save settings">
        {Object.entries(groups).map(([group, rows]) => (
          <Card key={group} title={GROUP_TITLES[group] ?? group}>
            <div className="space-y-5">
              {rows.map((s) => {
                const label = s.label ?? s.key;

                if (s.type === SettingType.BOOLEAN) {
                  return (
                    <CheckboxField
                      key={s.key}
                      label={label}
                      name={s.key}
                      hint={s.key}
                      defaultChecked={s.value === "true"}
                    />
                  );
                }
                if (s.type === SettingType.TEXT) {
                  return (
                    <TextArea
                      key={s.key}
                      label={label}
                      name={s.key}
                      hint={s.key}
                      defaultValue={s.value ?? ""}
                    />
                  );
                }
                return (
                  <TextField
                    key={s.key}
                    label={label}
                    name={s.key}
                    hint={s.key}
                    type={s.type === SettingType.NUMBER ? "number" : "text"}
                    defaultValue={s.value ?? ""}
                  />
                );
              })}
            </div>
          </Card>
        ))}
      </EntityForm>
    </>
  );
}
