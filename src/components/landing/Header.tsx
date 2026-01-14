import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import aiviaLogo from "@/assets/aivia-logo-new.png";

const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="border-b-2 border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src={aiviaLogo} alt="AIVIA" className="h-12 w-auto" />
          <span className="text-2xl font-bold text-foreground">AIVIA</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/auth?mode=signin")}>
            Sign In
          </Button>
          <Button onClick={() => navigate("/auth")} className="shadow-sm">
            Try Free
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
