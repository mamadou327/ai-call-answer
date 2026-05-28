import { useState, useMemo } from "react";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImportCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  onImported: () => void;
}

type FieldKey = "name" | "phone" | "email" | "notes" | "ignore";

const FIELD_LABELS: Record<Exclude<FieldKey, "ignore">, string> = {
  name: "Name *",
  phone: "Phone",
  email: "Email",
  notes: "Notes / Preferences",
};

const HEADER_HINTS: Record<Exclude<FieldKey, "ignore">, string[]> = {
  name: ["name", "client name", "customer name", "full name", "first name"],
  phone: ["phone", "mobile", "mobile number", "phone number", "tel", "telephone", "contact"],
  email: ["email", "e-mail", "email address"],
  notes: ["notes", "note", "comments", "comment", "preferences", "preference"],
};

const MAX_ROWS = 10000;
const MAX_BYTES = 5 * 1024 * 1024;

function autoDetect(headers: string[]): Record<string, FieldKey> {
  const mapping: Record<string, FieldKey> = {};
  for (const h of headers) {
    const low = h.toLowerCase().trim();
    let matched: FieldKey = "ignore";
    for (const [key, hints] of Object.entries(HEADER_HINTS)) {
      if (hints.some((hint) => low === hint || low.includes(hint))) {
        matched = key as FieldKey;
        break;
      }
    }
    mapping[h] = matched;
  }
  return mapping;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

export const ImportCustomersDialog = ({
  open,
  onOpenChange,
  businessId,
  onImported,
}: ImportCustomersDialogProps) => {
  const { toast } = useToast();
  const [stage, setStage] = useState<"upload" | "map" | "importing" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, FieldKey>>({});
  const [result, setResult] = useState<{ imported: number; skipped: number; invalid: number } | null>(null);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setStage("upload");
    setFileName("");
    setRows([]);
    setHeaders([]);
    setMapping({});
    setResult(null);
    setProgress(0);
  };

  const handleFile = (file: File) => {
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Maximum 5MB.", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data || []).slice(0, MAX_ROWS);
        if (data.length === 0) {
          toast({ title: "Empty file", description: "No rows found.", variant: "destructive" });
          return;
        }
        const hdrs = res.meta.fields || Object.keys(data[0]);
        setHeaders(hdrs);
        setRows(data);
        setMapping(autoDetect(hdrs));
        setStage("map");
      },
      error: () => {
        toast({ title: "Could not read file", description: "Make sure it's a valid CSV.", variant: "destructive" });
      },
    });
  };

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);
  const hasNameMapping = useMemo(() => Object.values(mapping).includes("name"), [mapping]);

  const runImport = async () => {
    if (!hasNameMapping) {
      toast({ title: "Map the Name column", variant: "destructive" });
      return;
    }
    setStage("importing");
    setProgress(0);

    // Build candidate rows
    const inverse: Partial<Record<Exclude<FieldKey, "ignore">, string>> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (field !== "ignore" && !inverse[field]) inverse[field] = header;
    }

    const candidates = rows.map((r) => {
      const name = (inverse.name ? r[inverse.name] : "").trim();
      const phoneRaw = inverse.phone ? r[inverse.phone] : "";
      const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
      const email = (inverse.email ? r[inverse.email] : "").trim().toLowerCase();
      const notes = (inverse.notes ? r[inverse.notes] : "").trim();
      return { name, phone, email, notes };
    });

    let invalid = 0;
    const valid = candidates.filter((c) => {
      if (!c.name) {
        invalid++;
        return false;
      }
      if (!c.phone && !c.email) {
        invalid++;
        return false;
      }
      return true;
    });

    // Fetch existing phones to dedupe
    const { data: existing } = await supabase
      .from("customers")
      .select("phone")
      .eq("business_id", businessId)
      .not("phone", "is", null);
    const existingPhones = new Set((existing || []).map((c) => normalizePhone(c.phone || "")).filter(Boolean));

    let imported = 0;
    let skipped = 0;
    const toInsert: any[] = [];
    const seenInBatch = new Set<string>();

    for (const c of valid) {
      const key = c.phone || `email:${c.email}`;
      if (c.phone && existingPhones.has(c.phone)) {
        skipped++;
        continue;
      }
      if (seenInBatch.has(key)) {
        skipped++;
        continue;
      }
      seenInBatch.add(key);
      toInsert.push({
        business_id: businessId,
        name: c.name,
        phone: c.phone || null,
        email: c.email || null,
        notes_preferences: c.notes || null,
        total_visits: 0,
        first_visit_date: new Date().toISOString(),
      });
    }

    // Insert in batches of 500
    const BATCH = 500;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const { error } = await supabase.from("customers").insert(batch);
      if (error) {
        toast({
          title: "Import failed",
          description: error.message,
          variant: "destructive",
        });
        setStage("map");
        return;
      }
      imported += batch.length;
      setProgress(Math.round(((i + batch.length) / toInsert.length) * 100));
    }

    setResult({ imported, skipped, invalid });
    setStage("done");
    onImported();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import customers from CSV</DialogTitle>
          <DialogDescription>
            Bring your existing client list across from Fresha, Booksy, Treatwell, or any other system.
          </DialogDescription>
        </DialogHeader>

        {stage === "upload" && (
          <div className="space-y-4 py-4">
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Click to upload a CSV file</p>
                <p className="text-xs text-muted-foreground mt-1">Up to 5MB · 10,000 rows max</p>
              </div>
              <Input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription className="text-xs">
                In Fresha or Booksy, go to Clients → Export. We'll auto-detect common column names.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {stage === "map" && (
          <div className="space-y-4 py-2">
            <div className="text-sm">
              <strong>{rows.length}</strong> rows found in <strong>{fileName}</strong>. Map your columns:
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-3">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-2 gap-2 items-center">
                  <div className="text-sm truncate" title={h}>
                    {h}
                    <div className="text-xs text-muted-foreground truncate">
                      e.g. {previewRows.find((r) => r[h])?.[h] || "—"}
                    </div>
                  </div>
                  <Select
                    value={mapping[h] || "ignore"}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v as FieldKey }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignore">Ignore</SelectItem>
                      {Object.entries(FIELD_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {!hasNameMapping && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>You must map one column to <strong>Name</strong>.</AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">
              Rows without a name, or without both phone and email, will be skipped. Existing customers
              (matched by phone) won't be duplicated.
            </p>
          </div>
        )}

        {stage === "importing" && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Importing… {progress}%</p>
          </div>
        )}

        {stage === "done" && result && (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-semibold">Import complete</p>
                <p className="text-sm text-muted-foreground">
                  {result.imported} imported · {result.skipped} skipped as duplicates · {result.invalid} invalid
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {stage === "map" && (
            <>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={runImport} disabled={!hasNameMapping}>
                Import {rows.length} rows
              </Button>
            </>
          )}
          {stage === "done" && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
