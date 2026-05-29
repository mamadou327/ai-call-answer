import { Link } from "react-router-dom";

const LegalFooter = () => {
  return (
    <footer className="border-t border-border bg-background py-6 mt-12">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} AIVIA. All rights reserved.</p>
        <nav className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
};

export default LegalFooter;
