import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadUserFile } from "@/lib/upload";
import { Camera, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nickname) setNickname(data.nickname);
        if (data?.avatar_url) setPreviewUrl(data.avatar_url);
      });
  }, [user]);

  if (!loading && !user) return <Navigate to="/" />;

  const handleFile = (f: File | null) => {
    setAvatarFile(f);
    if (f) setPreviewUrl(URL.createObjectURL(f));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nickname.trim()) return;
    setSaving(true);
    try {
      let avatarUrl: string | null = previewUrl?.startsWith("blob:") ? null : previewUrl;
      if (avatarFile) {
        avatarUrl = await uploadUserFile("avatars", user.id, avatarFile);
      }
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        nickname: nickname.trim(),
        avatar_url: avatarUrl,
        email: user.email,
      });
      if (error) throw error;
      toast.success("Profile saved");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-6 pt-12 pb-20">
        <h1 className="font-display text-4xl mb-2">You're in!</h1>
        <p className="text-muted-foreground mb-8">Set your nickname and pick a photo so your crew knows it's you.</p>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative w-32 h-32 rounded-full bg-primary/10 border-4 border-dashed border-primary/30 flex items-center justify-center overflow-hidden hover:border-primary transition-colors"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-12 h-12 text-primary/60" strokeWidth={2} />
              )}
              <div className="absolute bottom-0 right-0 w-10 h-10 bg-accent rounded-full flex items-center justify-center shadow-bold border-4 border-background">
                <Camera className="w-5 h-5 text-night" strokeWidth={2.5} />
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">Tap to take a selfie or upload a photo</p>
          </div>

          <div>
            <label className="font-display text-sm uppercase tracking-wider text-muted-foreground block mb-2">
              Nickname
            </label>
            <Input
              required
              maxLength={30}
              placeholder="Birdie King"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="h-12 text-lg font-display"
            />
          </div>

          <Button
            type="submit"
            disabled={saving || !nickname.trim()}
            className="w-full h-12 text-base font-display tracking-wide rounded-xl"
          >
            {saving ? "Saving..." : "Let's go →"}
          </Button>
        </form>
      </div>
    </div>
  );
}