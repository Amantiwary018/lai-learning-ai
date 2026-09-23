import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/AppShell";
import { MODES, LANGS } from "@/components/DoubtChat";
import { useAuth, useTheme } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user, update } = useAuth(); const { dark, toggle } = useTheme(); const { toast } = useToast();
  const [name, setName] = useState(user!.name); const [language, setLanguage] = useState(user!.language); const [mode, setMode] = useState(user!.explain_mode); const [profession, setProfession] = useState(user!.profession || "");
  const save = async () => { try { await update({ name, language, explain_mode: mode, profession }); toast({ title: "Preferences saved" }); } catch (e: any) { toast({ title: "Could not save", description: e.message, variant: "destructive" }); } };
  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" subtitle="Personalise how LAI teaches you." />
      <div className="space-y-5 rounded-xl border bg-card p-5">
        <div className="space-y-1.5"><Label>Name (printed on certificates)</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-settings-name" /></div>
        <div className="space-y-1.5"><Label>Preferred language</Label><Select value={language} onValueChange={setLanguage}><SelectTrigger data-testid="select-settings-language"><SelectValue /></SelectTrigger><SelectContent>{LANGS.map((l) => <SelectItem key={l.v} value={l.v}>{l.l}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Default explanation mode</Label><Select value={mode} onValueChange={setMode}><SelectTrigger data-testid="select-settings-mode"><SelectValue /></SelectTrigger><SelectContent>{MODES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Profession or goal (for profession-specific AI tips)</Label><Input value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="e.g. B.Tech CSE student, teacher, marketer" data-testid="input-settings-profession" /></div>
        <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Dark mode</span><Button size="sm" variant="outline" onClick={toggle} data-testid="button-settings-theme">{dark ? "On" : "Off"}</Button></div>
        <Button onClick={save} data-testid="button-save-settings">Save preferences</Button>
      </div>
    </div>
  );
}
