import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LegalDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "terms" | "privacy";
}

const LegalDocDialog = ({ open, onOpenChange, type }: LegalDocDialogProps) => {
  const title = type === "terms" ? "Terms of Service" : "Privacy Policy";
  const src = type === "terms" ? "/terms" : "/privacy";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <iframe
          src={src}
          title={title}
          className="flex-1 w-full border-0"
        />
      </DialogContent>
    </Dialog>
  );
};

export default LegalDocDialog;
