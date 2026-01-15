import aiviaLogo from "@/assets/aivia-logo-new.png";

const Footer = () => {
  const footerLinks = {
    product: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
    ],
    company: [
      { label: "About Us", href: "#" },
      { label: "Contact", href: "#" },
      { label: "FAQ", href: "#faq" },
    ]
  };

  return (
    <footer className="border-t-2 border-border bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Logo & Description */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src={aiviaLogo} alt="AIVIA" className="h-10 w-auto" />
              <span className="text-xl font-bold">AIVIA</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-xs">
              AI-powered phone receptionist for salons, barbershops, and restaurants across the UK.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              {footerLinks.product.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href} 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href} 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-8 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            © 2025 AIVIA. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
