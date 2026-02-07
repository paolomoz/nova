import { useAuth } from '@/lib/auth';

export function SettingsPage() {
  const { user, org } = useAuth();

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Settings</h1>

      <div className="mt-6 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-muted-foreground">Account</h2>
          <div className="mt-2 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {user?.avatarUrl && (
                <img src={user.avatarUrl} alt={user.name} className="h-10 w-10 rounded-full" />
              )}
              <div>
                <p className="font-medium">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-muted-foreground">Organization</h2>
          <div className="mt-2 rounded-lg border p-4">
            <p className="font-medium">{org?.name}</p>
            <p className="text-sm text-muted-foreground">Slug: {org?.slug}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
