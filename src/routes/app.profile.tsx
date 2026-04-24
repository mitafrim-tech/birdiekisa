import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadUserFile } from "@/lib/upload";
import { Camera, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [nickname, setNickname] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nickname, avatar_url").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setNickname(data.nickname ?? "");
        setPreviewUrl(data.avatar_url ?? null);
      }
    });
  }, [user]);

  if (!user) return <Navigate to="/" />;

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f) setPreviewUrl(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let avatarUrl: string | null = previewUrl?.startsWith("blob:") ? null : previewUrl;
      if (file) avatarUrl = await uploadUserFile("avatars", user.id, file);
      const { error } = await supabase
        .from("profiles")
        .update({ nickname: nickname.trim(), avatar_url: avatarUrl })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profiili päivitetty");
      setFile(null);
    } catch (err) {
      toast.error(toUserMessage(err, "Tallennus epäonnistui"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <h1 className="font-display text-3xl">Profiilisi</h1>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-28 h-28 rounded-full bg-primary/10 border-4 border-dashed border-primary/30 flex items-center justify-center overflow-hidden"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-10 h-10 text-primary/60" />
          )}
          <div className="absolute bottom-0 right-0 w-9 h-9 bg-accent rounded-full flex items-center justify-center shadow-bold border-4 border-background">
            <Camera className="w-4 h-4 text-night" strokeWidth={2.5} />
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
      </div>

      <div>
        <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Pelaajanimi</Label>
        <Input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
          className="h-12 text-lg font-display mt-1"
        />
      </div>

      <div>
        <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Sähköposti</Label>
        <div className="h-12 mt-1 flex items-center px-3 rounded-md bg-muted text-muted-foreground text-sm">
          {user.email}
        </div>
      </div>

      <Button onClick={save} disabled={saving || !nickname.trim()} className="w-full h-12 rounded-xl font-display">
        {saving ? "Tallennetaan..." : "Tallenna muutokset"}
      </Button>
    </div>
  );
}